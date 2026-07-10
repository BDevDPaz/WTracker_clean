<<<<<<< HEAD
import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/constants/theme";

export default function TabsLayout() {
=======
// app/(tabs)/_layout.tsx
import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useLanguage } from '../../src/context/LanguageContext';
import { setupNotifications, scheduleDailyMorningNotification, snoozeNotification } from '../../src/services/Notifications';
import { insertWorkSession } from '../../src/database/db'; // ✅ Para crear sesión de tránsito

export default function TabLayout() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    // ✅ Configurar notificaciones y alarma diaria
    setupNotifications();
    scheduleDailyMorningNotification();

    // ✅ Listener para respuestas de notificaciones
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const action = response.notification.request.content.data.action;

      if (action === 'OPEN_DAILY_SETUP') {
        router.push('/(tabs)?showSetup=true');
      }

      // 🧠 Lógica para MULTISITIO (Tránsito pagado)
      if (action === 'CHECKOUT_DECISION') {
        Alert.alert(
          t.alert_exit_title || "Salida Detectada 🛑",
          t.alert_exit_msg || "¿Terminaste tu día o vas a otro sitio?",
          [
            {
              text: t.btn_finished || "Terminé por hoy",
              style: "cancel"
              // No hacemos nada, la sesión ya se cerró en LocationManager
            },
            {
              text: t.btn_moving || "Voy a otro sitio (Pagado)",
              onPress: async () => {
                // ✅ 1. Crear sesión de tránsito pagado
                await insertWorkSession({
                  start_time: Date.now(),
                  status: 'travel', // 🚗 Estado especial
                  address: t.transit_msg || "En Tránsito",
                  latitude: 0,
                  longitude: 0,
                  location_confirmed: 0,
                  is_manual_edit: 0,
                  lunch_taken: 0,
                  date_string: new Date().toISOString().split('T')[0]
                });

                // ✅ 2. Programar aviso en 45 minutos
                await snoozeNotification(45);
                Alert.alert("Buen viaje", "Tu tiempo de viaje está siendo registrado. Te avisaré en 45 min.");
              }
            }
          ]
        );
      }
    });

    return () => subscription.remove();
  }, []);

>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
<<<<<<< HEAD
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          paddingTop: 6,
          paddingBottom: 10,
          height: 70,
        },
        tabBarLabelStyle: {
          fontFamily: "Montserrat_600SemiBold",
          fontSize: 10,
        },
=======
        tabBarStyle: {
          backgroundColor: '#121212',
          borderTopColor: '#333',
          height: 60 + (Platform.OS === 'android' ? insets.bottom : 0),
          paddingBottom: 8 + (Platform.OS === 'android' ? insets.bottom : 0),
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
<<<<<<< HEAD
          title: "Inicio",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="report"
        options={{
          title: "Reporte",
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "Historial",
          tabBarIcon: ({ color }) => (
            <Ionicons name="time" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="legal"
        options={{
          title: "Legal",
          tabBarIcon: ({ color }) => (
            <Ionicons name="shield-checkmark" size={20} color={color} />
=======
          title: t.header_title || 'Tracker',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="timer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t.history_title || 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings_title || 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
          ),
        }}
      />
    </Tabs>
  );
}
