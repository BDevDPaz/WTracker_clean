#!/usr/bin/env bash
set -euo pipefail

SOURCE="$HOME/gh_reps/LEDTracker"
TARGET="$HOME/gh_reps/cleans/WTracker_clean"

cd "$TARGET"

echo "== Validando rutas =="
[ -d "$SOURCE" ] || { echo "No existe SOURCE: $SOURCE"; exit 1; }
[ -d "$TARGET" ] || { echo "No existe TARGET: $TARGET"; exit 1; }

echo "== Creando tag de respaldo antes de restaurar archivos GM =="
BACKUP_TAG="backup/pre-gm-file-restore-$(date +%Y%m%d-%H%M%S)"
git tag "$BACKUP_TAG" || true
echo "Backup tag: $BACKUP_TAG"

echo "== Restaurando archivos validados desde Gold Master =="

cp "$SOURCE/app/(tabs)/history.tsx" "$TARGET/app/(tabs)/history.tsx"
cp "$SOURCE/app/(tabs)/legal.tsx" "$TARGET/app/(tabs)/legal.tsx"
cp "$SOURCE/app/_layout.tsx" "$TARGET/app/_layout.tsx"

cp "$SOURCE/src/services/BackgroundTasks.ts" "$TARGET/src/services/BackgroundTasks.ts"
cp "$SOURCE/src/services/LocationManager.ts" "$TARGET/src/services/LocationManager.ts"
cp "$SOURCE/src/services/ReportGenerator.ts" "$TARGET/src/services/ReportGenerator.ts"

cp "$SOURCE/src/utils/logger.ts" "$TARGET/src/utils/logger.ts"

cp "$SOURCE/package.json" "$TARGET/package.json"
cp "$SOURCE/package-lock.json" "$TARGET/package-lock.json"

echo "== Instalando dependencias con lock restaurado =="
npm install --legacy-peer-deps

echo "== Estado Git despues de restaurar =="
git status --short

echo "== Validando TypeScript =="
npx tsc --noEmit

echo "== Validando lint =="
npm run lint

echo "== Ejecutando tests =="
npm run test

echo "== Commit de reparacion =="
git add \
  package.json \
  package-lock.json \
  "app/(tabs)/history.tsx" \
  "app/(tabs)/legal.tsx" \
  app/_layout.tsx \
  src/services/BackgroundTasks.ts \
  src/services/LocationManager.ts \
  src/services/ReportGenerator.ts \
  src/utils/logger.ts

git commit -m "Restore Gold Master validated files after integration" || true

echo ""
echo "OK: restauracion GM completada."
echo "Backup tag: $BACKUP_TAG"
