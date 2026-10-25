import { MINUTE } from '@acorde/core';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AppBlockScreen, AppButton, AppSkeleton, BrandIcon } from '@/components';
import { useToday } from '@/hooks/queries';
import { goHome } from '@/native/device';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Aviso de limite — notificação aos 80%. */
export default function LimitWarning() {
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const { colors } = useTheme();
  const { data, isLoading } = useToday();
  const app = data?.apps.find((a) => a.appId === appId);

  if (isLoading || !app) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        {isLoading ? <AppSkeleton width={64} height={64} radius={16} /> : <AppButton label="Voltar" onPress={() => router.replace('/')} />}
      </View>
    );
  }

  const used = Math.floor(app.usedMs / MINUTE);
  const percent = Math.min(100, Math.floor(app.ratio * 100));
  const close = async () => {
    if (!(await goHome().catch(() => false))) router.replace('/');
  };

  return (
    <AppBlockScreen
      icon={<BrandIcon appId={app.appId} name={app.name} size={64} />}
      title={`${percent}% do limite`}
      message={`Já utilizou ${used} dos ${app.limitMinutes} minutos diários no ${app.name}.`}
      footer={'Lembre-se do seu objetivo:\nmenos tela, mais vida.'}
    >
      <View style={{ alignSelf: 'stretch', marginTop: spacing.xxxl, gap: spacing.md, paddingHorizontal: spacing.xxl }}>
        <AppButton label="Continuar a usar" variant="subtle" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} testID="warn-continue" />
        <AppButton label="Fechar app" variant="subtle" onPress={close} testID="warn-close" />
      </View>
    </AppBlockScreen>
  );
}
