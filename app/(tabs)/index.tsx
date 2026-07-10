<<<<<<< HEAD
import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

import { engine } from '../../src/engine/workTrackerEngine';
import { selectActiveSession, selectIsLoading } from '../../src/engine/selectors/workTrackerSelectors';
import { useLanguage } from '../../src/context/LanguageContext';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { COLORS } from '../../src/constants/theme';
import {
  LuxuryCard,
  LuxuryButton,
  GlassModalWrapper,
} from '../../src/components/ui/LuxuryUI';
import { formatTime } from '../../src/utils/dateUtils';
import { DailySetupModal } from '../../src/components/modals/DailySetupModal';
import { LunchModal } from '../../src/components/modals/LunchModal';
import { log } from '../../src/utils/logger';
import { getHistory, getSettings } from '../../src/database/db';
import { calculateSessionMinutes } from '../../src/utils/payrollUtils';
import dayjs from '../../src/utils/dayjsSetup';

function HomeScreenComponent() {
  const { t } = useLanguage();
  const { showToast } = useLuxuryUI();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Engine state
  const [engineState, setEngineState] = useState(engine.getState());

  const activeSession = useMemo(() => selectActiveSession(engineState), [engineState]);
  const isProcessing = useMemo(() => selectIsLoading(engineState), [engineState]);

  const [stats, setStats] = useState({ hours: 0, earnings: 0 });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupMode, setSetupMode] = useState<'start' | 'transit'>('start');
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Easter Egg
  const [tapCount, setTapCount] = useState(0);
  const [showSpecialCard, setShowSpecialCard] = useState(false);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setEngineState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    engine.dispatch({ type: 'APP_INIT' });
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const history = await getHistory();
      const settings = await getSettings();
      const rate = settings?.hourly_rate || 0;

      let totalMinutes = 0;
      const today = dayjs().format('YYYY-MM-DD');

      history.forEach((s) => {
        if (s.date_string === today && s.status === 'completed' && s.start_time && s.end_time) {
          totalMinutes += calculateSessionMinutes(
            s.start_time,
            s.end_time,
            s.lunch_taken || 0,
            s.lunch_start,
            s.lunch_end
          );
        }
      });

      const hours = totalMinutes / 60;
      setStats({ hours, earnings: hours * rate });
    } catch (_e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error cargando estadísticas', _e);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [activeSession, loadStats]);

  useEffect(() => {
    if (params.showSetup === 'true') {
      setSetupMode('start');
      setShowSetupModal(true);
    }
    if (params.showCheckoutPrompt === 'true') {
       setShowLunchModal(true);
    }
  }, [params]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await engine.dispatch({ type: 'APP_INIT' });
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleSetupSubmit = (addr: string, client: string, notes: string) => {
    setShowSetupModal(false);
    router.setParams({ showSetup: undefined });
    engine.dispatch({ type: 'START_SESSION_REQUEST', address: addr, client, notes });
  };

  const handleClockOut = () => {
    setShowLunchModal(true);
  };

  const completeSession = (lunchMin: number) => {
  setShowLunchModal(false);
  router.setParams({ showCheckoutPrompt: undefined });
  engine.dispatch({
    type: 'STOP_SESSION_REQUEST',
    lunchMinutes: lunchMin,
    source: 'manual',
  });
  showToast(t.toast_shift_ended || 'Jornada finalizada', 'success');
};

  const handleEasterEggTap = () => {
    const nextTap = tapCount + 1;
    setTapCount(nextTap);

    iconScale.value = withSequence(withSpring(1.5), withSpring(1));

    if (nextTap >= 7) {
      setShowSpecialCard(true);
      setTapCount(0);
    }
  };

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const getStatusIcon = () => {
    if (!activeSession) return 'power-outline';
    if (activeSession.status === 'pending_arrival') return 'location-outline';
    return 'briefcase-outline';
  };

  const getStatusColor = () => {
    if (!activeSession) return COLORS.textSecondary;
    if (activeSession.status === 'pending_arrival') return '#f59e0b';
    return COLORS.success;
  };

  const displayAddress = activeSession?.address || t.no_activity || 'No hay actividad registrada.';

  return (
    <SafeAreaView testID='home-screen' style={styles.container} edges={['top']}>
      <ScrollView
        testID='home-scroll-view'
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
      >
        <Animated.View entering={FadeIn} testID='home-header' style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text testID='home-title' style={styles.appTitle}>
                {t.header_title || 'WTracker'}
              </Text>
              <TouchableOpacity
                testID='home-easter-egg-trigger'
                onPress={handleEasterEggTap}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Easter Egg"
                accessibilityHint="Muestra información del desarrollador"
              >
                <Animated.View style={animatedIconStyle}>
                  <Ionicons name='flash' size={18} color={COLORS.gold} />
                </Animated.View>
              </TouchableOpacity>
            </View>

            <View testID='home-status-badge' style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: activeSession
                      ? activeSession.status === 'active'
                        ? COLORS.success
                        : '#f59e0b'
                      : '#666',
                  },
                ]}
              />
              <Text testID='home-status-text' style={styles.statusText}>
                {!activeSession
                  ? t.status_inactive
                  : activeSession.status === 'pending_arrival'
                    ? t.status_pending
                    : activeSession.status === 'travel'
                      ? t.status_transit
                      : t.status_active}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100)} testID='home-card-wrapper'>
          <LuxuryCard active={!!activeSession} style={{ minHeight: 220, justifyContent: 'center' }}>
            {isProcessing ? (
              <ActivityIndicator testID='home-loading-indicator' size='large' color={COLORS.gold} />
            ) : (
              <View testID='home-session-state' style={{ alignItems: 'center' }}>
                <View
                  testID='home-icon-bubble'
                  style={[
                    styles.iconBubble,
                    activeSession && { backgroundColor: 'rgba(255,255,255,0.05)' },
                  ]}
                >
                  <Ionicons name={getStatusIcon()} size={32} color={getStatusColor()} />
                </View>

                <Text testID='home-location-label' style={styles.label}>
                  {activeSession?.status === 'pending_arrival'
                    ? t.label_destination
                    : t.label_location}
                </Text>

                <Text
                  testID='home-address'
                  style={[
                    styles.addressText,
                    activeSession && { color: '#FFF' },
                  ]}
                >
                  {displayAddress}
                </Text>

                {activeSession && activeSession.status !== 'pending_arrival' && (
                  <View testID='home-timer-badge' style={styles.timerBadge}>
                    <Ionicons name='time-outline' size={14} color={COLORS.gold} />
                    <Text testID='home-timer-text' style={styles.timerText}>
                      {formatTime(
                        activeSession.actual_start_time || activeSession.start_time
                      )}{' '}
                      - En curso
                    </Text>
                  </View>
                )}

                {activeSession?.status === 'pending_arrival' && (
                  <Text
                    testID='home-geofence-hint'
                    style={{
                      color: '#f59e0b',
                      fontSize: 10,
                      marginTop: 10,
                      fontFamily: 'Montserrat_600SemiBold',
                    }}
                  >
                    {t.hint_geofence_active}
                  </Text>
                )}
              </View>
            )}
          </LuxuryCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} testID='home-primary-action-wrapper'>
          <LuxuryButton
            testID='home-primary-action'
            style={{ marginBottom: 16 }}
            text={activeSession ? t.btn_clock_out : t.btn_new_job}
            variant={activeSession ? 'danger' : 'primary'}
            onPress={
              activeSession
                ? handleClockOut
                : () => {
                    setSetupMode('start');
                    setShowSetupModal(true);
                  }
            }
            disabled={isProcessing}
            icon={
              <Ionicons
                name={activeSession ? 'stop' : 'play'}
                size={18}
                color={activeSession ? '#FFF' : '#000'}
              />
            }
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} testID='home-stats-container' style={styles.statsContainer}>
          <LuxuryCard style={styles.statBox}>
            <Text style={styles.statLabel}>{t.stats_hours}</Text>
            <Text testID='home-hours-value' style={styles.statValue}>
              {stats.hours.toFixed(1)}h
            </Text>
          </LuxuryCard>

          <LuxuryCard style={[styles.statBox, styles.statBoxGold]}>
            <Text style={[styles.statLabel, { color: COLORS.gold }]}>
              {t.stats_earnings}
            </Text>
            <Text
              testID='home-earnings-value'
              style={[styles.statValue, { color: COLORS.gold }]}
            >
              ${stats.earnings.toFixed(0)}
            </Text>
          </LuxuryCard>
        </Animated.View>

        <DailySetupModal
          visible={showSetupModal}
          onClose={() => {
            setShowSetupModal(false);
            router.setParams({ showSetup: undefined });
          }}
          onStart={handleSetupSubmit}
          mode={setupMode}
        />

        <LunchModal
          visible={showLunchModal}
          onConfirm={completeSession}
          onCancel={() => setShowLunchModal(false)}
        />

        <GlassModalWrapper visible={showSpecialCard}>
          <View testID='home-special-card' style={{ alignItems: 'center', padding: 10 }}>
            <Ionicons
              name='trophy'
              size={40}
              color={COLORS.gold}
              style={{ marginBottom: 20 }}
            />
            <Text style={styles.eggTitle}>WTracker Special Edition</Text>
            <Text style={styles.eggAuthor}>by BDevDPaz</Text>
            <View style={styles.eggDivider} />
            <Text style={styles.eggText}>
              Para uso restringido de{"\n"}
              <Text style={{ color: '#FFF' }}>Alex León</Text>
              {"\n"}
              CEO de WTracker Corp
            </Text>
            <LuxuryButton
              testID='home-special-card-close'
              text={t.btn_close || 'CERRAR'}
              onPress={() => setShowSpecialCard(false)}
              variant='outline'
              style={{ marginTop: 30 }}
            />
          </View>
        </GlassModalWrapper>
