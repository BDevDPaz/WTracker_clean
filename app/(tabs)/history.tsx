<<<<<<< HEAD
import React, { memo, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/theme';
import {
  LuxuryCard,
  LuxuryEmptyState,
  LuxuryButton,
  LuxuryInput,
  GlassModalWrapper,
} from '../../src/components/ui/LuxuryUI';
import {
  getHistory,
  getSettings,
  deleteWorkSession,
  updateWorkSessionManual,
  checkSessionOverlap,
} from '../../src/database/db';
import { WorkSession } from '../../src/engine/contracts/types';
import { formatDate, formatTime } from '../../src/utils/dateUtils';
import { log } from '../../src/utils/logger';
import { generateWeeklyReport } from '../../src/services/ReportGenerator';
import { calculateSessionMinutes, calculatePayFromMinutes } from '../../src/utils/payrollUtils';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { historyEditSchema } from '../../src/utils/validation';
import { z } from 'zod';

function HistoryScreenComponent() {
  const router = useRouter();
  const { showToast, showDialog } = useLuxuryUI();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [estEarnings, setEstEarnings] = useState(0);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');
  const [editNote, setEditNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadHistory = async () => {
    try {
      const data = await getHistory();
      setSessions(data);

      const settings = await getSettings();
      const rate = settings?.hourly_rate || 0;

      let totalMinutes = 0;
      let totalEstPay = 0;
      const otMultiplier = settings?.overtime_multiplier || 1.5;

      data.forEach((s: WorkSession) => {
        if (s.start_time && s.end_time) {
          const sessionMinutes = calculateSessionMinutes(
            s.start_time,
            s.end_time,
            s.lunch_taken,
            s.lunch_start,
            s.lunch_end
          );
          totalMinutes += sessionMinutes;

          const { totalPay } = calculatePayFromMinutes(sessionMinutes, rate, otMultiplier);
          totalEstPay += totalPay;
        }
      });

      setTotalHours(totalMinutes / 60);
      setEstEarnings(totalEstPay);
    } catch (_e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error cargando historial', _e);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const formatTimeInput = (text: string, setter: (val: string) => void) => {
    let clean = text.replace(/[^0-9]/g, '');
    if (clean.length >= 3) {
      clean = clean.substring(0, 2) + ':' + clean.substring(2, 4);
    }
    setter(clean);
  };

  const handleDelete = (id: number) => {
    showDialog({
      title: 'BORRAR REGISTRO',
      message: '¿Estás seguro de que deseas eliminar permanentemente esta sesión?',
      confirmText: 'ELIMINAR',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteWorkSession(id);
          log('NARANJA', 'ACCION_DESTRUCTIVA', 'EVENT', `Registro eliminado manualmente ID: ${id}`);
          showToast('Registro eliminado', 'success');
          void loadHistory();
        } catch (_e) {
          log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al borrar registro', _e);
        }
      },
    });
=======
// app/(tabs)/history.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Modal, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '../../src/context/LanguageContext';
import { getDB, deleteWorkSession, updateWorkSessionManual } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { generateWeeklyReport } from '../../src/services/ReportGenerator';

export default function HistoryScreen() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  
  // ✅ LO NUEVO: Estado para el Modal de Edición
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [editNote, setEditNote] = useState('');
  
  // Usamos strings para editar horas (HH:MM)
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    const db = getDB();
    const res = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE status != 'deleted' ORDER BY start_time DESC LIMIT 50"
    );
    setSessions(res);
  };

  // --- ACCIONES ---

  const handleDelete = (id: number) => {
    Alert.alert(
      t.btn_delete || "Eliminar", 
      "¿Seguro que deseas eliminar este registro?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: 'destructive', 
          onPress: async () => {
            await deleteWorkSession(id);
            loadHistory();
          } 
        }
      ]
    );
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
  };

  const openEdit = (item: WorkSession) => {
    setSelectedSession(item);
    setEditNote(item.manual_note || '');
<<<<<<< HEAD
    setEditTimeIn(dayjs(item.start_time).format('HH:mm'));
    setEditTimeOut(item.end_time ? dayjs(item.end_time).format('HH:mm') : '');
    setErrors({});
=======
    
    // Convertimos Timestamp a "HH:mm" para editar fácil
    const dIn = new Date(item.start_time);
    setEditTimeIn(`${pad(dIn.getHours())}:${pad(dIn.getMinutes())}`);

    if (item.end_time) {
      const dOut = new Date(item.end_time);
      setEditTimeOut(`${pad(dOut.getHours())}:${pad(dOut.getMinutes())}`);
    } else {
      setEditTimeOut('');
    }

>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!selectedSession || !selectedSession.id) return;

