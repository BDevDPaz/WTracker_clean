#!/usr/bin/env bash

set -u
set -o pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
INTEGRATION_BRANCH="${INTEGRATION_BRANCH:-integration/wtracker-v2.2-merge}"
RUN_CHECKS="${RUN_CHECKS:-0}"
AUTO_PUSH="${AUTO_PUSH:-0}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="merge-report-${TIMESTAMP}.log"
BACKUP_TAG="backup/pre-merge-wtracker-${TIMESTAMP}"
BACKUP_BRANCH="backup/main-pre-merge-${TIMESTAMP}"

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m"

log() {
  echo -e "$1" | tee -a "$LOG_FILE"
}

die() {
  log "${RED}ERROR:${NC} $1"
  exit 1
}

section() {
  log ""
  log "${BLUE}============================================================${NC}"
  log "${BLUE}$1${NC}"
  log "${BLUE}============================================================${NC}"
}

check_git_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "No estas dentro de un repositorio Git."
}

is_merge_in_progress() {
  git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1
}

has_unmerged_files() {
  [ -n "$(git diff --name-only --diff-filter=U)" ]
}

has_any_changes() {
  ! git diff --quiet || ! git diff --cached --quiet
}

branch_exists() {
  local branch="$1"
  git show-ref --verify --quiet "refs/heads/${branch}" || git show-ref --verify --quiet "refs/remotes/origin/${branch}"
}

checkout_branch() {
  local branch="$1"

  if git show-ref --verify --quiet "refs/heads/${branch}"; then
    git checkout "$branch" >>"$LOG_FILE" 2>&1
  elif git show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
    git checkout -b "$branch" "origin/${branch}" >>"$LOG_FILE" 2>&1
  else
    return 1
  fi
}

detect_current_merge_branch() {
  if [ -f ".git/MERGE_MSG" ]; then
    awk -F"'" '/^Merge branch / {print $2; exit}' .git/MERGE_MSG
  fi
}

auto_commit_residual_changes() {
  local message="${1:-Automated residual changes after merge}"

  if is_merge_in_progress; then
    return 0
  fi

  if has_any_changes; then
    section "Cambios residuales detectados"

    log "Se encontraron cambios fuera de un merge. Se agregaran y confirmaran automaticamente."
    git status --short | tee -a "$LOG_FILE"

    git add . >>"$LOG_FILE" 2>&1 || die "No se pudo hacer git add de cambios residuales."

    if git diff --cached --quiet; then
      log "${YELLOW}No hay cambios staged despues de git add. Continuando.${NC}"
      return 0
    fi

    git commit -m "$message" >>"$LOG_FILE" 2>&1 || die "No se pudo crear commit de cambios residuales."

    log "${GREEN}OK:${NC} cambios residuales confirmados automaticamente."
  fi
}

check_clean_worktree() {
  if is_merge_in_progress; then
    return 0
  fi

  if has_any_changes; then
    auto_commit_residual_changes "Automated cleanup of residual merge changes"
  fi

  if has_any_changes; then
    die "El arbol de trabajo sigue sin estar limpio despues del auto-commit."
  fi
}

regenerate_lock_if_needed() {
  local need_npm_install="$1"

  if [ "$need_npm_install" = "1" ] && [ -f "package.json" ]; then
    section "Regenerando dependencias por conflicto en package.json/package-lock.json"

    if command -v npm >/dev/null 2>&1; then
      npm install >>"$LOG_FILE" 2>&1 || die "npm install fallo al regenerar package-lock.json."
      git add package.json package-lock.json 2>/dev/null || true
      log "${GREEN}OK:${NC} package-lock.json regenerado con npm install."
    else
      die "npm no esta disponible. No puedo regenerar package-lock.json automaticamente."
    fi
  fi
}

