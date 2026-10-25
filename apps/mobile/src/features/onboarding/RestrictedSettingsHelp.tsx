import { Platform, View } from 'react-native';
import { AppButton, AppCard, AppText, toast } from '@/components';
import { openSystemSettings } from '@/native/device';
import { spacing } from '@/theme/tokens';
import type { PermissionItem } from './usePermissionSummary';

/**
 * Android 13+: em apps instaladas fora da Play Store (APK), o sistema bloqueia
 * «Acesso a dados de utilização» e «Sobrepor a outras apps» como «definições
 * restritas» até o utilizador as desbloquear manualmente nas informações da app.
 */
export function RestrictedSettingsHelp({ items }: { items: PermissionItem[] }) {
  const blocked = items.some((i) => (i.key === 'usage' || i.key === 'apps') && i.state === 'denied');
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33 || !blocked) return null;
  return (
    <AppCard style={{ marginTop: spacing.lg }} testID="restricted-settings-help">
      <AppText variant="bodyStrong">O interruptor está bloqueado ou cinzento?</AppText>
      <AppText variant="small" tone="secondary" style={{ marginTop: spacing.xs }}>
        O Android protege estas permissões em apps instaladas por APK. Para as desbloquear:
      </AppText>
      <View style={{ gap: 4, marginTop: spacing.sm }}>
        {[
          '1. Tente activar a permissão uma vez (aparece o aviso «Definição restrita»).',
          '2. Toque em «Abrir informações da app» abaixo.',
          '3. No menu ⋮ (canto superior direito), escolha «Permitir definições restritas» e confirme.',
          '4. Volte aqui e toque novamente em «Conceder permissões».',
        ].map((s) => (
          <AppText key={s} variant="small" tone="secondary">
            {s}
          </AppText>
        ))}
      </View>
      <AppButton
        label="Abrir informações da app"
        variant="secondary"
        size="sm"
        style={{ marginTop: spacing.md }}
        onPress={() => void openSystemSettings('app').catch(() => toast('Abra Definições → Apps → Acorde Já.', 'error'))}
      />
    </AppCard>
  );
}
