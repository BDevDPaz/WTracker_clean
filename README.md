```md
# WTracker / LEDTracker Gold Master 🛡️📍

Aplicación profesional Android para control de jornadas laborales, geolocalización, auditoría de tiempo, reportes y cálculo de nómina. Está construida con Expo, React Native y TypeScript, con una arquitectura orientada a confiabilidad runtime, trazabilidad forense y validación Gold Master.

> Estado actual: **Gold Master verde, runtime Android validado en campo y repositorio profesionalmente limpiado tras recuperación de merge conflictivo.**

---

## Estado del proyecto

- **Estado:** Gold Master funcional
- **Plataforma principal:** Android
- **Framework:** Expo SDK 54
- **React:** 19.1.0
- **React Native:** 0.81.5
- **Validación actual:** `npm run gm`
- **Auditoría Gold Master:** 0 findings
- **Tests actuales:** 44/44 passing
- **Repositorio:** limpio, reducido y sin backups temporales ni archivos template no usados

---

## Características principales

### 1. Auto Check-in GPS

WTracker permite registrar automáticamente la entrada del empleado cuando llega al sitio configurado.

El flujo validado incluye:

- Configuración diaria desde `DailySetupModal`
- Activación de geocerca
- GPS warm-up
- Rechazo de muestras GPS débiles
- Validación por hysteresis
- Registro de `AUTO_CHECKIN_GPS`
- Sincronización de sesión activa

---

### 2. Auto Check-out GPS

El proyecto contiene lógica estructural para Auto Check-out cuando el empleado se aleja del sitio laboral.

El flujo incluye:

- Cálculo de distancia contra el sitio activo
- Umbral de salida configurado en millas y metros
- Registro de `AUTO_CHECKOUT_GPS`
- Notificación/evento `GEOFENCE_EXIT`
- Cierre de sesión como `completed`
- Limpieza de monitoreo y tracking
- Integración con auditoría y reportes

Validación estructural disponible:

```bash
npm run verify:auto-checkout
```

---

### 3. Failsafe de Auto Check-out

Además del Auto Check-out GPS, el sistema incluye un mecanismo failsafe ejecutado por tareas de fondo.

El flujo de failsafe incluye:

- Uso de timestamp real de salida
- Registro semántico como `AUTO_CHECKOUT_FAILSAFE`
- Ejecución dentro de mantenimiento background
- Logs de seguimiento para diagnóstico
- Integración con auditoría Gold Master

---

### 4. Gestión de tiempo y nómina

El sistema incluye utilidades para cálculo de tiempo laboral y nómina:

- Cálculo de horas trabajadas
- Manejo de precisión en nómina
- Casos límite de payroll
- Deducción de almuerzo
- Reportes semanales
- Pruebas automatizadas para lógica de nómina

Tests relacionados:

```bash
npm run test
```

---

### 5. Reportes y auditoría forense

WTracker mantiene una capa de auditoría orientada a trazabilidad de acciones críticas.

Incluye:

- Registro de eventos de entrada y salida
- Diferenciación entre checkout manual, checkout GPS y checkout failsafe
- Auditoría Gold Master por dominios
- Reportes generados automáticamente
- Validaciones para tiempo, base de datos, geofencing, logs, seguridad, UI y payroll

Comando principal:

```bash
npm run audit:gm
```

Auditorías individuales:

```bash
npm run audit:time
npm run audit:db
npm run audit:logs
npm run audit:concurrency
npm run audit:geo
npm run audit:payroll
npm run audit:ui
npm run audit:android
npm run audit:security
```

---

### 6. Runtime Android validado

El runtime Android fue validado después de la recuperación del proyecto.

Validaciones confirmadas:

- Bundle Android correcto
- Inicialización de base de datos
- PRAGMAs SQLite configurados
- Servicios de fondo registrados
- Notificación diaria reprogramada
- GPS warm-up
- Rechazo de GPS débil
- Monitoreo de geocerca activo
- Auto Check-in GPS registrado
- Manual checkout completado
- Limpieza de monitoreo y storage

---

## Stack tecnológico

### Core

- Expo SDK 54
- React 19.1.0
- React Native 0.81.5
- TypeScript 5.9
- Expo Router 6

### Runtime y servicios

- Expo Location
- Expo Task Manager
- Expo Background Task
- Expo Background Fetch
- Expo Notifications
- Expo SQLite
- Expo Print
- Expo Sharing
- Expo Mail Composer
- AsyncStorage

### UI y experiencia

- React Native Reanimated
- Expo Blur
- Expo Linear Gradient
- Expo Haptics
- Expo Symbols
- Montserrat Fonts
- UI custom en `src/components/ui/LuxuryUI.tsx`

### Validación y calidad

- Jest
- jest-expo
- React Native Testing Library
- TypeScript strict checking
- ESLint Expo
- Auditoría Gold Master custom
- Verificador estructural de Auto Check-out

---

## Estructura del proyecto

```text
app/                  Rutas Expo Router
assets/images/        Íconos, splash y assets finales
scripts/audit/        Auditorías Gold Master
scripts/images/       Fuentes SVG y conversión de imágenes
src/components/       Componentes propios de UI y modales
src/constants/        Tema visual
src/context/          Contextos globales
src/database/         SQLite y auditoría
src/engine/           Engine, reducer, effects, selectors y estado
src/feedback/         Feedback visual y bridge de logs
src/runtime/          Adapters runtime
src/services/         Servicios GPS, reporting, background y notifications
src/types/            Tipos globales
src/utils/            Utilidades de fecha, geografía, nómina, logs e i18n
```

---

## Scripts disponibles

### Desarrollo

```bash
npm run start
npm run android
npm run ios
npm run web
```

### Validación

```bash
npm run typecheck
npm run lint
npm run test
```

### Gold Master

```bash
npm run gm
```

Este comando ejecuta:

```bash
npm run typecheck && npm run lint && npm run test && npm run audit:gm
```

### Verificación de Auto Check-out

```bash
npm run verify:auto-checkout
```

---

## Instalación

```bash
npm install
```

Si estás recuperando dependencias después de un merge o limpieza profunda, asegúrate de mantener fijo:

```json
"react-test-renderer": "19.1.0"
```

El proyecto usa override para evitar que npm suba `react-test-renderer` a una versión incompatible con `react@19.1.0`.

---

## Compilación Android

Este proyecto está preparado para EAS Build.

```bash
eas build -p android --profile preview
```

Configuración Android destacada:

- Background location
- Foreground service location
- Notifications
- Wake lock
- Boot completed
- Edge-to-edge enabled
- Package: `com.bdevdpaz.wtracker`

---

## Permisos principales

La app solicita permisos necesarios para registrar entradas y salidas automáticas:

- Ubicación aproximada
- Ubicación precisa
- Ubicación en segundo plano
- Servicio foreground
- Notificaciones
- Wake lock
- Inicio después de reinicio del dispositivo

El mensaje de permiso de ubicación está configurado en inglés y español desde `app.json`.

---

## Política de calidad

Antes de considerar cualquier cambio como estable, debe pasar:

```bash
npm run gm
```

Criterio de aceptación actual:

- TypeScript sin errores
- Lint sin errores
- Tests pasando
- Auditoría Gold Master con 0 findings
- Sin archivos temporales, backups o reportes generados versionados accidentalmente

---

## Estado de recuperación reciente

El proyecto fue recuperado después de un merge conflictivo. Durante la recuperación se completó:

- Eliminación de conflict markers
- Restauración de TypeScript
- Corrección de dependencias Expo
- Fijación de `react-test-renderer@19.1.0`
- Corrección de i18n
- Mock de AsyncStorage para Jest
- Corrección de tests de geolocalización
- Corrección de auditoría de tiempo
- Documentación de contrato de geofencing para Gold Master
- Limpieza profesional del repositorio
- Eliminación de backups, reportes históricos, assets template y componentes Expo no usados

---

## Notas para mantenimiento

### Reportes de auditoría

Los reportes generados por Gold Master no se versionan:

```text
scripts/audit/reports/
```

### Backups y archivos temporales

El repo ignora:

```text
*.bak
*.conflict-backup
*.before-*-backup
*.log
coverage/
.expo/
```

### Archivos de simulación

Los `.txt` están ignorados actualmente por `.gitignore`. Si deseas versionar simulaciones o documentación técnica en `.txt`, ajusta esa regla.

---

## Autor

**Byron De Paz**  
**BDevDPaz**

---

## Licencia

Privada / Propietaria
MD
```