auto_resolve_unmerged_files() {
  local branch_name="${1:-rama-entrante}"
  local need_npm_install="0"

  if ! has_unmerged_files; then
    return 0
  fi

  section "Resolviendo conflictos automaticamente para ${branch_name}"

  local files
  files="$(git diff --name-only --diff-filter=U)"

  log "Archivos en conflicto:"
  echo "$files" | tee -a "$LOG_FILE"

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    case "$file" in
      package.json)
        log "${YELLOW}Conflicto en package.json:${NC} usando version de la rama entrante."
        git checkout --theirs -- "$file" >>"$LOG_FILE" 2>&1 || die "No se pudo aplicar --theirs en $file."
        git add "$file" >>"$LOG_FILE" 2>&1 || die "No se pudo agregar $file."
        need_npm_install="1"
        ;;

      package-lock.json)
        log "${YELLOW}Conflicto en package-lock.json:${NC} usando version entrante y luego regenerando."
        git checkout --theirs -- "$file" >>"$LOG_FILE" 2>&1 || true
        git add "$file" >>"$LOG_FILE" 2>&1 || true
        need_npm_install="1"
        ;;

      src/services/ReportGenerator.ts)
        log "${YELLOW}Conflicto en ReportGenerator.ts:${NC} usando version entrante para priorizar fixes de seguridad/reportes."
        git checkout --theirs -- "$file" >>"$LOG_FILE" 2>&1 || die "No se pudo aplicar --theirs en $file."
        git add "$file" >>"$LOG_FILE" 2>&1 || die "No se pudo agregar $file."
        ;;

      *)
        log "${YELLOW}Conflicto en ${file}:${NC} usando version de la rama entrante."
        git checkout --theirs -- "$file" >>"$LOG_FILE" 2>&1 || die "No se pudo aplicar --theirs en $file."
        git add "$file" >>"$LOG_FILE" 2>&1 || die "No se pudo agregar $file."
        ;;
    esac
  done <<< "$files"

  regenerate_lock_if_needed "$need_npm_install"

  if has_unmerged_files; then
    log "${RED}Todavia quedan archivos sin resolver:${NC}"
    git diff --name-only --diff-filter=U | tee -a "$LOG_FILE"
    die "No se pudieron resolver automaticamente todos los conflictos."
  fi

  log "${GREEN}OK:${NC} conflictos resueltos automaticamente."
}

complete_merge_if_in_progress() {
  if ! is_merge_in_progress; then
    return 0
  fi

  local branch_name
  branch_name="$(detect_current_merge_branch)"
  branch_name="${branch_name:-rama-entrante}"

  section "Merge en progreso detectado"

  log "Se detecto un merge pendiente."
  log "Rama detectada: ${branch_name}"
  log "Aplicando resolucion automatica..."

  auto_resolve_unmerged_files "$branch_name"

  git add . >>"$LOG_FILE" 2>&1 || die "No se pudo hacer git add final."

  git commit --no-edit >>"$LOG_FILE" 2>&1 || \
    git commit -m "Merge branch '${branch_name}' into ${INTEGRATION_BRANCH}" >>"$LOG_FILE" 2>&1 || \
    die "No se pudo completar el commit del merge pendiente."

  log "${GREEN}OK:${NC} merge pendiente completado automaticamente."

  auto_commit_residual_changes "Automated dependency normalization after merge '${branch_name}'"
}

ensure_base_updated() {
  section "Preparando rama base: ${BASE_BRANCH}"

  checkout_branch "$BASE_BRANCH" || die "No existe la rama base '${BASE_BRANCH}'."

  if git remote get-url origin >/dev/null 2>&1; then
    log "${YELLOW}Actualizando referencias remotas...${NC}"
    git fetch --all --prune >>"$LOG_FILE" 2>&1 || log "${YELLOW}Advertencia: git fetch fallo. Continuando con ramas locales.${NC}"

    if git show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
      log "${YELLOW}Intentando pull --ff-only desde origin/${BASE_BRANCH}...${NC}"
      git pull --ff-only origin "$BASE_BRANCH" >>"$LOG_FILE" 2>&1 || die "No se pudo hacer pull --ff-only de ${BASE_BRANCH}. Revisa divergencias."
    fi
  else
    log "${YELLOW}No hay remote origin configurado. Continuando localmente.${NC}"
  fi
}

create_backup() {
  section "Creando respaldo de seguridad"

  git tag "$BACKUP_TAG" >>"$LOG_FILE" 2>&1 || die "No se pudo crear el tag de respaldo."
  git branch "$BACKUP_BRANCH" >>"$LOG_FILE" 2>&1 || die "No se pudo crear la rama de respaldo."

  log "${GREEN}Respaldo creado correctamente:${NC}"
  log "  Tag:    ${BACKUP_TAG}"
  log "  Branch: ${BACKUP_BRANCH}"
}

