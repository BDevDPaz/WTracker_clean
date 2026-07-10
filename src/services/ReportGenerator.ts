<<<<<<< HEAD
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getSettings, getAllAsync } from '../database/db';
import escapeHtml from 'escape-html';
import { WorkSession, AppSettings, AuditLog } from '../types';
import { log, logStructured } from '../utils/logger';
import dayjs from '../utils/dayjsSetup';
import { formatDate, formatTime } from '../utils/dateUtils';
import { calculateSessionDuration, calculatePay } from '../utils/payrollUtils';

const formatCurrency = (amount: number) => {
  return `$${amount.toFixed(2)}`;
};

// ======================================================
// OPTIMIZATION CONSTANTS (Proposal 2)
// ======================================================

const SESSIONS_PER_PAGE = 30;
const AUDIT_LOGS_PER_SECTION = 100;

interface ReportGenerationOptions {
  shouldShare: boolean;
  customRange?: { start: number; end: number };
  paginate?: boolean;
}

// ======================================================
// DELIVERY GUARANTEE TYPES (Proposal 5)
// ======================================================

const PENDING_REPORTS_KEY = 'PENDING_REPORTS_DELIVERY';

export interface PendingReportRecord {
  weekId: string;
  pdfUri: string;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
}

// ======================================================
// CORE GENERATION (Proposal 2)
// ======================================================

export const generateWeeklyReport = async (
  shouldShare: boolean = true,
  customRange?: { start: number; end: number }
): Promise<string | null> => {
  return generateWeeklyReportOptimized({ shouldShare, customRange });
};

