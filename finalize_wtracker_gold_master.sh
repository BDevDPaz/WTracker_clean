#!/usr/bin/env bash

set -euo pipefail

# ============================================================
# WTracker Clean - Final Gold Master cleanup/integration script
#
# Ejecutar desde:
#   ~/gh_reps/cleans/WTracker_clean
#
# Uso:
#   chmod +x finalize_wtracker_gold_master.sh
#   ./finalize_wtracker_gold_master.sh
#
# Opcional:
#   AUTO_PUSH=1 ./finalize_wtracker_gold_master.sh
#   LEDTRACKER_PATH=~/gh_reps/LEDTracker ./finalize_wtracker_gold_master.sh
#
# Este script:
# - Crea respaldo.
# - Elimina scripts temporales de integración.
# - Preserva startMonitoringArrival como API principal.
# - Mantiene startMonitoring como alias retrocompatible.
# - Normaliza locationAdapter y tipos.
# - Ejecuta npm run gm.
# - Hace commit si hay cambios.
# ============================================================

AUTO_PUSH="${AUTO_PUSH:-0}"
LEDTRACKER_PATH="${LEDTRACKER_PATH:-$HOME/gh_reps/LEDTracker}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

LOG_DIR=".git/maintenance-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/finalize-gold-master-${TIMESTAMP}.log"

BACKUP_TAG="backup/pre-final-gm-cleanup-${TIMESTAMP}"
BACKUP_BRANCH="backup/main-pre-final-gm-cleanup-${TIMESTAMP}"

HELPER_SCRIPTS=(
  "fix_integration_validation.sh"
  "merge_wtracker_branches.sh"
  "restore_gm_validation_files.sh"
)

IMPORTANT_FILES=(
  "src/services/LocationManager.ts"
  "src/engine/effects/workTrackerEffects.ts"
  "src/runtime/locationAdapter.ts"
  "src/types/index.ts"
)

log() {
  echo "$1" | tee -a "$LOG_FILE"
}

section() {
  log ""
  log "============================================================"
  log "$1"
  log "============================================================"
}

die() {
  log "ERROR: $1"
  exit 1
}

run() {
  log "+ $*"
  "$@" >>"$LOG_FILE" 2>&1
}

ensure_git_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "No estas dentro de un repositorio Git."
}

ensure_repo_root() {
  local root
  root="$(git rev-parse --show-toplevel)"
  cd "$root"
  log "Repo root: $root"

  [ -f "package.json" ] || die "No encuentro package.json. Ejecuta desde la raiz del proyecto."
  [ -d "src" ] || die "No encuentro src/. Ejecuta desde la raiz del proyecto."
  [ -d "app" ] || die "No encuentro app/. Ejecuta desde la raiz del proyecto."
}

ensure_clean_tree() {
  if [ -n "$(git status --short)" ]; then
    log "Estado actual:"
    git status --short | tee -a "$LOG_FILE"
    die "El arbol Git no esta limpio. Haz commit/stash antes de continuar."
  fi
}

create_backup() {
  section "Creando respaldo"

  run git tag "$BACKUP_TAG"
  run git branch "$BACKUP_BRANCH"

  log "Backup tag:    $BACKUP_TAG"
  log "Backup branch: $BACKUP_BRANCH"
}

remove_helper_scripts() {
  section "Eliminando scripts temporales de integracion"

  local removed=0

  for file in "${HELPER_SCRIPTS[@]}"; do
    if [ -e "$file" ]; then
      if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
        log "Eliminando tracked: $file"
        git rm -f "$file" >>"$LOG_FILE" 2>&1
      else
        log "Eliminando untracked: $file"
        rm -f "$file"
      fi
      removed=1
    else
      log "No existe, omitido: $file"
    fi
  done

  if [ "$removed" = "0" ]; then
    log "No habia scripts temporales que eliminar."
  fi
}

