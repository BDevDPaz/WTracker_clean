const fs = require('fs');
const dbPath = 'src/database/db.ts';
const backupPath = 'src/database/db.ts.bak';

if (!fs.existsSync(backupPath)) {
  console.error('No se encontró src/database/db.ts.bak. Abortando.');
  process.exit(1);
}

console.log('Restaurando backup original...');
fs.copyFileSync(backupPath, dbPath);
let content = fs.readFileSync(dbPath, 'utf8');

// 1. Inyectar helpers y actualizar firma
const signatureRegex = /export const updateSessionStatus = async \(\s*id:\s*number,\s*status:\s*SessionStatus,\s*lunchMinutes:\s*number\s*=\s*0\s*\)\s*=>\s*\{/;

const helpers = `type CheckoutSource = 'manual' | 'gps' | 'failsafe';

const getCheckoutAuditAction = (
  status: SessionStatus,
  source: CheckoutSource
): string => {
  if (status !== 'completed') return AUDIT_ACTIONS.MANUAL;
  if (source === 'gps') return AUDIT_ACTIONS.AUTO_CHECKOUT_GPS;
  if (source === 'failsafe') return AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE;
  return AUDIT_ACTIONS.MANUAL_CHECKOUT;
};

const getCheckoutDetails = (
  status: SessionStatus,
  source: CheckoutSource,
  lunchMinutes: number
): string => {
  const lunchDetails = lunchMinutes > 0 ? \` con \${lunchMinutes}m de almuerzo\` : '';
  if (status !== 'completed') return \`Estado de la sesión actualizado a \${status}\`;
  if (source === 'gps') return \`Auto Check-out GPS registrado\${lunchDetails}\`;
  if (source === 'failsafe') return \`Auto Check-out Failsafe registrado\${lunchDetails}\`;
  return \`Manual Check-out registrado\${lunchDetails}\`;
};

export const updateSessionStatus = async (
  id: number,
  status: SessionStatus,
  lunchMinutes: number = 0,
  source: CheckoutSource = 'manual'
) => {`;

content = content.replace(signatureRegex, helpers);

// 2. Reemplazo estricto del bloque logAudit original (sin afectar el código de BD)
const logAuditRegex = /const lunchDetails = lunchMinutes > 0[\s\S]*?nowMs\(\)\s*,?\s*\}\);/;
const newLogAudit = `await logAudit({
  session_id: id,
  action_type: getCheckoutAuditAction(status, source),
  details: getCheckoutDetails(status, source, lunchMinutes),
  timestamp: nowMs(),
});`;

content = content.replace(logAuditRegex, newLogAudit);

fs.writeFileSync(dbPath, content, 'utf8');
console.log('¡db.ts reparado con éxito! Se preservó la lógica de la Base de Datos.');
