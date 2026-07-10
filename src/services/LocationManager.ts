<<<<<<< HEAD
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

import { log, logStructured } from '../utils/logger';
import {
  ensureDbReady,
  insertAuditLog,
  getAllAsync,
  updateSessionStatus,
} from '../database/db';
import { WorkSession } from '../types';
import dayjs from '../utils/dayjsSetup';
import { LocationFSM } from './LocationFSM';
import { locationAdapter } from '../runtime/locationAdapter';
import {
  getDistanceFromLatLonInMeters,
  isBeyondAutoCheckoutDistance,
  AUTO_CHECKOUT_DISTANCE_METERS,
} from '../utils/geoUtils';

export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

const fsm = new LocationFSM(AsyncStorage);

const MIN_ACCURACY_METERS = 50;

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

type GeofenceListener = () => void;

let geofenceListener: GeofenceListener | null = null;

const getSessionCenterDistance = (
  session: WorkSession,
  currentPos: { latitude: number; longitude: number }
): number => {
  const centerLatitude =
    session.target_latitude ??
    session.latitude ??
    session.setup_latitude ??
    null;

  const centerLongitude =
    session.target_longitude ??
    session.longitude ??
    session.setup_longitude ??
    null;

  if (
    typeof centerLatitude !== 'number' ||
    typeof centerLongitude !== 'number'
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return getDistanceFromLatLonInMeters(
    centerLatitude,
    centerLongitude,
    currentPos.latitude,
    currentPos.longitude
  );
};

TaskManager.defineTask(
  GEOFENCE_TASK,
  async ({ data, error }: { data: any; error: any }) => {
    if (error) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en callback de Geocerca', error);
      return;
    }

    const { eventType, region } = data as GeofenceTaskData;
    const siteId = region?.identifier;

    if (!siteId) {
      log(
        'ROJO',
        'ERROR_CRITICO',
        'ERROR',
        "Geofencing event aborted: missing 'region.identifier' in task payload."
      );
      return;
    }

    const sessionId = parseInt(siteId, 10);

    const currentPos = await locationAdapter.getCurrentLocation();

    if (!currentPos) {
      log('AMARILLO', 'GPS_DEBIL', 'WARN', 'No GPS signal, ignoring geofence event');
      return;
    }

    if (currentPos.accuracy && currentPos.accuracy > MIN_ACCURACY_METERS) {
      logStructured(
        'WARN',
        'GPS_DEBIL',
        `GPS accuracy ${currentPos.accuracy}m > ${MIN_ACCURACY_METERS}m, ignoring event`,
        {
          geoAccuracy: currentPos.accuracy ?? undefined,
          sessionId,
        }
      );
      return;
    }

    const db = await ensureDbReady();

    try {
      const session = await db.getFirstAsync<WorkSession>(
        'SELECT * FROM work_sessions WHERE id = ?',
        [sessionId]
      );

      if (!session) {
        log(
          'AMARILLO',
          'ADVERTENCIA',
          'WARN',
          `Geocerca detectada para sitio desconocido ID: ${siteId}`
        );
        return;
      }

      const distanceM = getSessionCenterDistance(session, currentPos);

      if (
        eventType === Location.GeofencingEventType.Enter &&
        Number.isFinite(distanceM) &&
        region.radius &&
        distanceM > region.radius + 100
      ) {
        logStructured(
          'WARN',
          'EVENTO_GEOCERCA',
          `Suspicious Enter event: distance ${Math.round(distanceM)}m from center`,
          {
            sessionId: session.id,
            geoAccuracy: currentPos.accuracy ?? undefined,
          }
        );
      }

      const eventName =
        eventType === Location.GeofencingEventType.Enter ? 'Enter' : 'Exit';

      const { transition } = await fsm.update(eventName, siteId);

      if (transition === 'ENTERED') {
        log(
          'NARANJA',
          'EVENTO_GEOCERCA',
          'EVENT',
          `Geocerca: ENTRADA validada para sitio ${siteId} (Hysteresis).`
        );

        if (session.status === 'pending_arrival' || session.status === 'travel') {
          const now = dayjs().valueOf();

          await Promise.all([
            db.runAsync(
              "UPDATE work_sessions SET status = 'active', actual_start_time = ? WHERE id = ?",
              [now, session.id!]
            ),
            insertAuditLog(
              session.id!,
              'AUTO_CHECKIN_GPS',
              `Auto Check-in (GPS) validado en: ${session.address}`
            ),
            AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
            Notifications.scheduleNotificationAsync({
              content: {
                title: '📍 Llegaste al sitio',
                body: `Auto Check-in (GPS) validado en ${session.client_name || session.address}. ¡Buen trabajo!`,
                sound: true,
              },
              trigger: null,
            }),
          ]);

          if (geofenceListener) geofenceListener();

          log(
            'VERDE',
            'OPERACION_EXITOSA',
            'INFO',
            `Auto Check-in (GPS) registrado para sesión #${session.id}`
          );
        }
      } else if (transition === 'EXITED') {
        log(
          'NARANJA',
          'EVENTO_GEOCERCA',
          'EVENT',
          `Geocerca: SALIDA validada para sitio ${siteId} (Hysteresis). Distancia: ${Math.round(distanceM)}m.`
        );

        if (session.status !== 'active') {
          return;
        }

        const now = dayjs().valueOf();

        if (isBeyondAutoCheckoutDistance(distanceM)) {
          await Promise.all([
            updateSessionStatus(session.id!, 'completed', 0, 'gps', now),
            AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
            Notifications.scheduleNotificationAsync({
              content: {
                title: 'Jornada finalizada por GPS 🏁',
                body: `Auto Check-out (GPS) registrado para ${session.client_name || session.address}.`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
              },
              trigger: null,
            }),
          ]);

          if (geofenceListener) geofenceListener();

          log(
            'VERDE',
            'OPERACION_EXITOSA',
            'INFO',
            `Auto Check-out (GPS) registrado para sesión #${session.id}. Distancia: ${Math.round(distanceM)}m / umbral: ${Math.round(AUTO_CHECKOUT_DISTANCE_METERS)}m`
          );

          return;
        }

        await Promise.all([
          AsyncStorage.setItem(EXIT_TIMESTAMP_KEY, now.toString()),
          insertAuditLog(
            session.id!,
            'GEOFENCE_EXIT',
            `Salida persistente del área de trabajo validada. Distancia: ${Math.round(distanceM)}m.`
          ),
          Notifications.scheduleNotificationAsync({
            content: {
              title: '⚠️ Saliste del área de trabajo',
              body: `Se detectó tu salida de ${session.client_name || session.address}.`,
              data: { action: 'CHECKOUT_DECISION', sessionId: session.id },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
          }),
        ]);
      }
    } catch (err) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error ejecutando lógica de Geocerca', err);
    }
  }
);

