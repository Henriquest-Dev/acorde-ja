import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { AppButton, AppHeader, AppModal, AppSwitch, AppText, ListRow, Screen, SectionTitle, toast } from '@/components';
import { wipeLocalDatabase } from '@/database/db';
import { usageBetween } from '@/repositories/usage';
import { exportCsv } from '@/features/insights/export';
import { deleteAccount, useSession } from '@/services/auth';
import { recordConsent } from '@/services/consent';
import { stopEnforcement, shield } from '@/native/device';
import { usePrefs, type Prefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

const CONSENTS: { key: keyof Pick<Prefs, 'cloudSync' | 'syncSensitive' | 'aiConsent' | 'aiMemory'>; title: string; subtitle: string }[] = [
  { key: 'cloudSync', title: 'Sincronização na nuvem', subtitle: 'Guarda limites, tempos e sessões de foco na sua conta.' },
  { key: 'syncSensitive', title: 'Sincronizar dados sensíveis', subtitle: 'Inclui hábitos e programas de recuperação.' },
  { key: 'aiConsent', title: 'Assistente IA', subtitle: 'Permite enviar as mensagens do chat para processamento.' },
  { key: 'aiMemory', title: 'Memória de estratégias', subtitle: 'O assistente lembra-se das alternativas que mais o ajudaram.' },
];

/** Privacidade e dados: consentimentos, bloqueio biométrico, exportação e eliminação. */
export default function Privacy() {
  const { prefs, update, reset } = usePrefs();
  const { session } = useSession();
  const [confirm, setConfirm] = useState<'local' | 'account' | null>(null);
  const [busy, setBusy] = useState(false);

  const setConsent = async (key: (typeof CONSENTS)[number]['key'], value: boolean) => {
    await update({ [key]: value } as Partial<Prefs>);
    await recordConsent(key, value).catch(() => undefined);
  };

  const toggleBiometric = async (v: boolean) => {
    if (v) {
      const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (!ok) return toast('Este dispositivo não tem biometria configurada.', 'error');
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirmar' });
      if (!auth.success) return;
    }
    await update({ biometricLock: v });
  };

  const wipeLocal = async () => {
    setBusy(true);
    try {
      await stopEnforcement().catch(() => undefined);
      await shield.stop().catch(() => undefined);
      await wipeLocalDatabase();
      await reset();
      toast('Dados locais eliminados.');
      router.replace('/onboarding');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      await update({ cloudSync: false, syncSensitive: false, aiConsent: false });
      toast('Conta eliminada. Os dados locais mantêm-se no dispositivo.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível eliminar a conta', 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Screen>
      <AppHeader title="Privacidade e dados" back />
      <AppText variant="small" tone="secondary">
        Por defeito, tudo fica no seu dispositivo. Não lemos mensagens, palavras-passe nem dados financeiros, e não vendemos dados.
      </AppText>

      <SectionTitle>Consentimentos</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {CONSENTS.map((c) => (
          <ListRow
            key={c.key}
            title={c.title}
            subtitle={c.subtitle}
            right={
              <AppSwitch
                value={prefs[c.key]}
                onValueChange={(v) => void setConsent(c.key, v)}
                disabled={c.key === 'syncSensitive' && !prefs.cloudSync}
                accessibilityLabel={c.title}
              />
            }
          />
        ))}
      </View>

      <SectionTitle>Segurança</SectionTitle>
      <ListRow
        icon={{ set: 'feather', name: 'lock' }}
        title="Bloqueio biométrico"
        subtitle="Pedir Face ID / impressão digital ao abrir"
        right={<AppSwitch value={prefs.biometricLock} onValueChange={(v) => void toggleBiometric(v)} disabled={Platform.OS === 'web'} accessibilityLabel="Bloqueio biométrico" />}
      />

      <SectionTitle>Os seus dados</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        <ListRow
          icon={{ set: 'feather', name: 'download' }}
          title="Exportar dados de utilização (CSV)"
          chevron
          onPress={async () => {
            const rows = await usageBetween('0000-01-01', '9999-12-31');
            if (!rows.length) return toast('Ainda não há dados de utilização.', 'error');
            await exportCsv(rows, 'completo');
          }}
        />
        <ListRow icon={{ set: 'feather', name: 'trash-2' }} title="Apagar dados do dispositivo" chevron onPress={() => setConfirm('local')} />
        {session ? <ListRow icon={{ set: 'feather', name: 'user-x' }} title="Eliminar conta" chevron onPress={() => setConfirm('account')} /> : null}
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
        Retenção: dados diários de utilização são mantidos 13 meses; mensagens do assistente no servidor 90 dias. Ver docs/privacy.md.
      </AppText>

      <AppModal visible={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'account' ? 'Eliminar conta?' : 'Apagar dados locais?'}>
        <AppText variant="small" tone="secondary">
          {confirm === 'account'
            ? 'Todos os dados da sua conta no servidor serão eliminados de forma permanente. Esta acção não pode ser desfeita.'
            : 'Limites, hábitos, histórico e preferências serão apagados deste dispositivo. Esta acção não pode ser desfeita.'}
        </AppText>
        <AppButton label="Eliminar" loading={busy} onPress={() => void (confirm === 'account' ? removeAccount() : wipeLocal())} style={{ marginTop: spacing.xl }} />
        <AppButton label="Cancelar" variant="ghost" onPress={() => setConfirm(null)} />
      </AppModal>
    </Screen>
  );
}
