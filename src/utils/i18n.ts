<<<<<<< HEAD
export const translations = {
  es: {
    // --- BOTONES GLOBALES ---
    btn_cancel: "CANCELAR",
    btn_save: "GUARDAR",
    btn_edit: "EDITAR",
    btn_delete: "ELIMINAR",
    btn_close: "CERRAR",
    btn_finished: "TERMINAR",
    btn_moving: "OTRO SITIO",

    // --- HEADER & HOME (Estados del Flujo Maestro) ---
    header_title: "WTracker",
    status_active: "ACTIVO",
    status_inactive: "FUERA DE SERVICIO",
    status_pending: "ESPERANDO LLEGADA", // ✅ Vital para Fase 1
    status_transit: "EN TRÁNSITO",       // ✅ Vital para Fase 4
    status_travel: "EN TRÁNSITO",        // (Compatibilidad)
    
    // --- TARJETA PRINCIPAL (HOME) ---
    label_location: "UBICACIÓN ACTUAL",
    label_destination: "DESTINO CONFIGURADO",
    hint_geofence_active: "Geocerca Activa • Check-in automático al llegar",
    no_activity: "No hay actividad registrada.",
    
    // --- ACCIONES PRINCIPALES ---
    btn_clock_out: "TERMINAR JORNADA",
    btn_new_job: "INICIAR JORNADA",
    
    // --- ESTADÍSTICAS ---
    stats_hours: "HORAS",
    stats_earnings: "GANANCIA EST.",
    
    // --- MODAL CONFIGURACIÓN (DAILY SETUP & TRÁNSITO) ---
    modal_title_start: "INICIAR JORNADA",
    modal_subtitle_start: "Configura tu primer ubicación del día",
    modal_title_transit: "NUEVO DESTINO",
    modal_subtitle_transit: "Rumbo al siguiente trabajo",
    
    // ✅ Inputs Nuevos (Requeridos por el nuevo Modal)
    input_address: "Dirección del trabajo",
    input_client: "Cliente (Opcional)",
    input_notes: "Notas (Opcional)",
    
    daily_placeholder: "Ej: 1234 Ejemplo Ave...", // (Compatibilidad)
    
    btn_activate_geofence: "ACTIVAR GEOCERCA",
    btn_start_transit: "INICIAR TRAYECTO",
    
    // --- MODAL ALMUERZO ---
    lunch_title: "¿TOMASTE ALMUERZO?",
    lunch_subtitle: "Deducción automática de tiempo",
    lunch_yes_30: "SÍ (30 MIN)",
    lunch_yes_60: "SÍ (60 MIN)",
    lunch_no: "NO TOMÉ",
    status_lunch_taken: "🍴 Almuerzo 🍴",
    
    // --- ALERTAS Y NOTIFICACIONES ---
    alert_exit_title: "📍 Saliste del Área",
    alert_exit_msg: "¿Terminaste tu jornada o vas a otro sitio?",
    alert_location_needed: "Se requiere ubicación precisa",
    alert_address_not_found: "Dirección no encontrada",
    
    toast_geofence_active: "Geocerca Activada. Ve al sitio.",
    toast_transit_started: "Tránsito iniciado.",
    toast_shift_ended: "Jornada finalizada.",
    toast_error_generic: "Ocurrió un error.",

    // --- REPORTES Y PDF (NUEVO) ---
    report_title: "REPORTE SEMANAL",
    report_subtitle: "NÓMINA Y AUDITORÍA",
    card_ready_title: "Listo para Generar",
    card_ready_desc: "Genera un PDF oficial con desglose de horas, clientes, notas y auditoría GPS.",
    btn_download_pdf: "DESCARGAR PDF",
    btn_send_email: "ENVIAR POR EMAIL",
    report_footer_note: "* Al enviar, se abrirá tu aplicación de correo predeterminada.",
    
    // --- HISTORIAL (COMPATIBILIDAD) ---
    history_title: "Historial",
=======
// src/utils/i18n.ts
export const translations = {
  es: {
    // --- BOTONES Y GLOBAL ---
    btn_cancel: "Cancelar",
    btn_save: "Guardar",
    btn_edit: "Editar",
    btn_delete: "Eliminar",
    btn_close: "Cerrar",

    // --- HEADER & HOME ---
    header_title: "WorkTracker",
    status_active: "🟢 TRABAJANDO EN:",
    status_inactive: "🔴 FUERA DE SERVICIO",
    status_travel: "🚗 EN TRÁNSITO", // ✅ Nuevo
    no_activity: "No hay actividad registrada.",
    btn_clock_out: "MARCAR SALIDA",
    stats_hours: "Horas Hoy",
    stats_earnings: "Ganancia Est.",
    btn_new_job: "📍 NUEVO TRABAJO",

    // --- DAILY SETUP ---
    daily_title: "Configuración Diaria",
    daily_label: "¿Dónde trabajarás hoy?",
    daily_placeholder: "Ej: 5601 Balboa Blvd...",
    daily_btn_start: "Iniciar Jornada",

    // --- HISTORIAL & PDF ---
    history_title: "Historial",
    btn_pdf: "📄 PDF",
    pdf_title: "REPORTE DE HORAS",
    pdf_employee: "Empleado",
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
    col_date: "Fecha",
    col_loc: "Ubicación",
    col_in: "Entrada",
    col_out: "Salida",
<<<<<<< HEAD
    
    // --- CONFIGURACIÓN & ADMIN (COMPATIBILIDAD) ---
    settings_title: "CONFIGURACIÓN",
    settings_general: "GENERAL",
    settings_save: "GUARDAR CAMBIOS",
    
    label_lang: "Idioma / Language",
    label_name: "Nombre Empleado",
    label_rate: "Tarifa por Hora ($)",
    label_start_time: "Hora Recordatorio Diario (HH:MM)",
    label_multiplier: "Multiplicador Tiempo Extra (x)",
    label_company_name: "Nombre Empresa",
    label_report_email: "Email Reportes",
    label_radius: "Radio Tolerancia (mts)",
    
    admin_zone: "ZONA ADMIN",
    admin_unlock: "Desbloquear",
    admin_pin_placeholder: "PIN de Acceso Admin",
    admin_locked_msg: "Configuración de empresa bloqueada.",
    err_pin_wrong: "PIN incorrecto",

    // --- AUDITORÍA PDF ---
    pdf_audit_title: "AUDITORÍA DE INTEGRIDAD DE DATOS",
    log_auto_exit: "Salida Automática por distancia",
    log_auto_entry: "Entrada Automática"
  },
  
  en: {
    // --- GLOBAL BUTTONS ---
    btn_cancel: "CANCEL",
    btn_save: "SAVE",
    btn_edit: "EDIT",
    btn_delete: "DELETE",
    btn_close: "CLOSE",
    btn_finished: "FINISHED",
    btn_moving: "MOVING",

    // --- HEADER & HOME ---
    header_title: "WTracker",
    status_active: "ACTIVE",
    status_inactive: "OFF DUTY",
    status_pending: "AWAITING ARRIVAL",
    status_transit: "IN TRANSIT",
    status_travel: "IN TRANSIT",
    
    // --- MAIN CARD ---
    label_location: "CURRENT LOCATION",
    label_destination: "TARGET DESTINATION",
    hint_geofence_active: "Geofence Active • Auto check-in on arrival",
    no_activity: "No active session.",
    
    // --- MAIN ACTIONS ---
    btn_clock_out: "CLOCK OUT",
    btn_new_job: "START SHIFT",
    
    // --- STATS ---
    stats_hours: "HOURS",
    stats_earnings: "EST. EARNINGS",
    
    // --- SETUP MODAL ---
    modal_title_start: "START SHIFT",
    modal_subtitle_start: "Set up your first location",
    modal_title_transit: "NEW DESTINATION",
    modal_subtitle_transit: "Heading to next job",
    
    input_address: "Job Address",
    input_client: "Client (Optional)",
    input_notes: "Notes (Optional)",
    
    daily_placeholder: "Ex: 1234 Example Ave...",
    
    btn_activate_geofence: "ACTIVATE GEOFENCE",
    btn_start_transit: "START TRANSIT",
    
    // --- LUNCH MODAL ---
    lunch_title: "DID YOU TAKE LUNCH?",
    lunch_subtitle: "Automatic time deduction",
    lunch_yes_30: "YES (30 MIN)",
    lunch_yes_60: "YES (60 MIN)",
    lunch_no: "NO LUNCH",
    status_lunch_taken: "🍴 Lunch Taken 🍴",
    
    // --- ALERTS ---
    alert_exit_title: "📍 Left Work Area",
    alert_exit_msg: "Did you finish your shift or are you moving?",
    alert_location_needed: "Precise location required",
    alert_address_not_found: "Address not found",
    
    toast_geofence_active: "Geofence Active. Go to site.",
    toast_transit_started: "Transit started.",
    toast_shift_ended: "Shift ended successfully.",
    toast_error_generic: "An error occurred.",

    // --- REPORTS ---
    report_title: "WEEKLY REPORT",
    report_subtitle: "PAYROLL & AUDIT",
    card_ready_title: "Ready to Generate",
    card_ready_desc: "Generate official PDF with hours breakdown, clients, notes, and GPS audit.",
    btn_download_pdf: "DOWNLOAD PDF",
    btn_send_email: "SEND BY EMAIL",
    report_footer_note: "* Sending will open your default email app.",
    
    // --- HISTORY ---
    history_title: "History",
=======

    // --- SETTINGS & ADMIN ---
    settings_title: "Configuración",
    label_lang: "Idioma / Language",
    label_name: "Nombre Empleado",
    label_rate: "Tarifa por Hora ($)",
    label_start_time: "Hora Recordatorio Diario (HH:MM)", // ✅ Nuevo
    label_multiplier: "Multiplicador Tiempo Extra (x)",    // ✅ Nuevo
    admin_zone: "🔒 ZONA ADMIN",
    admin_unlock: "Desbloquear",
    admin_pass_placeholder: "Contraseña Admin",
    admin_locked_msg: "Configuración de empresa bloqueada.",
    label_company_name: "Nombre Empresa",
    label_report_email: "Email Reportes",
    label_radius: "Radio Tolerancia (mts)",

    // --- ERRORES & LOGS ---
    err_pass_wrong: "Contraseña incorrecta",
    err_out_of_range: "Fuera de Rango",
    msg_out_of_range: "Estás muy lejos del sitio.",
    log_auto_exit: "Salida Automática por distancia",
    log_auto_entry: "Entrada Automática",
    log_lunch_taken: "Deducción de almuerzo aplicada", // ✅ Nuevo

    // --- AUDITORÍA ---
    pdf_audit_title: "AUDITORÍA DE INTEGRIDAD DE DATOS",
    pdf_audit_msg: "A continuación se detallan las modificaciones o eliminaciones realizadas manualmente:",
    col_ts: "Timestamp",
    col_action: "Acción",
    col_details: "Detalles",

    // --- ALMUERZO ---
    lunch_title: "Hora de Almuerzo",
    lunch_msg: "¿Vas a tomar tu descanso hoy?",
    lunch_sub: "(Se descontará 1 hora del total)",
    lunch_yes: "SÍ, DESCONTAR",
    lunch_no: "NO",
    status_lunch_taken: "✅ Almuerzo (-1h)",

    // --- NUEVO PARA TRÁNSITO ---
    transit_msg: "Tránsito entre sitios",
    alert_exit_title: "Salida Detectada 🛑",
    alert_exit_msg: "¿Terminaste tu día o vas a otro sitio?",
    btn_finished: "Terminé por hoy",
    btn_moving: "Voy a otro sitio (Pagado)"
  },

  en: {
    // --- BUTTONS & GLOBAL ---
    btn_cancel: "Cancel",
    btn_save: "Save",
    btn_edit: "Edit",
    btn_delete: "Delete",
    btn_close: "Close",

    // --- HEADER & HOME ---
    header_title: "WorkTracker",
    status_active: "🟢 WORKING AT:",
    status_inactive: "🔴 OFF DUTY",
    status_travel: "🚗 IN TRANSIT", // ✅ Nuevo
    no_activity: "No active session.",
    btn_clock_out: "CLOCK OUT",
    stats_hours: "Hours Today",
    stats_earnings: "Est. Earnings",
    btn_new_job: "📍 NEW JOB",

    // --- DAILY SETUP ---
    daily_title: "Daily Setup",
    daily_label: "Where are you working today?",
    daily_placeholder: "Ex: 5601 Balboa Blvd...",
    daily_btn_start: "Start Work",

    // --- HISTORY & PDF ---
    history_title: "History",
    btn_pdf: "📄 PDF",
    pdf_title: "HOURS REPORT",
    pdf_employee: "Employee",
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
    col_date: "Date",
    col_loc: "Location",
    col_in: "In",
    col_out: "Out",
<<<<<<< HEAD
    
    // --- SETTINGS & ADMIN ---
    settings_title: "SETTINGS",
    settings_general: "GENERAL",
    settings_save: "SAVE CHANGES",
    
    label_lang: "Language / Idioma",
    label_name: "Employee Name",
    label_rate: "Hourly Rate ($)",
    label_start_time: "Daily Reminder Time (HH:MM)",
    label_multiplier: "Overtime Multiplier (x)",
    label_company_name: "Company Name",
    label_report_email: "Report Email",
    label_radius: "Tolerance Radius (m)",
    
    admin_zone: "ADMIN ZONE",
    admin_unlock: "Unlock",
    admin_pin_placeholder: "Admin PIN",
    admin_locked_msg: "Company settings locked.",
    err_pin_wrong: "Incorrect PIN",

    // --- AUDIT PDF ---
    pdf_audit_title: "DATA INTEGRITY AUDIT LOG",
    log_auto_exit: "Auto-Checkout by distance",
    log_auto_entry: "Auto Check-in"
=======

    // --- SETTINGS & ADMIN ---
    settings_title: "Settings",
    label_lang: "Language / Idioma",
    label_name: "Employee Name",
    label_rate: "Hourly Rate ($)",
    label_start_time: "Daily Reminder Time (HH:MM)", // ✅ Nuevo
    label_multiplier: "Overtime Multiplier (x)",      // ✅ Nuevo
    admin_zone: "🔒 ADMIN ZONE",
    admin_unlock: "Unlock",
    admin_pass_placeholder: "Admin Password",
    admin_locked_msg: "Company settings locked.",
    label_company_name: "Company Name",
    label_report_email: "Report Email",
    label_radius: "Tolerance Radius (m)",

    // --- ERRORS & LOGS ---
    err_pass_wrong: "Incorrect password",
    err_out_of_range: "Out of Range",
    msg_out_of_range: "You are too far from the site.",
    log_auto_exit: "Auto-Checkout by distance",
    log_auto_entry: "Auto Check-in",
    log_lunch_taken: "Lunch deduction applied", // ✅ Nuevo

    // --- AUDIT ---
    pdf_audit_title: "DATA INTEGRITY AUDIT LOG",
    pdf_audit_msg: "Below are manual modifications or deletions performed on the original records:",
    col_ts: "Timestamp",
    col_action: "Action",
    col_details: "Details",

    // --- LUNCH ---
    lunch_title: "Lunch Break",
    lunch_msg: "Are you taking your break today?",
    lunch_sub: "(1 hour will be deducted)",
    lunch_yes: "YES, DEDUCT",
    lunch_no: "NO",
    status_lunch_taken: "✅ Lunch Taken (-1h)",

    // --- TRANSIT ---
    transit_msg: "Transit between sites",
    alert_exit_title: "Exit Detected 🛑",
    alert_exit_msg: "Finished for the day or moving to another site?",
    btn_finished: "Finished today",
    btn_moving: "Going to another site (Paid)"
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
  }
};
