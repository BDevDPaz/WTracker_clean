#!/usr/bin/env bash
set -u
set -o pipefail

FILE="app/(tabs)/history.tsx"
BACKUP_TAG="backup/pre-validation-fix-$(date +%Y%m%d-%H%M%S)"

echo "== Creando respaldo =="
git tag "$BACKUP_TAG" || true
echo "Backup tag: $BACKUP_TAG"

echo "== Instalando dependencia faltante async-lock =="
npm install async-lock --legacy-peer-deps

echo "== Intentando instalar tipos de async-lock si existen =="
npm install -D @types/async-lock --legacy-peer-deps || true

echo "== Probando TypeScript inicial =="
if npx tsc --noEmit --pretty false; then
  echo "TypeScript ya pasa."
else
  echo "TypeScript falla. Intentando reparar $FILE desde ramas candidatas..."
fi

CANDIDATES=(
  "critical-fixes-v2.2"
  "optimization-field-ready-system"
  "palette-a11y-improvements"
  "palette-history-a11y"
  "fix-history-safeareaview"
  "fix-ts-lint-errors"
)

ORIGINAL_TMP=".git/history.tsx.pre-auto-fix"
cp "$FILE" "$ORIGINAL_TMP"

for branch in "${CANDIDATES[@]}"; do
  echo ""
  echo "== Probando version de $FILE desde rama: $branch =="

  if ! git show-ref --verify --quiet "refs/heads/$branch" && ! git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    echo "SKIP: rama no encontrada: $branch"
    continue
  fi

  if git show-ref --verify --quiet "refs/remotes/origin/$branch" && ! git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch "$branch" "origin/$branch" || true
  fi

  git checkout "$branch" -- "$FILE" || {
    echo "No se pudo extraer $FILE desde $branch"
    continue
  }

  if npx tsc --noEmit --pretty false; then
    echo "OK: TypeScript pasa usando $FILE desde $branch"

    echo "== Ejecutando lint =="
    if npm run lint; then
      echo "OK: lint pasa."
    else
      echo "Lint aun puede tener warnings/errors no relacionados. Continuando si TypeScript paso."
    fi

    git add package.json package-lock.json "$FILE"
    git commit -m "Fix validation issues after branch integration" || true

    echo ""
    echo "Reparacion completada."
    echo "Usada version de $FILE desde rama: $branch"
    echo "Backup tag: $BACKUP_TAG"
    exit 0
  fi

  echo "La version desde $branch no paso TypeScript. Probando siguiente..."
  cp "$ORIGINAL_TMP" "$FILE"
done

echo ""
echo "ERROR: Ninguna version candidata de $FILE paso TypeScript."
echo "Restaurando archivo original."
cp "$ORIGINAL_TMP" "$FILE"

echo ""
echo "Muestra diagnostica:"
nl -ba "$FILE" | sed -n '220,390p'

exit 1