create_integration_branch() {
  section "Preparando rama de integracion: ${INTEGRATION_BRANCH}"

  if git show-ref --verify --quiet "refs/heads/${INTEGRATION_BRANCH}"; then
    log "${YELLOW}La rama de integracion ya existe. Cambiando a ella.${NC}"
    git checkout "$INTEGRATION_BRANCH" >>"$LOG_FILE" 2>&1 || die "No se pudo cambiar a ${INTEGRATION_BRANCH}."
  else
    git checkout -b "$INTEGRATION_BRANCH" "$BASE_BRANCH" >>"$LOG_FILE" 2>&1 || die "No se pudo crear ${INTEGRATION_BRANCH}."
  fi
}

run_checks() {
  if [ "$RUN_CHECKS" != "1" ]; then
    log "${YELLOW}RUN_CHECKS=0, omitiendo validaciones automaticas.${NC}"
    return 0
  fi

  section "Ejecutando validaciones"

  if [ ! -f "package.json" ]; then
    log "${YELLOW}No se encontro package.json. Omitiendo validaciones Node/Expo.${NC}"
    return 0
  fi

  log "Ejecutando npm install..."
  npm install >>"$LOG_FILE" 2>&1 || die "npm install fallo."

  auto_commit_residual_changes "Automated dependency normalization during validation"

  log "Ejecutando TypeScript check..."
  npx tsc --noEmit >>"$LOG_FILE" 2>&1 || die "npx tsc --noEmit fallo."

  if npm run | grep -q " lint"; then
    log "Ejecutando lint..."
    npm run lint >>"$LOG_FILE" 2>&1 || die "npm run lint fallo."
  else
    log "${YELLOW}No se encontro script lint. Omitiendo lint.${NC}"
  fi

  log "Ejecutando expo-doctor..."
  npx expo-doctor >>"$LOG_FILE" 2>&1 || log "${YELLOW}Advertencia: expo-doctor fallo o no esta disponible.${NC}"
}

merge_branch() {
  local branch="$1"

  log ""
  log "${BLUE}--- Fusionando rama: ${branch} ---${NC}"

  if ! branch_exists "$branch"; then
    log "${YELLOW}SKIP:${NC} La rama '${branch}' no existe local ni en origin."
    return 0
  fi

  if ! git show-ref --verify --quiet "refs/heads/${branch}" && git show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
    log "Creando rama local desde origin/${branch}..."
    git branch "$branch" "origin/${branch}" >>"$LOG_FILE" 2>&1 || die "No se pudo crear rama local '${branch}'."
  fi

  if git merge-base --is-ancestor "$branch" HEAD; then
    log "${GREEN}OK:${NC} '${branch}' ya esta contenida en ${INTEGRATION_BRANCH}. No hay nada que fusionar."
    return 0
  fi

  log "Resumen de cambios:"
  git diff --stat "HEAD...${branch}" | tee -a "$LOG_FILE" || true

  log "Ejecutando: git merge --no-ff -X theirs ${branch}"

  if git merge --no-ff -X theirs "$branch" -m "Merge branch '${branch}' into ${INTEGRATION_BRANCH}" >>"$LOG_FILE" 2>&1; then
    log "${GREEN}OK:${NC} Fusion completada: ${branch}"
    auto_commit_residual_changes "Automated residual changes after merging '${branch}'"
    return 0
  fi

  log "${YELLOW}El merge dejo conflictos. Aplicando resolucion automatica con version entrante.${NC}"

  auto_resolve_unmerged_files "$branch"

  git add . >>"$LOG_FILE" 2>&1 || die "No se pudo hacer git add final tras resolver conflictos."

  git commit --no-edit >>"$LOG_FILE" 2>&1 || \
    git commit -m "Merge branch '${branch}' into ${INTEGRATION_BRANCH}" >>"$LOG_FILE" 2>&1 || \
    die "No se pudo completar el commit del merge de '${branch}'."

  auto_commit_residual_changes "Automated dependency normalization after merging '${branch}'"

  log "${GREEN}OK:${NC} Fusion completada automaticamente tras resolver conflictos: ${branch}"
}

merge_phase() {
  local phase_name="$1"
  shift
  local branches=("$@")

  section "$phase_name"

  for branch in "${branches[@]}"; do
    check_clean_worktree
    merge_branch "$branch"
  done

  run_checks
}

push_if_requested() {
  if [ "$AUTO_PUSH" = "1" ]; then
    section "Publicando rama de integracion"
    git push -u origin "$INTEGRATION_BRANCH" >>"$LOG_FILE" 2>&1 || die "No se pudo publicar ${INTEGRATION_BRANCH}."
    log "${GREEN}Rama publicada:${NC} ${INTEGRATION_BRANCH}"
  else
    log ""
    log "${YELLOW}AUTO_PUSH=0, no se publico la rama de integracion.${NC}"
    log "Para publicarla manualmente:"
    log "  git push -u origin ${INTEGRATION_BRANCH}"
  fi
}

