// --- src/utils/logger.ts ---
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

// ✅ [P0-CRITICAL] Formato seguro de metadatos con manejo de Errores
const formatMetadata = (meta?: any): string | undefined => {
  if (!meta) return undefined;
  
  // Caso 1: Error objects - extraer propiedades manualmente (JSON.stringify no funciona)
  if (meta instanceof Error) {
    return JSON.stringify({
      message: meta.message,
      name: meta.name,
      code: (meta as any).code,
      // Stack truncado a 500 chars para no saturar BD
      stack: meta.stack ? meta.stack.substring(0, 500) : undefined
    });
  }
  
  // Caso 2: Objetos normales - truncar si exceden 1KB
  try {
    const stringified = JSON.stringify(meta);
    if (stringified.length > 1000) {
      return `${stringified.substring(0, 1000)}...[TRUNCATED]`;
    }
    return stringified;
  } catch (e) {
    // Fallback si JSON.stringify falla (circular references, etc)
    return `[Circular or Complex Object]`;
  }
};

// Vincula la DB al logger y procesa los pendientes
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

export const logAudit = async (entry: AuditLogEntry): Promise<void> => {
  if (dbInstance) {
    try {
      await dbInstance.runAsync(
        `INSERT INTO audit_logs (session_id, action_type, details, timestamp) VALUES (?, ?, ?, ?)`,
        [entry.session_id, entry.action_type, entry.details, entry.timestamp]
      );
    } catch (e) {
      _output.error('❌ Error saving audit log:', e);
      auditQueue.push(entry);
    }
  } else {
    auditQueue.push(entry);
  }
};

function safeSerializeMetadata(metadata: unknown): string | undefined {
  if (metadata === undefined) return undefined;
  try {
    if (metadata instanceof Error) {
      return JSON.stringify({ name: metadata.name, message: metadata.message, stack: metadata.stack }, null, 0);
    }
    return JSON.stringify(metadata);
  } catch {
    return '[unserializable-metadata]';
  }
}

function getIconByColor(color: LogColor): string {
  const icons: Record<LogColor, string> = {
    'VERDE': '🟢', 'AMARILLO': '🟡', 'NARANJA': '🟠', 'AZUL': '🔵', 'BLANCO': '⚪️', 'ROJO': '🔴'
  };
  return icons[color] || '•';
}

function levelToColor(level: LogSeverity): LogColor {
  switch (level) {
    case 'ERROR': return 'ROJO';
    case 'WARN': return 'AMARILLO';
    case 'EVENT': return 'NARANJA';
    case 'DEBUG': return 'BLANCO';
    default: return 'AZUL';
  }
}

export const logStructured = (
  level: LogSeverity,
  category: LogCategory,
  message: string,
  metadata?: LogMetadata
): void => {
  log(levelToColor(level), category, level, message, metadata);
};

export const log = (
  color: LogColor,
  categoria: LogCategory,
  severidad: LogSeverity,
  mensaje: string,
  metadata?: any
) => {
  const now = new Date();
  const timestamp = now.getTime();
  const timestamp_str = now.toISOString();

  // ✅ Usar formatMetadata en lugar de JSON.stringify directo
  const formattedMeta = formatMetadata(metadata);

  const entry: SystemLogEntry = {
    timestamp: now.valueOf(),
    timestamp_str: now.format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
    color,
    categoria,
    severidad,
    mensaje,
    metadata: formattedMeta
  };

  const icon = getIconByColor(color);
  const consoleMsg = `[${entry.timestamp_str}] ${icon} [${categoria}] ${mensaje}`;

  if (severidad === 'ERROR') _output.error(consoleMsg, metadata ?? '');
  else if (severidad === 'WARN') _output.warn(consoleMsg, metadata ?? '');
  else _output.info(consoleMsg, metadata ?? '');

  // ✅ CORRECCIÓN: Evita la Pantalla Roja de Expo para eventos de auditoría (como borrar un registro).
  // Solo lanza un console.error si realmente estamos pasando un objeto de Error real al metadata.
  if (severidad === 'ERROR' && metadata instanceof Error) {
    console.error(consoleMsg, metadata);
  } else if (severidad === 'WARN') {
    console.warn(consoleMsg, formattedMeta ? JSON.parse(formattedMeta) : '');
  } else {
    // Usamos console.log para todo lo demás, preservando tus colores e iconos, 
    // pero sin interrumpir el uso de la aplicación.
    console.log(consoleMsg, formattedMeta ? JSON.parse(formattedMeta) : '');
  }

  // Guardar en la DB o mandar a la cola si la DB no está lista
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
};