export const setGeofenceListener = (listener: GeofenceListener | null) => {
  geofenceListener = listener;
};

export const LocationService = {
  requestPermissions: async () => {
    return await locationAdapter.requestPermissions();
  },

  startMonitoringArrival: async (
    sites: { id: string; latitude: number; longitude: number }[],
    radius: number = 200
  ) => {
    try {
      const regions: Location.LocationRegion[] = sites.map((site) => {
        if (!site.id || Number.isNaN(site.latitude) || Number.isNaN(site.longitude)) {
          throw new Error(`Invalid site data for geofencing: ${JSON.stringify(site)}`);
        }

        return {
          identifier: site.id,
          latitude: site.latitude,
          longitude: site.longitude,
          radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        };
      });

      const warmUpResult = await locationAdapter.getCurrentLocation();

      log(
        'AZUL',
        'SERVICIOS_ACTIVOS',
        'INFO',
        `GPS Warm-up completed. Accuracy: ${warmUpResult?.accuracy ?? 'unknown'}m`
      );

      await locationAdapter.startGeofencing(GEOFENCE_TASK, regions);

      log(
        'VERDE',
        'SERVICIOS_ACTIVOS',
        'INFO',
        `Monitoreando ${sites.length} sitios para llegada con Hysteresis segregada.`
      );

      return true;
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error iniciando geocerca multi-sitio', e);
      return false;
    }
  },

  startMonitoring: async (
    sites: { id: string; latitude: number; longitude: number }[],
    radius = 100
  ) => {
    return LocationService.startMonitoringArrival(sites, radius);
  },

  stopMonitoring: async () => {
    try {
      const sessions = await getAllAsync<any>(
        "SELECT id FROM work_sessions WHERE date_string = ? AND status != 'deleted'",
        [dayjs().format('YYYY-MM-DD')]
      );

      const siteIds = sessions.map((s) => s.id.toString());

      await Promise.all([
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
        fsm.reset(siteIds),
        locationAdapter.stopGeofencing(GEOFENCE_TASK),
      ]);

      log(
        'NARANJA',
        'MONITOREO_DETENIDO',
        'WARN',
        'Monitoreo y rastreo detenidos. Storage limpio.'
      );
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error general deteniendo monitoreo', e);
    }
  },

  getCoordsFromAddress: async (address: string) => {
    return await locationAdapter.geocodeAddress(address);
  },
};

