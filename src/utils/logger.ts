import * as SQLite from 'expo-sqlite';
import type {
  LogColor,
  LogCategory,
  LogSeverity,
  SystemLogEntry,
  LogMetadata,
} from '../types';
import dayjs from './dayjsSetup';
import { emitFeedbackFromLog } from '../feedback/logBridge';

// Queue for when DB is not yet ready
const logQueue: SystemLogEntry[] = [];
const auditQueue: AuditLogEntry[] = [];

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isFlushing = false;

// Internal Diagnostic Channel
const _output = {
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export const AUDIT_ACTIONS = {
  // Acciones heredadas / genéricas
  AUTO_CHECKIN: 'AUTO_CHECKIN',
  AUTO_CHECKOUT: 'AUTO_CHECKOUT',
  MANUAL: 'MANUAL',

  // Semántica explícita de check-in / check-out
  AUTO_CHECKIN_GPS: 'AUTO_CHECKIN_GPS',
  AUTO_CHECKOUT_GPS: 'AUTO_CHECKOUT_GPS',
  AUTO_CHECKOUT_FAILSAFE: 'AUTO_CHECKOUT_FAILSAFE',
  MANUAL_CHECKOUT: 'MANUAL_CHECKOUT',
  MANUAL_UPDATE: 'MANUAL_UPDATE',

  // Categorías de sistema / auditoría
  OVERLAP: 'OVERLAP',
  MUTEX: 'MUTEX',
  LOCATION: 'LOCATION',
  PDF: 'PDF',
  PAYROLL: 'PAYROLL',
  GEOFENCE_EXIT: 'GEOFENCE_EXIT',
} as const;

export interface AuditLogEntry {
  session_id: number | null;
  action_type: string;
  details: string;
  timestamp: number;
}

type LooseLogPayload = {
  color?: unknown;
  categoria?: unknown;
  category?: unknown;
  severidad?: unknown;
  severity?: unknown;
  mensaje?: unknown;
  message?: unknown;
  details?: unknown;
  metadata?: LogMetadata | unknown;
  meta?: LogMetadata | unknown;
  action?: unknown;
  action_type?: unknown;
  session_id?: unknown;
  sessionId?: unknown;
  timestamp?: unknown;
};

// ✅ [P0-CRITICAL] Formato seguro de metadatos con manejo de Errores y mitigación de desbordamiento en BD
const formatMetadata = (meta?: unknown): string | undefined => {
  if (!meta) return undefined;

  // Caso 1: Error objects - extraer propiedades manualmente
  if (meta instanceof Error) {
    return JSON.stringify({
      message: meta.message,
      name: meta.name,
      code: (meta as { code?: unknown }).code,
      // Stack truncado a 500 chars para no saturar la base de datos
      stack: meta.stack ? meta.stack.substring(0, 500) : undefined,
    });
  }

  // Caso 2: Objetos normales - truncar si exceden 1KB para prevenir picos de memoria
  try {
    const stringified = JSON.stringify(meta);

    if (stringified.length > 1000) {
      return `${stringified.substring(0, 1000)}...[TRUNCATED]`;
    }

    return stringified;
  } catch {
    // Fallback si JSON.stringify falla por referencias circulares
    return '[Circular or Complex Object]';
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const safeLogText = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (value instanceof Error) {
    return value.message || value.name || fallback;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return fallback || '[Complex Object]';
  }
};

const isLogColor = (value: unknown): value is LogColor => {
  return (
    value === 'VERDE' ||
    value === 'AMARILLO' ||
    value === 'NARANJA' ||
    value === 'AZUL' ||
    value === 'BLANCO' ||
    value === 'GRIS' ||
    value === 'ROJO'
  );
};

const isLogSeverity = (value: unknown): value is LogSeverity => {
  return (
    value === 'INFO' ||
    value === 'WARN' ||
    value === 'ERROR' ||
    value === 'DEBUG' ||
    value === 'EVENT'
  );
};

const parseFormattedMetadata = (formattedMeta?: string): unknown | undefined => {
  if (!formattedMeta) return undefined;

  try {
    return JSON.parse(formattedMeta);
  } catch {
    return formattedMeta;
  }
};

const normalizeLogInput = (
  colorOrPayload: LogColor | LooseLogPayload,
  categoria?: LogCategory,
  severidad?: LogSeverity,
  mensaje?: string,
  metadata?: unknown
): {
  color: LogColor;
  categoria: LogCategory;
  severidad: LogSeverity;
  mensaje: string;
  metadata?: unknown;
} => {
  if (isPlainObject(colorOrPayload)) {
    const payload = colorOrPayload;

    const normalizedColor = isLogColor(payload.color) ? payload.color : 'AZUL';

    const normalizedCategoria = safeLogText(
      payload.categoria ??
        payload.category ??
        payload.action_type ??
        payload.action ??
        'ESTADO_SISTEMA',
      'ESTADO_SISTEMA'
    ) as LogCategory;

    const normalizedSeveridad = isLogSeverity(payload.severidad)
      ? payload.severidad
      : isLogSeverity(payload.severity)
        ? payload.severity
        : 'INFO';

    const normalizedMensaje = safeLogText(
      payload.mensaje ??
        payload.message ??
        payload.details ??
        normalizedCategoria,
      normalizedCategoria
    );

    return {
      color: normalizedColor,
      categoria: normalizedCategoria,
      severidad: normalizedSeveridad,
      mensaje: normalizedMensaje,
      metadata: payload.metadata ?? payload.meta ?? metadata,
    };
  }

  return {
    color: isLogColor(colorOrPayload) ? colorOrPayload : 'AZUL',
    categoria: safeLogText(categoria, 'ESTADO_SISTEMA') as LogCategory,
    severidad: isLogSeverity(severidad) ? severidad : 'INFO',
    mensaje: safeLogText(mensaje, ''),
    metadata,
  };
};

export const setLoggerDB = (db: SQLite.SQLiteDatabase) => {
  dbInstance = db;
  void flushQueues();
};

const flushQueues = async () => {
  if (!dbInstance || isFlushing) return;

  isFlushing = true;

  try {
    if (logQueue.length > 0) {
      const toProcess = logQueue.splice(0, logQueue.length);
      const CHUNK_SIZE = 50;

      for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
        const chunk = toProcess.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');

        const values = chunk.flatMap((entry) => [
          entry.timestamp,
          entry.timestamp_str,
          entry.color,
          entry.categoria,
          entry.severidad,
          entry.mensaje,
          entry.metadata ?? null,
        ]);

        await dbInstance.runAsync(
          `INSERT INTO system_logs (timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata) VALUES ${placeholders}`,
          values as any[]
        );
      }
    }

    if (auditQueue.length > 0) {
      const toProcess = auditQueue.splice(0, auditQueue.length);
      const CHUNK_SIZE = 100;

      for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
        const chunk = toProcess.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');

        const values = chunk.flatMap((entry) => [
          entry.session_id,
          entry.action_type,
          entry.details,
          entry.timestamp,
        ]);

        await dbInstance.runAsync(
          `INSERT INTO audit_logs (session_id, action_type, details, timestamp) VALUES ${placeholders}`,
          values as any[]
        );
      }
    }
  } catch (e) {
    _output.error('❌ Error flushing logger queues:', e);
  } finally {
    isFlushing = false;
  }
};