final_summary() {
  section "Resumen final"

  log "${GREEN}Proceso terminado.${NC}"
  log ""
  log "Rama de integracion:"
  log "  ${INTEGRATION_BRANCH}"
  log ""
  log "Respaldo:"
  log "  ${BACKUP_TAG}"
  log "  ${BACKUP_BRANCH}"
  log ""
  log "Reporte:"
  log "  ${LOG_FILE}"
  log ""
  log "Siguiente paso recomendado:"
  log "  RUN_CHECKS=1 ./merge_wtracker_branches.sh"
  log ""
  log "Si todo esta correcto, fusiona a main con:"
  log "  git checkout ${BASE_BRANCH}"
  log "  git merge --no-ff ${INTEGRATION_BRANCH}"
}

main() {
  section "Inicio de integracion automatica WTracker"

  log "Base branch:        ${BASE_BRANCH}"
  log "Integration branch: ${INTEGRATION_BRANCH}"
  log "Run checks:         ${RUN_CHECKS}"
  log "Auto push:          ${AUTO_PUSH}"
  log "Log file:           ${LOG_FILE}"

  check_git_repo

  complete_merge_if_in_progress
  auto_commit_residual_changes "Automated cleanup before continuing integration"

  check_clean_worktree
  ensure_base_updated
  create_backup
  create_integration_branch
  check_clean_worktree

  merge_phase "FASE 1 - Correcciones criticas y estabilidad base" \
    "fix-ts-lint-errors" \
    "fix-context-native-module-errors" \
    "fix-safe-area-import" \
    "fix-safeareaview-provider" \
    "fix-history-safeareaview" \
    "fix-notification-data-crash" \
    "fix-default-settings-insert" \
    "fix-showdialog-comment" \
    "fix-showdialog-comment-2"

  merge_phase "FASE 2 - Seguridad y sanitizacion" \
    "security-prevent-xss-report-generator" \
    "fix-xss-pdf-generation"

  merge_phase "FASE 3 - Base de datos, logger y performance interna" \
    "performance-optimize-db-init" \
    "perf-parallel-db-queries" \
    "perf-remove-redundant-db-query" \
    "performance-sql-weekly-totals" \
    "fix-logger-n-plus-1-inserts" \
    "feature-logger-batch-transaction" \
    "jules-logger-optimization"

  merge_phase "FASE 4 - Location, geofencing y tracking" \
    "performance-optimize-location-manager" \
    "perf-optimize-geofence-stop" \
    "jules-location-manager-revert" \
    "resolve-conflicts-location-history" \
    "refactor-geofence-hysteresis-payroll" \
    "optimization-geofencing-payroll" \
    "multi-site-failsafe-refactor" \
    "fix-stop-all-tracking-on-shift-end"

  merge_phase "FASE 5 - Notificaciones, logout y automatizacion" \
    "fix-logout-notifications" \
    "feature-notifications-reports-optimization" \
    "audit-notifications-reports-system"

  merge_phase "FASE 6 - Payroll, reportes y auditoria" \
    "feature-payroll-system-enhancements" \
    "audit-auto-check-system-report" \
    "audit-refactor-gold-master" \
    "final-production-audit-refactor" \
    "audit-refinement-wtracker-v2.2" \
    "audit-refinement-wtracker-v2.2-2" \
    "fix-gm-audit-compliance"

  merge_phase "FASE 7 - UX, accesibilidad y pantallas" \
    "palette-a11y-history-close-btn" \
    "palette-history-a11y" \
    "palette-a11y-improvements" \
    "palette-a11y-index-buttons" \
    "palette-a11y-history-card" \
    "ui-ux-optimization-consolidation"

  merge_phase "FASE 8 - Optimizacion general y consolidacion final" \
    "optimize-weekly-stats" \
    "optimize-ops-and-rendering" \
    "optimize-wtracker-field-ready" \
    "optimization-field-ready-system" \
    "optimization-field-ready-system-2" \
    "system-hardening-optimization" \
    "fix-stabilization-final" \
    "consolidate-and-optimize-wtracker" \
    "repository-hygiene-cleanup"

  merge_phase "FASE 9 - Branding y fixes finales" \
    "feat-wtracker-rebranding-validation" \
    "critical-fixes-v2.2"

  push_if_requested
  final_summary
}

main "$@"