=======
// src/services/LocationManager.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { getDB, updateSessionEndTime, getSettings, insertWorkSession } from '../database/db'; // ✅ Importamos insertWorkSession
import { WorkSession } from '../types';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils';
import { translations } from '../utils/i18n';

const LOCATION_TRACKING_TASK_NAME = 'WORK_LOCATION_TRACKING_TASK';

// ✅ Tarea en segundo plano (monitoreo continuo)
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }: any) => {
  if (error || !data) return;
  const { locations } = data;
  if (!locations || !locations.length) return;

  try {
    const db = getDB();
    const location = locations[0];

    // 1. Obtener sesión activa
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    );

    if (!session) {
      // Si no hay sesión activa, detener tracking para ahorrar batería
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
      return;
    }

    // 2. Configuración (radio de tolerancia)
    const settings = await getSettings();
    const tolerance = settings?.tolerance_radius || 50;

    // 3. Calcular distancia actual vs punto inicial
    const dist = getDistanceFromLatLonInMeters(
      session.latitude, session.longitude,
      location.coords.latitude, location.coords.longitude
    );

    // 4. Si sale del rango → AUTO-CHECKOUT + Notificación interactiva
    if (dist > tolerance) {
      console.log(`📍 Salida detectada: ${dist.toFixed(0)}m > ${tolerance}m`);

      // ✅ Cerramos la sesión actual (Sitio A)
      await updateSessionEndTime(session.id!, Date.now());

      const lang = settings?.language || 'es';
      const t = translations[lang];

      // ✅ Notificación interactiva para decidir acción
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t.alert_exit_title || "Salida Detectada 🛑",
          body: t.alert_exit_msg || "¿Terminaste tu día o vas a otro sitio?",
          data: { action: 'CHECKOUT_DECISION' }, // Se usará para manejar respuesta
        },
        trigger: null,
      });

      // ✅ Detener tracking temporalmente
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    }
  } catch (err) {
    console.error("❌ Background Task Error:", err);
  }
});

// ✅ Función para crear sesión de tránsito (cuando el usuario elige “Voy a otro sitio”)
export const createTransitSession = async () => {
  const settings = await getSettings();
  const userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

  await insertWorkSession({
    start_time: Date.now(),
    status: 'travel', // 🚗 Estado especial
    address: settings?.employer_name || 'Transito',
    latitude: userLoc.coords.latitude,
    longitude: userLoc.coords.longitude,
    location_confirmed: 1,
    is_manual_edit: 0,
    lunch_taken: 0,
    date_string: new Date().toISOString().split('T')[0]
  });

  // ✅ Reactivar tracking para monitorear llegada al nuevo sitio
  await LocationService.startActiveTracking();
};

// ✅ Servicio principal
export const LocationService = {
  requestPermissions: async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  },

  startActiveTracking: async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    if (hasStarted) return;

    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 20, // Cada 20 metros
      deferredUpdatesInterval: 60000, // Cada 1 minuto
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "WorkTracker Activo",
        notificationBody: "Monitoreando ubicación de trabajo..."
      }
    });
  },

  stopMonitoring: async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    }
  }
};
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