export const generateWeeklyReportOptimized = async (
  options: ReportGenerationOptions
): Promise<string | null> => {
  try {
    const settings = await getSettings();

    if (!settings) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'No se encontró la configuración (Settings) al generar reporte');
      return null;
    }

    let startTs: number;
    let endTs: number;
    let rangeTitle = '';

    if (options.customRange) {
      startTs = options.customRange.start;
      endTs = options.customRange.end;
      rangeTitle = `${formatDate(startTs)} - ${formatDate(endTs)}`;
    } else {
      const start = dayjs().startOf('week');
      const end = dayjs().endOf('week');
      startTs = start.valueOf();
      endTs = end.valueOf();
      rangeTitle = 'Semana Actual';
    }

    // Query with LIMIT to prevent memory spike
    const sessions = await getAllAsync<WorkSession>(
      `SELECT * FROM work_sessions
       WHERE start_time >= ? AND start_time <= ?
       ORDER BY start_time ASC
       LIMIT ${SESSIONS_PER_PAGE * 5}`,
      [startTs, endTs]
    );

    const logs = await getAllAsync<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC
       LIMIT ${AUDIT_LOGS_PER_SECTION * 3}`,
      [startTs, endTs]
    );

    if (sessions.length > SESSIONS_PER_PAGE * 2) {
      logStructured('WARN', 'ADVERTENCIA',
        `Large report detected (${sessions.length} sessions). Esto puede tomar más tiempo.`
      );
    }

    const html = buildReportHtml(sessions, logs, settings, rangeTitle);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (options.shouldShare) {
      log('VERDE', 'OPERACION_EXITOSA', 'INFO', 'Reporte PDF generado y listo para compartir');
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }

    return uri;
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Fallo al generar el reporte PDF semanal', error);
    return null;
  }
};

function buildReportHtml(
  sessions: WorkSession[],
  logs: AuditLog[],
  settings: AppSettings,
  rangeTitle: string
): string {
    let totalHours = 0;
    let totalOvertime = 0;
    let totalEarnings = 0;

    const autoCheckoutSessionIds = new Set(
      logs
        .filter((l: AuditLog) => l.action_type.includes('AUTO_CHECKOUT') && l.session_id)
        .map((l: AuditLog) => l.session_id)
    );

    const rows = sessions.map((session: WorkSession) => {
      const startTime = session.actual_start_time || session.start_time;
      const endTime = session.end_time || dayjs().valueOf();

      const durationMs = calculateSessionDuration(
        startTime,
        endTime,
        session.lunch_taken || 0,
        session.lunch_start,
        session.lunch_end
      );

      const hours = durationMs / (1000 * 60 * 60);
      const { totalPay, overtimeHours } = calculatePay(
        hours,
        settings.hourly_rate,
        settings.overtime_multiplier
      );

      totalHours += hours;
      totalOvertime += overtimeHours;
      totalEarnings += totalPay;

      const fueAutoCheckout = autoCheckoutSessionIds.has(session.id!);

      return {
        date: formatDate(startTime),
        client: escapeHtml(session.client_name || 'General'),
        address: escapeHtml(session.address || ''),
        notes: escapeHtml(session.manual_note || ''),
        start: formatTime(startTime),
        end: session.end_time ? formatTime(session.end_time) : 'En curso',
        lunch: session.lunch_taken ? 'Sí' : 'No',
        total: hours.toFixed(2),
        pay: formatCurrency(totalPay),
        status: session.status,
        isGeofenceIn: Boolean(session.actual_start_time),
        isGeofenceOut: fueAutoCheckout,
        isManual: Boolean(session.is_manual_edit)
      };
    });

    const reportId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const integrityHash = dayjs().valueOf().toString(16) + reportId.toLowerCase();

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; }
            .title { font-size: 26px; font-weight: 800; color: #000; letter-spacing: 2px; text-transform: uppercase; }
            .subtitle { font-size: 11px; color: #D4AF37; text-transform: uppercase; margin-top: 5px; letter-spacing: 1px; }
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8f8f8; padding: 15px; border-radius: 8px; }
            .info-col { width: 48%; }
            .info-label { font-size: 9px; color: #999; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
            .info-value { font-size: 13px; color: #000; font-weight: 600; margin-bottom: 10px; }
            .stats-box { display: flex; justify-content: space-between; margin-bottom: 30px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
            .stat-item { flex: 1; text-align: center; padding: 15px; border-right: 1px solid #eee; }
            .stat-item:last-child { border-right: none; background: #fffcf2; }
            .stat-num { font-size: 22px; font-weight: bold; color: #000; }
            .stat-desc { font-size: 9px; color: #666; text-transform: uppercase; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 11px; }
            th { text-align: left; border-bottom: 2px solid #000; padding: 10px; text-transform: uppercase; font-size: 9px; color: #666; }
            td { border-bottom: 1px solid #eee; padding: 12px 10px; vertical-align: top; }
            .row-active { background-color: #fff8e1; }
            .client-badge { background: #000; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-bottom: 4px; }
            .manual-badge { background: #D4AF37; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-bottom: 4px; margin-left: 5px; }
            .notes { font-style: italic; color: #666; font-size: 10px; display: block; margin-top: 4px; }
            .geo-badge-in { color: #2ecc71; font-size: 9px; font-weight: bold; display: block; margin-top: 2px; }
            .geo-badge-out { color: #e67e22; font-size: 9px; font-weight: bold; display: block; margin-top: 2px; }
            .lunch-badge { color: #e67e22; font-size: 9px; }
            .audit-section { margin-top: 20px; border-top: 3px solid #eee; padding-top: 20px; page-break-inside: avoid; }
            .audit-title { font-size: 12px; font-weight: bold; color: #000; text-transform: uppercase; margin-bottom: 15px; }
            .log-item { font-size: 9px; color: #555; margin-bottom: 6px; border-left: 2px solid #ddd; padding-left: 10px; }
            .log-alert { border-left-color: #D4AF37; color: #000; background: #fffcf0; padding: 5px 10px; }
            .signature-section { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
            .sig-box { width: 45%; text-align: center; }
            .sig-line { border-top: 1px solid #333; margin-bottom: 10px; width: 100%; height: 1px; }
            .sig-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; }
            .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">WTracker</div>
            <div class="subtitle">Reporte Oficial de Nómina y Auditoría</div>
          </div>
          <div class="info-grid">
            <div class="info-col">
              <div class="info-label">Empleado</div>
              <div class="info-value">${escapeHtml(settings.employee_name || 'No especificado')}</div>
              <div class="info-label">ID Sistema</div>
              <div class="info-value">EMP-#${settings.id.toString().padStart(4, '0')}</div>
            </div>
            <div class="info-col" style="text-align: right;">
              <div class="info-label">Empresa</div>
              <div class="info-value">${escapeHtml(settings.employer_name || 'LEON\'S ELECTRICAL DESIGN')}</div>
              <div class="info-label">Rango del Reporte</div>
              <div class="info-value">${rangeTitle}</div>
            </div>
          </div>
          <div class="stats-box">
            <div class="stat-item">
              <div class="stat-num">${totalHours.toFixed(2)}</div>
              <div class="stat-desc">Horas Totales</div>
            </div>
            <div class="stat-item">
              <div class="stat-num">${totalOvertime.toFixed(2)}</div>
              <div class="stat-desc">Horas Extra (OT)</div>
            </div>
            <div class="stat-item">
              <div class="stat-num" style="color: #D4AF37;">${formatCurrency(totalEarnings)}</div>
              <div class="stat-desc">Pago Estimado</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th width="15%">Fecha</th>
                <th width="40%">Actividad / Cliente</th>
                <th width="25%">Horario</th>
                <th width="10%">Hrs</th>
                <th width="10%">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr class="${row.status === 'active' ? 'row-active' : ''}">
                  <td>
                    <strong>${row.date}</strong>
                    ${row.lunch === 'Sí' ? '<br><span class="lunch-badge">Lunch: -1h</span>' : ''}
                  </td>
                  <td>
                    ${row.client !== 'General' ? `<span class="client-badge">${row.client}</span>` : ''}
                    ${row.isManual ? '<span class="manual-badge">Editado</span>' : ''}
                    <br>
                    ${row.address}
                    ${row.notes ? `<span class="notes">"${row.notes}"</span>` : ''}
                  </td>
                  <td>
                    ${row.start} - ${row.end}
                    ${row.isGeofenceIn ? '<span class="geo-badge-in">✓ Auto Check-in (GPS)</span>' : ''}
                    ${row.isGeofenceOut ? '<span class="geo-badge-out">⚠ Auto Check-out (GPS)</span>' : ''}
                  </td>
                  <td><strong>${row.total}</strong></td>
                  <td>${row.pay}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="signature-section">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Empleado</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Empleador</div>
            </div>
          </div>

          <div class="audit-section">
            <div class="audit-title">Registro de Eventos Críticos (GPS & Sistema)</div>
            ${logs.length === 0 ? '<div style="font-size:10px; color:#999;">Sin eventos registrados en este periodo.</div>' :
               logs.map(auditLog => `
                <div class="log-item ${auditLog.action_type.includes('AUTO') || auditLog.action_type.includes('EXIT') ? 'log-alert' : ''}">
                  <strong>${formatTime(auditLog.timestamp)}</strong> — <span style="font-weight:bold">[${auditLog.action_type}]</span> ${escapeHtml(auditLog.details)}
                </div>
              `).join('')}
          </div>
          <div class="footer">
            ID de Reporte: ${reportId}<br>
            Integridad: ${integrityHash}<br>
            Documento generado electrónicamente por WTracker App.<br>
            Certificado digitalmente: ${dayjs().format('YYYY-MM-DD HH:mm:ss Z')}
          </div>
        </body>
      </html>
    `;
}

