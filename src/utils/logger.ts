import * as SQLite from 'expo-sqlite';
import {
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
  error: console.error.bind(console)
};

export const AUDIT_ACTIONS = {
  AUTO_CHECKIN: 'AUTO_CHECKIN',
  AUTO_CHECKOUT: 'AUTO_CHECKOUT',
  MANUAL: 'MANUAL',
  OVERLAP: 'OVERLAP',
  MUTEX: 'MUTEX',
  LOCATION: 'LOCATION',
  PDF: 'PDF',
  PAYROLL: 'PAYROLL',
  GEOFENCE_EXIT: 'GEOFENCE_EXIT',
  AUTO_CHECKIN_GPS: 'AUTO_CHECKIN_GPS',
  AUTO_CHECKOUT_GPS: 'AUTO_CHECKOUT_GPS'
} as const;

export interface AuditLogEntry {
  session_id: number | null;
  action_type: string;
  details: string;
  timestamp: number;
}

// ✅ [P0-CRITICAL] Formato seguro de metadatos con manejo de Errores y mitigación de desbordamiento en BD
const formatMetadata = (meta?: any): string | undefined => {
  if (!meta) return undefined;

  // Caso 1: Error objects - extraer propiedades manualmente (JSON.stringify por defecto los deja vacíos)
  if (meta instanceof Error) {
    return JSON.stringify({
      message: meta.message,
      name: meta.name,
      code: (meta as any).code,
      // Stack truncado a 500 chars para no saturar la base de datos
      stack: meta.stack ? meta.stack.substring(0, 500) : undefined
    });
  }

  // Caso 2: Objetos normales - truncar si exceden 1KB para prevenir picos de memoria
  try {
    const stringified = JSON.stringify(meta);
    if (stringified.length > 1000) {
      return `${stringified.substring(0, 1000)}...[TRUNCATED]`;
    }
    return stringified;
  } catch (e) {
    // Fallback si JSON.stringify falla por referencias circulares
    return `[Circular or Complex Object]`;
  }
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
          values as any
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
          values as any
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
    case 'VERDE': return '🟢';
    case 'AMARILLO': return '🟡';
    case 'NARANJA': return '🟠';
    case 'AZUL': return '🔵';
    case 'BLANCO': return '⚪';
    case 'ROJO': return '🔴';
    default: return '⚪';
  }
};

export const log = (
  color: LogColor,
  categoria: LogCategory,
  severidad: LogSeverity,
  mensaje: string,
  metadata?: any
): void => {
  const now = dayjs();
  const formattedMeta = formatMetadata(metadata);

  const entry: SystemLogEntry = {
    timestamp: now.valueOf(),
    timestamp_str: now.format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
    color,
    categoria,
    severidad,
    mensaje,
    metadata: formattedMeta ?? undefined,
  };

  const icon = getIconByColor(color);
  const consoleMsg = `[${entry.timestamp_str}] ${icon} [${categoria}] ${mensaje}`;

  // Evita interrupciones en el árbol de renderizado de Expo (Pantallas Rojas invasivas)
  if (severidad === 'ERROR') {
    if (metadata instanceof Error) {
      _output.error(consoleMsg, metadata);
    } else {
      _output.error(consoleMsg, formattedMeta ? JSON.parse(formattedMeta) : '');
    }
  } else if (severidad === 'WARN') {
    _output.warn(consoleMsg, formattedMeta ? JSON.parse(formattedMeta) : '');
  } else {
    _output.info(consoleMsg, formattedMeta ? JSON.parse(formattedMeta) : '');
  }

  if (dbInstance) {
    dbInstance.runAsync(
      `INSERT INTO system_logs (timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry.timestamp, entry.timestamp_str, entry.color, entry.categoria, entry.severidad, entry.mensaje, entry.metadata ?? null]
    ).catch(e => {
       _output.error('❌ Error saving system log:', e);
       logQueue.push(entry);
    });
  } else {
    logQueue.push(entry);
  }

  emitFeedbackFromLog(severidad, categoria, mensaje);
};


export function logStructured(
  severidad: string,
  categoria: string,
  mensaje: string,
  metadata?: unknown
) {
  return log('AZUL', categoria as Parameters<typeof log>[1], severidad as Parameters<typeof log>[2], mensaje, metadata);
}


export function logAudit(...args: unknown[]) {
  const action = String(args[0] ?? 'AUDIT');
  const message = String(args[1] ?? action);
  const metadata = args.length > 2 ? args[2] : undefined;
  return log('AZUL', action as Parameters<typeof log>[1], 'INFO' as Parameters<typeof log>[2], message, metadata);
}

