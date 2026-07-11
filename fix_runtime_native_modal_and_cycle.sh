#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_TAG="backup/pre-runtime-native-fix-${TIMESTAMP}"
BACKUP_BRANCH="backup/main-pre-runtime-native-fix-${TIMESTAMP}"

echo "== Verificando repo limpio =="
if [ -n "$(git status --short)" ]; then
  git status --short
  echo "ERROR: El arbol Git no esta limpio. Haz commit/stash antes."
  exit 1
fi

echo "== Creando respaldo =="
git tag "$BACKUP_TAG"
git branch "$BACKUP_BRANCH"
echo "Backup tag: $BACKUP_TAG"
echo "Backup branch: $BACKUP_BRANCH"

echo "== Corrigiendo <div> en LuxuryUIContext.tsx =="
python - <<'PY'
from pathlib import Path
import re

p = Path("src/context/LuxuryUIContext.tsx")
if not p.exists():
    raise SystemExit("No existe src/context/LuxuryUIContext.tsx")

s = p.read_text()

before = s

# React Native no soporta <div>. Reemplazo conservador dentro de este archivo.
s = s.replace("<div", "<View")
s = s.replace("</div>", "</View>")

# Asegurar import de View desde react-native.
# Caso: import { Text, StyleSheet, ... } from 'react-native';
rn_import = re.search(r"import\s*\{([^}]+)\}\s*from\s*['\"]react-native['\"];", s, re.DOTALL)
if rn_import:
    names = [x.strip() for x in rn_import.group(1).replace("\n", " ").split(",") if x.strip()]
    if "View" not in names:
        names.insert(0, "View")
        new_import = "import { " + ", ".join(names) + " } from 'react-native';"
        s = s[:rn_import.start()] + new_import + s[rn_import.end():]
else:
    # Si no hay import agrupado de react-native, agregar uno.
    s = "import { View } from 'react-native';\n" + s

if s != before:
    p.write_text(s)
    print("UPDATED src/context/LuxuryUIContext.tsx")
else:
    print("OK src/context/LuxuryUIContext.tsx sin cambios")
PY

echo "== Buscando otros tags DOM incompatibles con React Native =="
DOM_HITS="$(grep -RIn --include='*.tsx' --include='*.ts' \
  -E '<(div|span|button|input|form|select|option|textarea)(\\s|>|/)|</(div|span|button|input|form|select|option|textarea)>' \
  app src || true)"

if [ -n "$DOM_HITS" ]; then
  echo "ATENCION: Se encontraron posibles tags DOM:"
  echo "$DOM_HITS"
  echo ""
  echo "El script corrigio LuxuryUIContext.tsx, pero revisa estos hits si aparecen."
else
  echo "OK: no se encontraron otros tags DOM obvios en app/src."
fi

echo "== Rompiendo ciclo logger -> logBridge -> feedbackAnalytics -> logger =="
python - <<'PY'
from pathlib import Path
import re

p = Path("src/feedback/feedbackAnalytics.ts")
if not p.exists():
    print("No existe src/feedback/feedbackAnalytics.ts; omitiendo.")
    raise SystemExit(0)

s = p.read_text()
before = s

# El objetivo es que feedbackAnalytics no importe logger.
# Si necesita debug interno, usar console.debug en DEV, no el logger central.
logger_import_pattern = re.compile(
    r"^\s*import\s+\{[^}]*\}\s+from\s+['\"]\.\./utils/logger['\"];\s*$",
    re.MULTILINE
)
s = logger_import_pattern.sub("", s)

if "feedbackAnalyticsTrace" not in s and ("log(" in s or "logStructured(" in s):
    s = (
        "const feedbackAnalyticsTrace = (...args: unknown[]) => {\n"
        "  if (typeof __DEV__ !== 'undefined' && __DEV__) {\n"
        "    console.debug('[feedbackAnalytics]', ...args);\n"
        "  }\n"
        "};\n\n"
    ) + s

# Reemplazar llamadas internas al logger por trace local para evitar ciclo.
s = re.sub(r"\blogStructured\s*\(", "feedbackAnalyticsTrace(", s)
s = re.sub(r"\blog\s*\(", "feedbackAnalyticsTrace(", s)

if s != before:
    p.write_text(s)
    print("UPDATED src/feedback/feedbackAnalytics.ts")
else:
    print("OK src/feedback/feedbackAnalytics.ts sin cambios")
PY

echo "== Buscando llamadas sospechosas al logger que generen [object Object] =="
grep -RIn --include='*.ts' --include='*.tsx' \
  -E "log\\([^\\n]*(\\{[^\\n]*\\}|Object|metadata|payload|event)" \
  app src || true

echo "== Validando TypeScript =="
npx tsc --noEmit

echo "== Validando lint =="
npm run lint

echo "== Ejecutando tests =="
npm run test

echo "== Ejecutando Gold Master =="
npm run gm

echo "== Commit si hay cambios =="
if [ -n "$(git status --short)" ]; then
  git status --short
  git add -A
  git commit -m "Fix native modal rendering and break logger feedback cycle"
else
  echo "No hay cambios para commit."
fi

echo ""
echo "OK: fix runtime aplicado y validado."
echo "Backup tag: $BACKUP_TAG"
echo "Backup branch: $BACKUP_BRANCH"