normalize_core_files() {
  section "Normalizando archivos criticos de integracion"

  python - <<'PY'
from pathlib import Path
import re

def write_if_changed(path: Path, new_text: str):
    old = path.read_text()
    if old != new_text:
        path.write_text(new_text)
        print(f"UPDATED {path}")
    else:
        print(f"OK {path}")

# ------------------------------------------------------------
# 1. LocationManager.ts
#    - startMonitoringArrival debe existir y ser API principal.
#    - startMonitoring queda como alias.
#    - Normaliza Array<T> a T[] en la firma relevante.
# ------------------------------------------------------------
lm = Path("src/services/LocationManager.ts")
s = lm.read_text()

# Normalizar tipo Array<T> en cualquier firma conocida.
s = s.replace(
    "sites: Array<{ id: string; latitude: number; longitude: number }>",
    "sites: { id: string; latitude: number; longitude: number }[]"
)

# Si solo existe startMonitoring y no startMonitoringArrival, renombrar el metodo principal.
if "startMonitoringArrival:" not in s and "startMonitoring: async (" in s:
    idx = s.find("startMonitoring: async (")
    s = s[:idx] + "startMonitoringArrival: async (" + s[idx + len("startMonitoring: async ("):]

# Si existe startMonitoringArrival pero no existe alias startMonitoring, agregar alias.
if "startMonitoringArrival:" in s and "startMonitoring: async (" not in s:
    marker = "startMonitoringArrival: async ("
    idx = s.find(marker)
    arrow_idx = s.find("=>", idx)
    brace_start = s.find("{", arrow_idx)

    if brace_start == -1:
        raise SystemExit("No pude encontrar cuerpo de startMonitoringArrival en LocationManager.ts")

    depth = 0
    end_idx = None

    for i in range(brace_start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                j = i + 1
                while j < len(s) and s[j].isspace():
                    j += 1
                if j < len(s) and s[j] == ",":
                    end_idx = j + 1
                else:
                    end_idx = i + 1
                break

    if end_idx is None:
        raise SystemExit("No pude detectar final de startMonitoringArrival en LocationManager.ts")

    alias = """

  startMonitoring: async (
    sites: { id: string; latitude: number; longitude: number }[],
    radius = 100
  ) => {
    return LocationService.startMonitoringArrival(sites, radius);
  },"""

    s = s[:end_idx] + alias + s[end_idx:]

# Si por alguna razon ambos existen pero startMonitoring aparece antes y es el metodo real,
# no forzamos reorden mas agresivo para evitar romper logica ya validada.
write_if_changed(lm, s)

# ------------------------------------------------------------
# 2. workTrackerEffects.ts
#    Forzar engine a usar API semantica startMonitoringArrival.
# ------------------------------------------------------------
effects = Path("src/engine/effects/workTrackerEffects.ts")
s = effects.read_text()
s = re.sub(r"LocationService\.startMonitoring\(", "LocationService.startMonitoringArrival(", s)
write_if_changed(effects, s)

# ------------------------------------------------------------
# 3. locationAdapter.ts
#    Normalizar accuracy a number | undefined, no null.
# ------------------------------------------------------------
adapter = Path("src/runtime/locationAdapter.ts")
s = adapter.read_text()
s = s.replace("accuracy?: number | null;", "accuracy?: number;")
s = s.replace("accuracy: position.coords.accuracy,", "accuracy: position.coords.accuracy ?? undefined,")
write_if_changed(adapter, s)

# ------------------------------------------------------------
# 4. src/types/index.ts
#    Asegurar GRIS y GPS_WARMUP.
# ------------------------------------------------------------
types = Path("src/types/index.ts")
s = types.read_text()

# LogColor: agregar GRIS si falta.
m = re.search(r"export type LogColor = ([^;]+);", s, flags=re.DOTALL)
if m and "'GRIS'" not in m.group(1):
    colors = m.group(1).strip()
    if "'ROJO'" in colors:
        colors = colors.replace("'ROJO'", "'GRIS' | 'ROJO'")
    else:
        colors = colors + " | 'GRIS'"
    s = s[:m.start(1)] + colors + s[m.end(1):]

# LogCategory: agregar GPS_WARMUP si falta.
m = re.search(r"export type LogCategory =([^;]+);", s, flags=re.DOTALL)
if m and "'GPS_WARMUP'" not in m.group(1):
    body = m.group(1).rstrip()
    if body.endswith("| 'MONITOREO_DETENIDO'"):
        body = body + "\n  | 'GPS_WARMUP'"
    else:
        body = body + "\n  | 'GPS_WARMUP'"
    s = s[:m.start(1)] + body + s[m.end(1):]

write_if_changed(types, s)

PY
}

validate_important_files_exist() {
  section "Validando existencia de archivos criticos"

  for file in "${IMPORTANT_FILES[@]}"; do
    [ -f "$file" ] || die "Falta archivo critico: $file"
    log "OK: $file"
  done
}

run_gold_master_validation() {
  section "Ejecutando Gold Master validation"

  [ -f "package.json" ] || die "No existe package.json."

  if ! grep -q '"gm"' package.json; then
    die "package.json no tiene script npm run gm."
  fi

  npm run gm 2>&1 | tee -a "$LOG_FILE"
}

generate_comparison_report_if_possible() {
  section "Generando reporte de comparacion contra LEDTracker local, si existe"

  if [ ! -d "$LEDTRACKER_PATH" ]; then
    log "No existe LEDTRACKER_PATH=$LEDTRACKER_PATH. Omitiendo comparacion."
    return 0
  fi

  local report="$LOG_DIR/repo-diff-summary-${TIMESTAMP}.txt"

  diff -qr \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=.expo \
    --exclude=coverage \
    --exclude='merge-report-*.log' \
    --exclude='.eslintcache' \
    --exclude='.logger-*' \
    --exclude='.merge-backups-*' \
    --exclude='.typecheck-fix-*' \
    --exclude='scripts/audit/reports' \
    "$LEDTRACKER_PATH" \
    "." \
    > "$report" || true

  log "Reporte de diferencias generado en:"
  log "$report"

  log "Resumen filtrado de diferencias importantes:"
  if [ -s "$report" ]; then
    cat "$report" | tee -a "$LOG_FILE"
  else
    log "Sin diferencias relevantes segun filtros."
  fi
}

commit_changes_if_any() {
  section "Confirmando cambios, si existen"

  if [ -z "$(git status --short)" ]; then
    log "No hay cambios para commit."
    return 0
  fi

  log "Cambios a confirmar:"
  git status --short | tee -a "$LOG_FILE"

  git add -A
  git commit -m "Clean temporary integration helpers and enforce Gold Master contracts" | tee -a "$LOG_FILE"
}

push_if_requested() {
  section "Push"

  if [ "$AUTO_PUSH" = "1" ]; then
    git push origin HEAD | tee -a "$LOG_FILE"
    log "Push completado."
  else
    log "AUTO_PUSH=0. No se hizo push."
    log "Para publicar:"
    log "  git push origin HEAD"
  fi
}

final_status() {
  section "Estado final"

  git status --short | tee -a "$LOG_FILE"

  log ""
  log "Ultimos commits:"
  git log --oneline --decorate --max-count=8 | tee -a "$LOG_FILE"

  log ""
  log "Backup tag:    $BACKUP_TAG"
  log "Backup branch: $BACKUP_BRANCH"
  log "Log:           $LOG_FILE"
}

main() {
  section "Inicio: Finalizacion Gold Master WTracker"

  ensure_git_repo
  ensure_repo_root
  ensure_clean_tree

  create_backup
  remove_helper_scripts
  normalize_core_files
  validate_important_files_exist

  # Validamos antes de commitear. Si falla, no se confirma nada.
  run_gold_master_validation

  # Guardamos reportes/comparacion fuera del arbol versionado.
  generate_comparison_report_if_possible

  # Si npm run gm actualizo audit-report.json u otro archivo tracked, se incluye.
  commit_changes_if_any

  # Segunda verificacion rapida tras commit: no debe quedar sucio.
  if [ -n "$(git status --short)" ]; then
    die "Quedaron cambios despues del commit. Revisar manualmente."
  fi

  push_if_requested
  final_status

  log ""
  log "OK: finalizacion Gold Master completada."
}

main "$@"