const getIconByColor = (color: LogColor): string => {
  switch (color) {
    case 'VERDE':
      return '🟢';
    case 'AMARILLO':
      return '🟡';
    case 'NARANJA':
      return '🟠';
    case 'AZUL':
      return '🔵';
    case 'BLANCO':
      return '⚪';
    case 'GRIS':
      return '⚫';
    case 'ROJO':
      return '🔴';
    default:
      return '⚪';
  }
};

export const log = (
  colorOrPayload: LogColor | LooseLogPayload,
  categoria?: LogCategory,
  severidad?: LogSeverity,
  mensaje?: string,
  metadata?: unknown
): void => {
  const normalized = normalizeLogInput(
    colorOrPayload,
    categoria,
    severidad,
    mensaje,
    metadata
  );

  const now = dayjs();
  const formattedMeta = formatMetadata(normalized.metadata);

  const entry: SystemLogEntry = {
    timestamp: now.valueOf(),
    timestamp_str: now.format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
    color: normalized.color,
    categoria: normalized.categoria,
    severidad: normalized.severidad,
    mensaje: normalized.mensaje,
    metadata: formattedMeta ?? undefined,
  };

  const icon = getIconByColor(entry.color);
  const consoleMsg = `[${entry.timestamp_str}] ${icon} [${entry.categoria}] ${entry.mensaje}`;
  const consoleMeta = parseFormattedMetadata(formattedMeta);

  // Evita interrupciones en el árbol de renderizado de Expo.
  // Además evita imprimir metadata vacía como segundo argumento.
  if (entry.severidad === 'ERROR') {
    if (normalized.metadata instanceof Error) {
      _output.error(consoleMsg, normalized.metadata);
    } else if (consoleMeta !== undefined) {
      _output.error(consoleMsg, consoleMeta);
    } else {
      _output.error(consoleMsg);
    }
  } else if (entry.severidad === 'WARN') {
    if (consoleMeta !== undefined) {
      _output.warn(consoleMsg, consoleMeta);
    } else {
      _output.warn(consoleMsg);
    }
  } else {
    if (consoleMeta !== undefined) {
      _output.info(consoleMsg, consoleMeta);
    } else {
      _output.info(consoleMsg);
    }
  }

  if (dbInstance) {
    dbInstance
      .runAsync(
        `INSERT INTO system_logs (timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.timestamp,
          entry.timestamp_str,
          entry.color,
          entry.categoria,
          entry.severidad,
          entry.mensaje,
          entry.metadata ?? null,
        ]
      )
      .catch((e) => {
        _output.error('❌ Error saving system log:', e);
        logQueue.push(entry);
      });
  } else {
    logQueue.push(entry);
  }

  emitFeedbackFromLog(entry.severidad, entry.categoria, entry.mensaje);
};

export function logStructured(
  severidadOrPayload: LogSeverity | LooseLogPayload,
  categoria?: LogCategory,
  mensaje?: string,
  metadata?: unknown
): void {
  if (isPlainObject(severidadOrPayload)) {
    return log(severidadOrPayload);
  }

  return log(
    'AZUL',
    categoria ?? 'ESTADO_SISTEMA',
    severidadOrPayload,
    safeLogText(mensaje, ''),
    metadata
  );
}

export function logAudit(...args: unknown[]): void {
  const first = args[0];

  if (isPlainObject(first)) {
    const action = safeLogText(
      first.action_type ??
        first.action ??
        first.categoria ??
        first.category ??
        'AUDIT',
      'AUDIT'
    );

    const message = safeLogText(
      first.details ??
        first.mensaje ??
        first.message ??
        action,
      action
    );

    const sessionId =
      typeof first.session_id === 'number'
        ? first.session_id
        : typeof first.sessionId === 'number'
          ? first.sessionId
          : null;

    const timestamp =
      typeof first.timestamp === 'number' ? first.timestamp : dayjs().valueOf();

    const metadata = {
      ...first,
      session_id: sessionId,
      timestamp,
    };

    auditQueue.push({
      session_id: sessionId,
      action_type: action,
      details: message,
      timestamp,
    });

    void flushQueues();

    return log('AZUL', action as LogCategory, 'INFO', message, metadata);
  }

  const action = safeLogText(args[0], 'AUDIT');
  const message = safeLogText(args[1], action);
  const metadata = args.length > 2 ? args[2] : undefined;
  const timestamp = dayjs().valueOf();

  auditQueue.push({
    session_id: null,
    action_type: action,
    details: message,
    timestamp,
  });

  void flushQueues();

  return log('AZUL', action as LogCategory, 'INFO', message, metadata);
}

