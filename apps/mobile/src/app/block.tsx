import {
  DEFAULT_RULE_SETTINGS,
  MINUTE,
  RuleError,
  RuleState,
  canRequestException,
  dayKey,
  formatClock,
  grantException,
  type OverrideReason,
} from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { goBack } from '@/navigation/goBack';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppBlockScreen,
  AppBottomSheet,
  AppButton,
  AppProgressRing,
  AppRadioGroup,
  AppSkeleton,
  AppText,
  BrandIcon,
  toast,
} from '@/components';
import { qk, useInvalidate, useToday } from '@/hooks/queries';
import { goHome } from '@/native/device';
import { insertException } from '@/repositories/usage';
import { enqueueSync } from '@/services/sync';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const REASONS: { value: OverrideReason; label: string }[] = [
  { value: 'work', label: 'Trabalho' },
  { value: 'study', label: 'Estudo' },
  { value: 'communication', label: 'Comunicação importante' },
  { value: 'emergency', label: 'Emergência' },
  { value: 'other', label: 'Outro motivo' },
];

const SUGGESTIONS: { icon: React.ComponentProps<typeof Feather>['name']; title: string; text: string; go: () => void }[] = [
  { icon: 'wind', title: 'Respirar 2 minutos', text: 'Um exercício guiado para acalmar o impulso.', go: () => router.replace('/breathing') },
  { icon: 'clock', title: 'Sessão de foco', text: '25 minutos dedicados a algo importante.', go: () => router.replace({ pathname: '/focus', params: { autostart: '1' } }) },
  { icon: 'book-open', title: 'Ler 20 minutos', text: 'Pegue num livro em papel e afaste o telemóvel.', go: () => router.replace('/habits') },
  { icon: 'activity', title: 'Caminhar ou alongar', text: 'Levante-se e mexa o corpo durante 5 minutos.', go: () => router.replace('/(tabs)/focus') },
  { icon: 'message-circle', title: 'Falar com o assistente', text: 'Reflicta sobre o que está a sentir agora.', go: () => router.replace('/assistant') },
];

/** Bloqueio activo — «Limite atingido». */
export default function BlockScreen() {
  const { appId, view } = useLocalSearchParams<{ appId?: string; view?: string }>();
  const { colors } = useTheme();
  const { data, isLoading } = useToday();
  const rules = usePrefs((s) => s.prefs.rules) ?? DEFAULT_RULE_SETTINGS;
  const [sheet, setSheet] = useState<'suggestions' | 'extra' | null>(view === 'extra' ? 'extra' : view === 'suggestions' ? 'suggestions' : null);
  const app = data?.apps.find((a) => a.appId === appId);

  const close = async () => {
    if (!(await goHome().catch(() => false))) router.replace('/');
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <AppSkeleton width={72} height={72} radius={18} />
      </View>
    );
  }

  if (!app) {
    return (
      <AppBlockScreen icon={<Feather name="slash" size={48} color={colors.text} />} title="Aplicação não encontrada" message="Esta aplicação já não tem um limite configurado.">
        <AppButton label="Voltar ao início" onPress={() => router.replace('/')} style={styles.btn} />
      </AppBlockScreen>
    );
  }

  if (app.state === RuleState.PERMISSION_REQUIRED || app.state === RuleState.UNAVAILABLE) {
    return (
      <AppBlockScreen
        icon={<BrandIcon appId={app.appId} name={app.name} size={72} monochrome />}
        title="Sem dados de utilização"
        message={`Não é possível saber quanto tempo usou o ${app.name} hoje: o acesso aos dados de utilização não está disponível neste dispositivo.`}
      >
        <View style={{ alignSelf: 'stretch', marginTop: spacing.xxxl, gap: spacing.md }}>
          {data?.capabilities.platform === 'android' ? <AppButton label="Verificar permissões" onPress={() => router.replace('/settings/permissions')} /> : null}
          <AppButton label="Ver sugestões" variant="secondary" onPress={() => setSheet('suggestions')} />
        </View>
      </AppBlockScreen>
    );
  }

  const scheduled = app.state === RuleState.SCHEDULED_BLOCK;
  const blocked = app.state === RuleState.BLOCKED || scheduled;
  const permission = canRequestException(app, rules);

  return (
    <>
      <AppBlockScreen
        icon={<BrandIcon appId={app.appId} name={app.name} size={72} monochrome />}
        title={blocked ? (scheduled ? 'Horário de bloqueio' : 'Limite atingido') : app.state === RuleState.TEMPORARY_EXCEPTION ? 'Tempo extra activo' : 'Dentro do limite'}
        message={
          scheduled
            ? `O ${app.name} está bloqueado neste horário.`
            : blocked
              ? `Já utilizou os seus ${app.limitMinutes} minutos diários no ${app.name}.`
              : `Utilizou ${Math.floor(app.usedMs / MINUTE)} de ${Math.round(app.effectiveLimitMs / MINUTE)} minutos no ${app.name} hoje.`
        }
      >
        <AppText variant="small" tone="muted" align="center" style={{ marginTop: spacing.xxl, maxWidth: 240 }}>
          Que tal fazer algo melhor com o seu tempo agora?
        </AppText>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.xxxl, gap: spacing.md }}>
          <AppButton label="Ver sugestões" onPress={() => setSheet('suggestions')} testID="block-suggestions" />
          {blocked && !rules.strictMode ? (
            <AppButton label="Pedir tempo extra" variant="secondary" onPress={() => setSheet('extra')} testID="block-extra" />
          ) : null}
          <Pressable onPress={close} accessibilityRole="button" style={{ alignSelf: 'center', padding: spacing.sm }}>
            <AppText variant="small" tone="muted">
              Fechar
            </AppText>
          </Pressable>
        </View>
      </AppBlockScreen>

      <AppBottomSheet visible={sheet === 'suggestions'} onClose={() => setSheet(null)} title="Sugestões">
        <View style={{ gap: spacing.sm }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s.title}
              onPress={s.go}
              accessibilityRole="button"
              style={({ pressed }) => [styles.suggestion, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name={s.icon} size={20} color={colors.text} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{s.title}</AppText>
                <AppText variant="caption" tone="muted">
                  {s.text}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </AppBottomSheet>

      {sheet === 'extra' ? (
        <ExtraTimeSheet
          appId={app.appId}
          appName={app.name}
          denial={permission.allowed ? null : permission.reason}
          onClose={() => setSheet(null)}
          result={app}
        />
      ) : null}
    </>
  );
}