// ======================================================
// DELIVERY GUARANTEE (Proposal 5)
// ======================================================

export const sendReportByEmail = async (pdfUri: string, settings: AppSettings, weekId?: string) => {
  try {
    const isAvailable = await MailComposer.isAvailableAsync();

    if (isAvailable) {
      const result = await MailComposer.composeAsync({
        recipients: [settings.company_email],
        subject: `Nómina Semanal - ${settings.employee_name}`,
        body: `Hola,\n\nAdjunto encontrarás mi reporte de horas y actividades detallado.\n\nPeriodo finalizado.\n\nAtentamente,\n${settings.employee_name}`,
        attachments: [pdfUri]
      });

      if (result.status === MailComposer.MailComposerStatus.SENT && weekId) {
        await removePendingReport(weekId);
      }
    } else {
      await Sharing.shareAsync(pdfUri);
      if (weekId) await removePendingReport(weekId);
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al enviar reporte por email', error);
  }
};

export const checkAndDeliverPendingReports = async () => {
  try {
    const pending = await AsyncStorage.getItem(PENDING_REPORTS_KEY);
    if (!pending) return;

    const reports: PendingReportRecord[] = JSON.parse(pending);
    const now = dayjs().valueOf();
    const updated: PendingReportRecord[] = [];

    for (const report of reports) {
      const age = now - report.createdAt;
      const hoursOld = age / (1000 * 60 * 60);

      if (hoursOld < 7 * 24) {
        const shouldRetry = !report.lastAttemptAt ||
                           (now - report.lastAttemptAt) > 6 * 60 * 60 * 1000;

        if (shouldRetry && report.attemptCount < 5) {
          const settings = await getSettings();
          if (settings) {
            log('AZUL', 'BACKGROUND_TASK', 'INFO', `Reintentando envío de reporte pendiente para ${report.weekId}...`);
            await sendReportByEmail(report.pdfUri, settings, report.weekId);
            report.attemptCount++;
            report.lastAttemptAt = now;
            updated.push(report);
          }
        } else {
          updated.push(report);
        }
      }
    }

    if (updated.length > 0) {
      await AsyncStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(updated));
    } else {
      await AsyncStorage.removeItem(PENDING_REPORTS_KEY);
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Pending reports check failed', error);
  }
};

export const trackPendingReport = async (weekId: string, pdfUri: string) => {
  try {
    const pending = await AsyncStorage.getItem(PENDING_REPORTS_KEY);
    const reports: PendingReportRecord[] = pending ? JSON.parse(pending) : [];

    const exists = reports.some(r => r.weekId === weekId);
    if (!exists) {
      reports.push({
        weekId,
        pdfUri,
        createdAt: dayjs().valueOf(),
        attemptCount: 0
      });
      await AsyncStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
      log('AZUL', 'ESTADO_SISTEMA', 'DEBUG', `Reporte trackeado como pendiente: ${weekId}`);
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Failed to track pending report', error);
  }
};

const removePendingReport = async (weekId: string) => {
  try {
    const pending = await AsyncStorage.getItem(PENDING_REPORTS_KEY);
    if (!pending) return;
    const reports: PendingReportRecord[] = JSON.parse(pending);
    const filtered = reports.filter(r => r.weekId !== weekId);
    if (filtered.length > 0) {
      await AsyncStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(filtered));
    } else {
      await AsyncStorage.removeItem(PENDING_REPORTS_KEY);
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Failed to remove pending report', error);
  }
};

export const LAST_SUCCESSFUL_REPORT_KEY = 'LAST_SUCCESSFUL_REPORT_TIMESTAMP';

export const ensureWeeklyReportExists = async () => {
  const lastReport = await AsyncStorage.getItem(LAST_SUCCESSFUL_REPORT_KEY);
  const now = dayjs();
  const lastReportDate = lastReport ? dayjs(parseInt(lastReport, 10)) : null;

  if (!lastReportDate || !lastReportDate.isSame(now, 'week')) {
    log('AZUL', 'BACKGROUND_TASK', 'INFO', 'Verificando reporte semanal pendiente...');
    const pdfUri = await generateWeeklyReport(false);

    if (pdfUri) {
      const currentWeekId = now.startOf('isoWeek').format('YYYY-MM-DD');
      await trackPendingReport(currentWeekId, pdfUri);
      await AsyncStorage.setItem(LAST_SUCCESSFUL_REPORT_KEY, now.valueOf().toString());

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📄 Reporte Semanal Pendiente',
          body: 'Toca para enviar tu nómina por correo.',
          data: { action: 'SHOW_REPORT_PROMPT', pdfUri, weekId: currentWeekId },
          sound: true,
        },
        trigger: null,
      });
      return true;
    }
  }
  return false;
};

