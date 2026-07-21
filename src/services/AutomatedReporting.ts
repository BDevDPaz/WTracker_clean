import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWeeklyReport } from './ReportGenerator';
import dayjs from 'dayjs';
import '../utils/dayjsSetup';

const TASK_NAME = 'WEEKLY_REPORT_CHECK';
const STORAGE_KEY = 'LAST_REPORT_WEEK_ID';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const now = dayjs();

    // Identificador único de la semana: lunes de la semana actual.
    const day = now.day();
    const daysSinceMonday = (day + 6) % 7;
    const currentWeekId = now
      .subtract(daysSinceMonday, 'day')
      .format('YYYY-MM-DD');

    const lastReported = await AsyncStorage.getItem(STORAGE_KEY);

    // Ventana válida: domingo desde las 10 PM, lunes o martes.
    const isWindow = (day === 0 && now.hour() >= 22) || day === 1 || day === 2;

    if (isWindow && lastReported !== currentWeekId) {
      console.log('📄 Generando reporte automático...');

      const pdfUri = await generateWeeklyReport(false);

      if (pdfUri) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Reporte Semanal Listo',
            body: 'Tu reporte ha sido generado. Toca para verlo.',
            data: { pdfUri },
          },
          trigger: null,
        });

        await AsyncStorage.setItem(STORAGE_KEY, currentWeekId);

        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (_e) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const AutomatedReporting = {
  register: async () => {
    return BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 15, // 15 minutos
      stopOnTerminate: false,
      startOnBoot: true,
    });
  },
};