function ExtraTimeSheet({
  appId,
  appName,
  denial,
  onClose,
  result,
}: {
  appId: string;
  appName: string;
  denial: string | null;
  onClose: () => void;
  result: Parameters<typeof grantException>[0]['result'];
}) {
  const rules = usePrefs((s) => s.prefs.rules);
  const invalidate = useInvalidate();
  const [reason, setReason] = useState<OverrideReason>('work');
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pauseStartedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [pauseStartedAt]);

  const pauseMs = rules.mindfulPauseSeconds * 1000;
  const remaining = pauseStartedAt === null ? pauseMs : Math.max(0, pauseMs - (now - pauseStartedAt));

  const grant = async () => {
    if (pauseStartedAt === null) return;
    setSaving(true);
    try {
      const g = grantException({ id: randomUUID(), result, settings: rules, reason, day: dayKey(new Date()), pauseStartedAt, now: Date.now() });
      await insertException(g);
      await syncRulesToNative();
      await enqueueSync('override_requests', 'append', g.id, {
        id: g.id,
        app_id: g.appId,
        day: g.day,
        extra_minutes: g.extraMinutes,
        reason: g.reason,
        status: 'approved',
        created_at: new Date(g.grantedAt).toISOString(),
      });
      await invalidate(qk.today);
      toast(`+${g.extraMinutes} minutos no ${appName}. Use-os com intenção.`);
      onClose();
      goBack();
    } catch (e) {
      toast(e instanceof RuleError ? 'A pausa consciente ainda não terminou.' : 'Não foi possível conceder tempo extra.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const denialText: Record<string, string> = {
    strict_mode: 'O modo estrito está activo: não são permitidas excepções.',
    max_reached: `Já usou as ${rules.maxExceptionsPerDay} excepções de hoje para o ${appName}.`,
    scheduled_block: 'Durante o horário de bloqueio não é possível pedir tempo extra.',
    not_blocked: `O ${appName} não está bloqueado neste momento.`,
  };

  return (
    <AppBottomSheet visible onClose={onClose} title="Pedir tempo extra">
      {denial ? (
        <View style={{ gap: spacing.lg }}>
          <AppText variant="body" tone="secondary">
            {denialText[denial]}
          </AppText>
          <AppButton label="Compreendo" onPress={onClose} />
        </View>
      ) : pauseStartedAt === null ? (
        <View style={{ gap: spacing.lg }} testID={`extra-${appId}`}>
          <AppText variant="small" tone="secondary">
            Porque precisa de mais tempo? Depois faremos uma pausa consciente de {rules.mindfulPauseSeconds} segundos.
          </AppText>
          <AppRadioGroup options={REASONS} value={reason} onChange={setReason} />
          <AppButton label="Iniciar pausa consciente" onPress={() => setPauseStartedAt(Date.now())} />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <AppProgressRing progress={1 - remaining / pauseMs} size={150} strokeWidth={6}>
            <AppText variant="h2">{formatClock(remaining)}</AppText>
          </AppProgressRing>
          <AppText variant="body" tone="secondary" align="center">
            Inspire devagar… expire devagar.{'\n'}Ainda quer mesmo voltar ao {appName}?
          </AppText>
          <AppButton
            label={remaining > 0 ? 'Aguarde…' : `Conceder +${rules.exceptionMinutes} minutos`}
            disabled={remaining > 0}
            loading={saving}
            onPress={grant}
            style={{ alignSelf: 'stretch' }}
          />
          <AppButton label="Afinal não preciso" variant="ghost" onPress={onClose} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  btn: { alignSelf: 'stretch', marginTop: spacing.xxxl },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
