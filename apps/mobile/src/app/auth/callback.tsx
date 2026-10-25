import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppText } from '@/components';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Destino dos deep links de autenticação (verificação de email, recuperação
 * de palavra-passe e OAuth). Troca o código PKCE por uma sessão.
 */
export default function AuthCallback() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string; type?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(params.error_description ?? null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !params.code) return;
    sb.auth.exchangeCodeForSession(params.code).then(({ error: e }) => {
      if (e) return setError(e.message);
      if (params.type === 'recovery') router.replace({ pathname: '/auth/forgot', params: { mode: 'reset' } });
      else router.replace('/settings/sync');
    });
  }, [params.code, params.type]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <AppText variant="h3">{error ? 'Ligação inválida ou expirada' : 'A confirmar…'}</AppText>
      {error ? (
        <>
          <AppText variant="small" tone="muted" align="center">
            {error}
          </AppText>
          <AppButton label="Voltar" onPress={() => router.replace('/')} />
        </>
      ) : null}
    </View>
  );
}