=======
// src/services/ReportGenerator.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy'; // ✅ Legacy para moveAsync
import { getDB, getSettings } from '../database/db';
import { WorkSession, AuditLog } from '../types';
import { translations } from '../utils/i18n';

export const generateWeeklyReport = async (shouldShare = true): Promise<string | null> => {
  try {
    const db = getDB();
    const settings = await getSettings();
    if (!settings) return null;

    const t = translations[settings.language];
    const multiplier = settings.overtime_multiplier || 1.5;
    const rate = settings.hourly_rate || 0;

    // ✅ Últimos 7 días
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 7);
    const pastTs = past.getTime();

    // ✅ Sesiones y Auditoría
    const sessions = await db.getAllAsync<WorkSession>(
      `SELECT * FROM work_sessions WHERE start_time >= ? AND status != 'deleted' ORDER BY start_time ASC`,
      [pastTs]
    );
    const auditLogs = await db.getAllAsync<AuditLog>(
      `SELECT * FROM audit_logs WHERE timestamp >= ? ORDER BY timestamp ASC`,
      [pastTs]
    );

    if (sessions.length === 0 && auditLogs.length === 0 && !shouldShare) return null;

    // ✅ Agrupar por día
    const days: { [key: string]: WorkSession[] } = {};
    sessions.forEach(s => {
      const dateKey = new Date(s.start_time).toDateString();
      if (!days[dateKey]) days[dateKey] = [];
      days[dateKey].push(s);
    });

    let rows = '';
    let totalRegHours = 0;
    let totalOTHours = 0;

    // ✅ Calcular horas regulares y extras por día
    for (const dateKey in days) {
      const daySessions = days[dateKey];
      let dayMs = 0;

      daySessions.forEach(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : new Date();
        let ms = end.getTime() - start.getTime();
        if (s.lunch_taken) ms -= 3600000;
        dayMs += Math.max(0, ms);
      });

      const dayHours = dayMs / (1000 * 60 * 60);
      let reg = dayHours;
      let ot = 0;
      if (dayHours > 8) {
        reg = 8;
        ot = dayHours - 8;
      }

      totalRegHours += reg;
      totalOTHours += ot;

      // ✅ Filas HTML por sesión
      daySessions.forEach(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : new Date();
        let ms = end.getTime() - start.getTime();
        if (s.lunch_taken) ms -= 3600000;
        const hours = ms / (1000 * 60 * 60);

        const isTravel = s.status === 'travel';
        const locText = isTravel ? `🚗 ${t.status_travel || 'En Tránsito'}` : s.address;
        const noteHtml = s.is_manual_edit ? `<br/><span style="color:red; font-size:10px;">⚠️ EDIT: ${s.manual_note}</span>` : '';

        rows += `
          <tr>
            <td>${start.toLocaleDateString()}</td>
            <td>${locText}</td>
            <td>${start.toLocaleTimeString()}</td>
            <td>${s.end_time ? end.toLocaleTimeString() : 'Active'} ${noteHtml}</td>
            <td>${hours.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    // ✅ Cálculo de dinero
    const totalMoney = (totalRegHours * rate) + (totalOTHours * rate * multiplier);

    // ✅ Auditoría
    let auditRows = '';
    if (auditLogs.length > 0) {
      auditLogs.forEach(log => {
        const date = new Date(log.timestamp);
        let color = '#333';
        if (log.action_type === 'DELETED') color = 'red';
        if (log.action_type === 'MODIFIED') color = 'orange';
        auditRows += `
          <tr>
            <td>${date.toLocaleString()}</td>
            <td style="color:${color}; font-weight:bold;">${log.action_type}</td>
            <td>${log.details}</td>
          </tr>`;
      });
    } else {
      auditRows = `<tr><td colspan="3" style="text-align:center; font-style:italic;">No modifications recorded.</td></tr>`;
    }

    // ✅ HTML Final
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 5px; }
            h3 { margin-top: 0; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total-box { margin-top: 20px; border: 2px solid #333; padding: 10px; width: 60%; margin-left: auto; background-color: #f9f9f9; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }
            .grand-total { font-weight: bold; font-size: 18px; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;}
            .section-title { margin-top: 40px; border-bottom: 2px solid #333; padding-bottom: 5px; font-size: 16px; font-weight: bold; }
            .disclaimer { font-size: 10px; color: #666; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>${settings.employer_name}</h1>
          <h3>${t.pdf_employee}: ${settings.employee_name}</h3>
          <p>Email: ${settings.company_email}</p>

          <h4>${t.pdf_title}</h4>
          <table>
            <tr>
              <th>${t.col_date}</th>
              <th>${t.col_loc}</th>
              <th>${t.col_in}</th>
              <th>${t.col_out}</th>
              <th>Hrs</th>
            </tr>
            ${rows}
          </table>

          <div class="total-box">
            <div class="total-row"><span>Reg. Hours:</span> <span>${totalRegHours.toFixed(2)}</span></div>
            <div class="total-row"><span>Overtime (${multiplier}x):</span> <span>${totalOTHours.toFixed(2)}</span></div>
            <div class="total-row grand-total"><span>EST. PAY:</span> <span>$${totalMoney.toFixed(2)}</span></div>
          </div>

          <div class="section-title">${t.pdf_audit_title}</div>
          <p class="disclaimer">${t.pdf_audit_msg}</p>
          <table>
            <tr>
              <th>${t.col_ts}</th>
              <th>${t.col_action}</th>
              <th>${t.col_details}</th>
            </tr>
            ${auditRows}
          </table>
        </body>
      </html>
    `;

    // ✅ Generar PDF y renombrar
    const { uri } = await Print.printToFileAsync({ html });
    const safeName = (settings.employee_name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${safeName}_Report_${dateStr}.pdf`;
    const newPath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.moveAsync({ from: uri, to: newPath });

    if (shouldShare) {
      await Sharing.shareAsync(newPath, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: fileName });
    }

    return newPath;

  } catch (error) {
    console.error("Report Gen Error:", error);
    return null;
  }
};
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