<<<<<<< HEAD
    try {
      const validated = historyEditSchema.parse({
        timeIn: editTimeIn,
        timeOut: editTimeOut,
        note: editNote,
      });

      const hIn = Number(validated.timeIn.substring(0, 2));
      const mIn = Number(validated.timeIn.substring(3, 5));
      const newStart = dayjs(selectedSession.start_time)
        .hour(hIn)
        .minute(mIn)
        .second(0)
        .millisecond(0);

      let newEnd = null;
      if (validated.timeOut && validated.timeOut.length === 5) {
        const hOut = Number(validated.timeOut.substring(0, 2));
        const mOut = Number(validated.timeOut.substring(3, 5));
        newEnd = dayjs(selectedSession.start_time)
          .hour(hOut)
          .minute(mOut)
          .second(0)
          .millisecond(0);
      }

      const hasOverlap = await checkSessionOverlap(
        newStart.valueOf(),
        newEnd ? newEnd.valueOf() : 0,
        selectedSession.id
      );

      if (hasOverlap) {
        log(
          'AMARILLO',
          'ADVERTENCIA',
          'WARN',
          'Horario en conflicto con otra sesión. Por favor, verifica las horas.'
        );
        showToast('Horario en conflicto', 'error');
        return;
      }

      await updateWorkSessionManual(
        selectedSession.id,
        newStart.valueOf(),
        newEnd ? newEnd.valueOf() : null,
        validated.note
      );

      log(
        'AMARILLO',
        'CONFIG_MODIFICADA',
        'WARN',
        `Registro modificado manualmente ID: ${selectedSession.id}`
      );
      setEditModalVisible(false);
      showToast('Cambios guardados', 'success');
      setErrors({});
      void loadHistory();
    } catch (e) {
      if (e instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        e.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error editando registro', e);
      }
    }
  };

  const renderItem = useCallback(({ item }: { item: WorkSession }) => (
    <TouchableOpacity
      testID={`history-record-${item.id}`}
      onPress={() => openEdit(item)}
      onLongPress={() => handleDelete(item.id!)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Sesión del ${formatDate(item.start_time)} en ${item.address}`}
      accessibilityHint="Toca para editar, mantén presionado para eliminar"
    >
      <LuxuryCard style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.date}>{formatDate(item.start_time)}</Text>
          <View style={styles.statusBadge}>
            {item.is_manual_edit === 1 && (
              <Ionicons name='pencil' size={12} color={COLORS.gold} style={{ marginRight: 6 }} />
            )}
            <View
              style={[
                styles.dot,
                { backgroundColor: item.status === 'active' ? COLORS.success : '#666' },
              ]}
            />
          </View>
        </View>

        <Text style={styles.address} numberOfLines={1} ellipsizeMode="tail">{item.address}</Text>

        <View style={styles.timeContainer}>
          <Text style={styles.time}>{formatTime(item.start_time)}</Text>
          <Ionicons name='arrow-forward' size={12} color={COLORS.gold} />
          <Text style={styles.time}>{item.end_time ? formatTime(item.end_time) : '...'}</Text>
        </View>
      </LuxuryCard>
    </TouchableOpacity>
  ), [openEdit, handleDelete]);

  return (
    <SafeAreaView testID='history-screen' style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver al Inicio"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gold} />
          <Text style={styles.backText}>INICIO</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <TouchableOpacity
            testID='history-pdf-button'
            accessibilityRole='button'
            accessibilityLabel='Generar reporte PDF'
            style={styles.pdfBtn}
            onPress={() => {
              log('VERDE', 'OPERACION_EXITOSA', 'INFO', 'Generando reporte en PDF manualmente');
              void generateWeeklyReport(true);
            }}
          >
            <Ionicons name='document-text' size={16} color='#000' />
            <Text style={styles.pdfText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.header}>HISTORIAL</Text>
        <Text style={styles.subHeader}>
          ESTA SEMANA: <Text style={{ color: '#FFF' }}>{totalHours.toFixed(1)}h</Text> •{' '}
          <Text style={{ color: COLORS.gold }}>${estEarnings.toFixed(0)}</Text>
        </Text>
      </View>

      <FlatList
        testID='history-list'
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
        ListEmptyComponent={<LuxuryEmptyState text='No hay actividad reciente' icon='time-outline' />}
        showsVerticalScrollIndicator={false}
      />

      <GlassModalWrapper visible={editModalVisible}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>EDITAR REGISTRO</Text>
          <TouchableOpacity
            testID='history-edit-close'
            accessibilityRole='button'
            accessibilityLabel='Cerrar modal de edición'
            onPress={() => setEditModalVisible(false)}
            style={styles.closeBtn}
          >
            <Ionicons name='close' size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <LuxuryInput
          label='ENTRADA (HH:MM)'
          testID='history-edit-time-in'
          value={editTimeIn}
          onChangeText={(t: string) => {
            formatTimeInput(t, setEditTimeIn);
            if (errors.timeIn) setErrors(prev => {
              const next = {...prev};
              delete next.timeIn;
              return next;
            });
          }}
          keyboardType='number-pad'
          maxLength={5}
          placeholder='00:00'
          error={errors.timeIn}
        />

        <LuxuryInput
          label='SALIDA (HH:MM)'
          testID='history-edit-time-out'
          value={editTimeOut}
          onChangeText={(t: string) => {
            formatTimeInput(t, setEditTimeOut);
            if (errors.timeOut) setErrors(prev => {
              const next = {...prev};
              delete next.timeOut;
              return next;
            });
          }}
          placeholder='En progreso...'
          keyboardType='number-pad'
          maxLength={5}
          error={errors.timeOut}
        />

        <LuxuryInput
          label='NOTA AUDITORÍA'
          testID='history-edit-note'
          value={editNote}
          onChangeText={(t: string) => {
            setEditNote(t);
            if (errors.note) setErrors(prev => {
              const next = {...prev};
              delete next.note;
              return next;
            });
          }}
          placeholder='Razón del cambio...'
          error={errors.note}
        />

        <View style={{ gap: 8, marginTop: 10 }}>
          <LuxuryButton text='GUARDAR CAMBIOS' onPress={saveEdit} variant='primary' />
          <LuxuryButton
            text='CANCELAR'
            onPress={() => setEditModalVisible(false)}
            variant='outline'
          />
        </View>
      </GlassModalWrapper>
=======
    // Convertir string HH:mm de vuelta a Timestamp
    const baseDate = new Date(selectedSession.start_time); 
    
    // Parsear Entrada
    const [hIn, mIn] = editTimeIn.split(':').map(Number);
    const newStart = new Date(baseDate);
    newStart.setHours(hIn || 0, mIn || 0);

    // Parsear Salida (si existe)
    let newEnd = null;
    if (editTimeOut) {
      const [hOut, mOut] = editTimeOut.split(':').map(Number);
      newEnd = new Date(baseDate);
      newEnd.setHours(hOut || 0, mOut || 0);
    }

    await updateWorkSessionManual(
      selectedSession.id, 
      newStart.getTime(), 
      newEnd ? newEnd.getTime() : null, 
      editNote
    );

    setEditModalVisible(false);
    loadHistory();
  };

  const pad = (n: number) => n < 10 ? '0'+n : n;

  // --- RENDER ---

  const renderItem = ({ item }: { item: WorkSession }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => openEdit(item)} // ✅ Tocar para editar
      onLongPress={() => handleDelete(item.id!)} // ✅ Mantener para borrar
    >
      <View style={styles.row}>
        <Text style={styles.date}>{new Date(item.start_time).toLocaleDateString()}</Text>
        <View style={{flexDirection:'row', gap:5}}>
          {item.is_manual_edit === 1 && <Text style={{color:'orange'}}>✎</Text>}
          <Text style={[styles.status, {color: item.status==='active'?'#4CAF50':'#AAA'}]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.address}>{item.address}</Text>
      <Text style={styles.time}>
        {new Date(item.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
        {' ➔ '}
        {item.end_time ? new Date(item.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}
      </Text>
      <Text style={styles.hint}>Toca para editar • Mantén para borrar</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>{t.history_title}</Text>
        <TouchableOpacity style={styles.pdfBtn} onPress={() => generateWeeklyReport(true)}>
          <Text style={styles.pdfText}>📄 PDF</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>{t.no_activity}</Text>}
      />

      {/* MODAL DE EDICIÓN SIMPLE */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalCenter}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Registro</Text>
            
            <Text style={styles.label}>Hora Entrada (HH:MM)</Text>
            <TextInput 
              style={styles.input} 
              value={editTimeIn} 
              onChangeText={setEditTimeIn} 
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Hora Salida (HH:MM)</Text>
            <TextInput 
              style={styles.input} 
              value={editTimeOut} 
              onChangeText={setEditTimeOut} 
              placeholder="En progreso..."
              placeholderTextColor="#666"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Nota de Auditoría (Obligatorio)</Text>
            <TextInput 
              style={styles.input} 
              value={editNote} 
              onChangeText={setEditNote} 
              placeholder="Razón del cambio..."
              placeholderTextColor="#666"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.btnCancel}>
                <Text style={{color:'white'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={styles.btnSave}>
                <Text style={{color:'white', fontWeight:'bold'}}>Guardar Cambios</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 0,
    gap: 16
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  backText: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.gold,
    fontSize: 10,
    letterSpacing: 1,
  },
  summaryContainer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 10,
  },
  header: { fontFamily: 'Montserrat_300Light', fontSize: 32, color: '#FFF' },
  subHeader: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: 6,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
  },
  pdfText: { fontFamily: 'Montserrat_700Bold', color: '#000', fontSize: 10 },
  card: { marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  date: { fontFamily: 'Montserrat_400Regular', color: COLORS.textSecondary, fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  address: {
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFF',
    fontSize: 16,
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceHighlight,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  time: { fontFamily: 'Montserrat_400Regular', color: '#DDD', fontSize: 13 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    color: '#FFF',
    fontSize: 18,
    letterSpacing: 1,
  },
  closeBtn: { padding: 5 },
});

export default memo(HistoryScreenComponent);

=======
  container: { flex: 1, backgroundColor: '#000' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  pdfBtn: { backgroundColor: '#FFD700', padding: 8, borderRadius: 8 },
  pdfText: { fontWeight: 'bold', color: '#000' },
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth:1, borderColor:'#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  date: { color: '#AAA', fontWeight:'bold' },
  status: { fontSize: 10, fontWeight:'bold' },
  address: { color: '#FFF', fontSize: 16, marginBottom: 5 },
  time: { color: '#888' },
  empty: { color: '#666', textAlign: 'center', marginTop: 50 },
  hint: { color: '#444', fontSize: 10, marginTop: 10, fontStyle:'italic', textAlign:'right' },
  
  // Modal Styles
  modalCenter: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalCard: { backgroundColor: '#222', padding: 20, borderRadius: 15 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign:'center' },
  label: { color: '#AAA', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#333', color: 'white', padding: 10, borderRadius: 8, fontSize: 16 },
  modalButtons: { flexDirection: 'row', marginTop: 20, gap: 10 },
  btnCancel: { flex: 1, padding: 15, backgroundColor: '#444', borderRadius: 8, alignItems:'center' },
  btnSave: { flex: 1, padding: 15, backgroundColor: '#007AFF', borderRadius: 8, alignItems:'center' }
});
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