=======
// app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'; 
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { getDB, insertWorkSession, updateSessionEndTime, getSettings } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { LocationService } from '../../src/services/LocationManager';
import { DailySetupModal } from '../../src/components/DailySetupModal';
import { LunchModal } from '../../src/components/LunchModal';
import { useLanguage } from '../../src/context/LanguageContext';

export default function HomeScreen() {
  const { t } = useLanguage();
  const router = useRouter(); // ✅ Necesario para limpiar la orden
  const params = useLocalSearchParams(); // ✅ Leemos los parámetros

  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [address, setAddress] = useState<string>('Cargando...');
  const [stats, setStats] = useState({ hours: 0, earnings: 0 });
  
  // Modales y Carga
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // ✅ Nuevo estado para evitar "trabe" visual

  // Cargar datos
  const loadData = async () => {
    try {
      const db = getDB();
      const settings = await getSettings();

      // Buscar sesión activa
      const session = await db.getFirstAsync<WorkSession>(
        "SELECT * FROM work_sessions WHERE status = 'active' OR status = 'travel' ORDER BY id DESC"
      );
      
      setActiveSession(session || null);
      
      if (session) {
        setAddress(session.address);
      } else {
        setAddress(t.status_inactive || "Fuera de Servicio");
      }

      calculateDailyStats(settings);

    } catch (e) {
      console.error("Error loading data:", e);
    }
  };

  const calculateDailyStats = async (currentSettings: any) => {
    if (!currentSettings) return;
    const db = getDB();
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const sessions = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE start_time >= ?", 
      [startOfDay.getTime()]
    );

    let totalMs = 0;
    sessions.forEach(s => {
      const end = s.end_time ? s.end_time : Date.now();
      let duration = end - s.start_time;
      if (s.lunch_taken) duration -= 3600000; 
      totalMs += Math.max(0, duration);
    });

    const hours = totalMs / (1000 * 60 * 60);
    const earnings = hours * currentSettings.hourly_rate;

    setStats({ 
      hours: parseFloat(hours.toFixed(2)), 
      earnings: parseFloat(earnings.toFixed(2)) 
    });
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // ✅ CORRECCIÓN CRÍTICA: BUCLE INFINITO
  useEffect(() => {
    if (params.showSetup === 'true') {
      console.log("🔔 Notificación recibida: Abriendo modal...");
      setShowDailyModal(true);
      
      // 🔥 ESTO FALTABA: Borramos la orden inmediatamente
      router.setParams({ showSetup: undefined }); 
    }
  }, [params.showSetup]);

  // Acciones
  const handleStartDay = async (addr: string) => {
    setIsProcessing(true); // Mostramos spinner
    try {
      // 1. Permisos
      const perm = await LocationService.requestPermissions();
      if (!perm) {
        Alert.alert("Permiso Requerido", "Necesitamos acceso a tu ubicación.");
        setIsProcessing(false);
        return;
      }

      // 2. Obtener GPS
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      
      // 3. Guardar en DB
      await insertWorkSession({
        start_time: Date.now(),
        status: 'active',
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: addr,
        location_confirmed: 1,
        is_manual_edit: 0,
        lunch_taken: 0,
        date_string: new Date().toISOString().split('T')[0]
      });

      // 4. Iniciar Rastreo
      await LocationService.startActiveTracking();
      
      // 5. Cerrar y Recargar
      setShowDailyModal(false);
      await loadData();

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo iniciar la sesión.");
    } finally {
      setIsProcessing(false); // Ocultamos spinner
    }
  };

  const handleClockOut = async () => {
    if (!activeSession) return;
    if (activeSession.lunch_taken === 0 && activeSession.status !== 'travel') {
        setShowLunchModal(true);
    } else {
        await completeSession();
    }
  };

  const completeSession = async (deductLunch = false) => {
     setIsProcessing(true);
     try {
       if (activeSession) {
         if (deductLunch) {
             const db = getDB();
             await db.runAsync("UPDATE work_sessions SET lunch_taken = 1 WHERE id = ?", [activeSession.id]);
         }
         await updateSessionEndTime(activeSession.id!, Date.now());
         await LocationService.stopMonitoring();
       }
       setShowLunchModal(false);
       await loadData();
       Alert.alert("Jornada Finalizada", "Horas registradas correctamente.");
     } catch (e) {
       console.error(e);
     } finally {
       setIsProcessing(false);
     }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF"/>}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
             <Text style={styles.greeting}>{t.header_title || "WorkTracker"}</Text>
             <Text style={styles.subGreeting}>{activeSession ? t.status_active : t.status_inactive}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowDailyModal(true)} style={styles.iconBtn}>
            <Ionicons name="add-circle-outline" size={32} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* TARJETA PRINCIPAL (ESTADO) */}
        <View style={[styles.card, activeSession ? styles.cardActive : styles.cardInactive]}>
           {isProcessing ? (
             <ActivityIndicator size="large" color="#FFF" style={{margin: 20}} />
           ) : (
             <>
               <Ionicons 
                 name={activeSession ? (activeSession.status==='travel' ? "car-sport" : "location") : "moon"} 
                 size={40} 
                 color="#FFF" 
                 style={{marginBottom: 10}}
               />
               <Text style={styles.addressText}>{address}</Text>
               {activeSession && (
                 <Text style={styles.timerText}>
                   {new Date(activeSession.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - En curso
                 </Text>
               )}
             </>
           )}
        </View>

        {/* BOTÓN DE ACCIÓN */}
        <TouchableOpacity 
          style={[
            activeSession ? styles.stopBtn : styles.startBtn,
            isProcessing && { opacity: 0.5 }
          ]} 
          onPress={activeSession ? handleClockOut : () => setShowDailyModal(true)}
          disabled={isProcessing}
        >
          <Text style={styles.btnText}>
            {activeSession ? t.btn_clock_out : t.btn_new_job}
          </Text>
        </TouchableOpacity>

        {/* ESTADÍSTICAS HOY */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t.stats_hours}</Text>
            <Text style={styles.statValue}>{stats.hours.toFixed(2)}h</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t.stats_earnings}</Text>
            <Text style={styles.statValue}>${stats.earnings.toFixed(2)}</Text>
          </View>
        </View>

        {/* MODALES */}
        <DailySetupModal 
          visible={showDailyModal} 
          onClose={() => {
            setShowDailyModal(false);
            router.setParams({ showSetup: undefined }); // Limpiar también al cerrar manual
          }}
          onStart={handleStartDay}
        />
        
        <LunchModal
          visible={showLunchModal}
          onConfirm={() => completeSession(true)}
          onCancel={() => completeSession(false)}
        />

>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  appTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 28,
    color: '#FFF',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconBubble: {
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
  },
  addressText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: COLORS.textSecondary,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timerText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: COLORS.gold,
    fontSize: 12,
  },
  statsContainer: { flexDirection: 'row', gap: 14 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 0,
  },
  statBoxGold: {
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  statLabel: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    color: '#FFF',
    fontSize: 22,
  },
  eggTitle: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.gold,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 5,
  },
  eggAuthor: {
    fontFamily: 'Montserrat_400Regular',
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  eggDivider: {
    height: 1,
    width: 50,
    backgroundColor: COLORS.border,
    marginBottom: 20,
  },
  eggText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: '#AAA',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default memo(HomeScreenComponent);
=======
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subGreeting: { fontSize: 14, color: '#AAA', marginTop: 2 },
  iconBtn: { padding: 5 },
  card: { padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 20, shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, minHeight: 150, justifyContent: 'center' },
  cardActive: { backgroundColor: '#2E7D32' },
  cardInactive: { backgroundColor: '#1E1E1E' },
  addressText: { color: '#FFF', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 5 },
  timerText: { color: '#DDD', fontSize: 14 },
  startBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  stopBtn: { backgroundColor: '#D32F2F', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  statsContainer: { flexDirection: 'row', gap: 15 },
  statBox: { flex: 1, backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, alignItems: 'center' },
  statLabel: { color: '#AAA', fontSize: 12, marginBottom: 5 },
  statValue: { color: '#FFD700', fontSize: 22, fontWeight: 'bold' }
});
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
