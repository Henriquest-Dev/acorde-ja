import { formatClock, formatDuration, remainingMs, startOfWeek } from '@acorde/core';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  AppBottomSheet,
  AppButton,
  AppCard,
  AppCheckbox,
  AppHeader,
  AppProgressBar,
  AppProgressRing,
  AppSlider,
  AppSwitch,
  AppText,
  BrandIcon,
  HeaderIconButton,
  Screen,
  SectionTitle,
  SegmentedControl,
  toast,
} from '@/components';
import { useFocusHistory, useLimits } from '@/hooks/queries';
import { kvGet, kvSet } from '@/repositories/kv';
import { useFocus } from '@/stores/focus';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

type Activity = { id: string; label: string; icon: React.ReactNode; minutes: number | null; description: string };

/** Modo Foco — temporizador e actividades alternativas. */
export default function Focus() {
  const { colors } = useTheme();
  const { autostart } = useLocalSearchParams<{ autostart?: string }>();
  const focus = useFocus();
  const { prefs, update } = usePrefs();
  const [tab, setTab] = useState<'timer' | 'activities'>('timer');
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState(false);
  const [notes, setNotes] = useState(false);
  const weekStart = startOfWeek(new Date()).getTime();
  const history = useFocusHistory(weekStart);
  const autostarted = useRef(false);

  useEffect(() => {
    if (!focus.loaded) void focus.load();
  }, [focus]);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      void useFocus.getState().check();
    }, 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void useFocus.getState().check());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (autostart === '1' && focus.loaded && !autostarted.current && focus.timer.status !== 'running' && focus.timer.status !== 'paused') {
      autostarted.current = true;
      void focus.start(prefs.focus.minutes, { pomodoro: prefs.focus.pomodoro });
    }
  }, [autostart, focus, prefs.focus]);

  useEffect(() => {
    if (focus.timer.status === 'completed') void history.refetch();
  }, [focus.timer.status, history]);

  const running = focus.timer.status === 'running';
  const paused = focus.timer.status === 'paused';
  const active = running || paused;
  const remaining = active ? remainingMs(focus.timer, now) : prefs.focus.minutes * 60_000;
  const duration = active ? focus.timer.durationMs : prefs.focus.minutes * 60_000;
  const weekMs = (history.data ?? []).filter((s) => s.status === 'completed').reduce((s, x) => s + x.actualMs, 0);

  const ACTIVITIES: Activity[] = [
    { id: 'reading', label: 'Leitura', icon: <Feather name="book-open" size={22} color={colors.text} />, minutes: 20, description: 'Leia um livro em papel durante 20 minutos.' },
    { id: 'exercise', label: 'Exercício', icon: <MaterialCommunityIcons name="run" size={24} color={colors.text} />, minutes: 15, description: 'Alongamentos, caminhada ou treino leve.' },
    { id: 'breathing', label: 'Respiração', icon: <MaterialCommunityIcons name="lungs" size={24} color={colors.text} />, minutes: null, description: 'Exercício guiado de 2 minutos.' },
    { id: 'notes', label: 'Anotações', icon: <Feather name="edit-3" size={21} color={colors.text} />, minutes: null, description: 'Escreva o que está a sentir ou a pensar.' },
  ];

  const runActivity = (a: Activity) => {
    if (a.id === 'breathing') return router.push('/breathing');
    if (a.id === 'notes') return setNotes(true);
    if (active) return toast('Termine a sessão actual primeiro.', 'error');
    void focus.start(a.minutes!, { activity: a.id });
    setTab('timer');
  };

  const mainAction = () => {
    if (running) void focus.pause();
    else if (paused) void focus.resume();
    else void focus.start(prefs.focus.minutes, { pomodoro: prefs.focus.pomodoro });
  };

  return (
    <Screen testID="focus">
      <AppHeader title="Modo Foco" right={<HeaderIconButton icon="sliders" label="Definições do foco" onPress={() => setSettings(true)} />} />
      <SegmentedControl
        options={[
          { value: 'timer', label: 'Temporizador' },
          { value: 'activities', label: 'Actividades' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'timer' ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xxxl }}>
          <AppProgressRing progress={active ? 1 - remaining / duration : 0.72} size={220} strokeWidth={8} showTrack={active} accessibilityLabel={`Tempo restante ${formatClock(remaining)}`}>
            <AppText variant="display" style={{ fontSize: 44, fontFamily: fonts.semibold }} testID="focus-clock">
              {formatClock(remaining)}
            </AppText>
            <AppText variant="small" tone="secondary">
              {focus.timer.phase === 'break' && active ? 'Pausa' : focus.activity ? ACTIVITIES.find((a) => a.id === focus.activity)?.label : 'Concentração'}
            </AppText>
          </AppProgressRing>
          <Pressable
            onPress={mainAction}
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pausar' : paused ? 'Retomar' : 'Iniciar sessão de foco'}
            style={({ pressed }) => [styles.play, { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}
            testID="focus-play"
          >
            <Feather name={running ? 'pause' : 'play'} size={26} color={colors.onAccent} style={{ marginLeft: running ? 0 : 3 }} />
          </Pressable>
          {active ? (
            <AppButton label="Terminar sessão" variant="ghost" size="sm" onPress={() => void focus.cancel()} style={{ marginTop: spacing.sm }} />
          ) : null}
          {focus.timer.status === 'completed' ? (
            <AppText variant="small" tone="secondary" style={{ marginTop: spacing.md }}>
              Sessão concluída. Bom trabalho!
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          {ACTIVITIES.map((a) => (
            <AppCard key={a.id} onPress={() => runActivity(a)} accessibilityLabel={a.label}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {a.icon}
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{a.label}</AppText>
                  <AppText variant="caption" tone="muted">
                    {a.description}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </AppCard>
          ))}
        </View>
      )}

      <View style={styles.activities}>
        {ACTIVITIES.map((a) => (
          <Pressable key={a.id} onPress={() => runActivity(a)} accessibilityRole="button" accessibilityLabel={a.label} style={styles.activity}>
            {a.icon}
            <AppText variant="caption" style={{ fontSize: 10, marginTop: 4 }}>
              {a.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Esta semana</SectionTitle>
      <AppCard>
        <AppText variant="small" tone="secondary">
          {formatDuration(weekMs)} de {formatDuration(prefs.focus.weeklyGoalMinutes * 60_000)} de foco
        </AppText>
        <AppProgressBar progress={weekMs / (prefs.focus.weeklyGoalMinutes * 60_000)} style={{ marginTop: spacing.sm }} />
        {(history.data ?? []).slice(0, 5).map((s) => (
          <View key={s.id} style={styles.historyRow}>
            <AppText variant="caption" tone="muted">
              {new Date(s.startedAt).toLocaleDateString('pt-PT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            </AppText>
            <AppText variant="caption">
              {formatDuration(s.actualMs)} · {s.status === 'completed' ? 'concluída' : s.status === 'cancelled' ? 'interrompida' : 'a decorrer'}
            </AppText>
          </View>
        ))}
      </AppCard>

      <FocusSettings visible={settings} onClose={() => setSettings(false)} prefs={prefs} update={update} />
      <NotesSheet visible={notes} onClose={() => setNotes(false)} />
    </Screen>
  );
}

function FocusSettings({
  visible,
  onClose,
  prefs,
  update,
}: {
  visible: boolean;
  onClose: () => void;
  prefs: ReturnType<typeof usePrefs.getState>['prefs'];
  update: ReturnType<typeof usePrefs.getState>['update'];
}) {
  const { data: limits } = useLimits();
  const setFocus = (patch: Partial<typeof prefs.focus>) => update((p) => ({ focus: { ...p.focus, ...patch } }));
  return (
    <AppBottomSheet visible={visible} onClose={onClose} title="Definições do foco">
      <AppText variant="small" tone="secondary">
        Duração: {prefs.focus.minutes} minutos
      </AppText>
      <AppSlider value={prefs.focus.minutes} min={5} max={120} step={5} onChange={(v) => void setFocus({ minutes: v })} accessibilityLabel="Duração da sessão" formatValue={(v) => `${v} minutos`} />
      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Técnica Pomodoro</AppText>
          <AppText variant="caption" tone="muted">
            Pausas de 5 min e pausa longa a cada 4 ciclos.
          </AppText>
        </View>
        <AppSwitch value={prefs.focus.pomodoro} onValueChange={(v) => void setFocus({ pomodoro: v })} accessibilityLabel="Técnica Pomodoro" />
      </View>
      <AppText variant="small" tone="secondary" style={{ marginTop: spacing.lg }}>
        Meta semanal: {Math.round(prefs.focus.weeklyGoalMinutes / 60)} horas
      </AppText>
      <AppSlider
        value={prefs.focus.weeklyGoalMinutes}
        min={60}
        max={1800}
        step={60}
        onChange={(v) => void setFocus({ weeklyGoalMinutes: v })}
        accessibilityLabel="Meta semanal de foco"
        formatValue={(v) => `${v / 60} horas`}
      />
      <AppText variant="bodyStrong" style={{ marginTop: spacing.lg }}>
        Restringir durante o foco
      </AppText>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {(limits ?? []).map((l) => (
          <View key={l.appId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <BrandIcon appId={l.appId} name={l.name} size={24} />
            <AppText variant="small" style={{ flex: 1 }}>
              {l.name}
            </AppText>
            <AppCheckbox
              checked={prefs.focusBlockedApps.includes(l.appId)}
              onChange={(v) => void update((p) => ({ focusBlockedApps: v ? [...p.focusBlockedApps, l.appId] : p.focusBlockedApps.filter((x) => x !== l.appId) }))}
              accessibilityLabel={`Restringir ${l.name} durante o foco`}
            />
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
        No Android, as aplicações escolhidas ficam bloqueadas até ao fim da sessão (requer as permissões de bloqueio).
      </AppText>
    </AppBottomSheet>
  );
}

interface JournalEntry {
  id: string;
  text: string;
  createdAt: number;
}

function NotesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  useEffect(() => {
    if (visible) void kvGet<JournalEntry[]>('journal', []).then(setEntries);
  }, [visible]);
  const save = async () => {
    if (!text.trim()) return;
    const next = [{ id: String(Date.now()), text: text.trim(), createdAt: Date.now() }, ...entries].slice(0, 200);
    await kvSet('journal', next);
    setEntries(next);
    setText('');
    toast('Anotação guardada no dispositivo.');
  };
  return (
    <AppBottomSheet visible={visible} onClose={onClose} title="Anotações">
      <TextInput
        multiline
        value={text}
        onChangeText={setText}
        placeholder="O que está a sentir agora?"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Anotação"
        style={[styles.notes, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
      />
      <AppButton label="Guardar" onPress={save} style={{ marginTop: spacing.md }} />
      {entries.slice(0, 3).map((e) => (
        <View key={e.id} style={{ marginTop: spacing.md }}>
          <AppText variant="caption" tone="muted">
            {new Date(e.createdAt).toLocaleString('pt-PT')}
          </AppText>
          <AppText variant="small" tone="secondary" numberOfLines={3}>
            {e.text}
          </AppText>
        </View>
      ))}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  play: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl },
  activities: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxxl },
  activity: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  notes: { minHeight: 120, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 15 },
});
