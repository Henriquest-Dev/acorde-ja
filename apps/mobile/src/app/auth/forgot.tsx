import { emailSchema, passwordSchema } from '@acorde/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppHeader, AppInput, AppText, Screen, toast } from '@/components';
import { sendPasswordReset, updatePassword } from '@/services/auth';
import { translateAuthError } from '@/services/supabase';
import { spacing } from '@/theme/tokens';

/** Recuperação de palavra-passe (pedido por email e definição de nova palavra-passe). */
export default function Forgot() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const resetting = mode === 'reset';

  const submit = async () => {
    const parsed = (resetting ? passwordSchema : emailSchema).safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    setBusy(true);
    try {
      if (resetting) {
        await updatePassword(parsed.data);
        toast('Palavra-passe actualizada.');
        router.replace('/');
      } else {
        await sendPasswordReset(parsed.data);
        toast('Se existir uma conta, receberá um email com instruções.');
        router.back();
      }
    } catch (e) {
      toast(translateAuthError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title={resetting ? 'Nova palavra-passe' : 'Recuperar palavra-passe'} back />
      <View style={{ gap: spacing.lg }}>
        <AppText variant="small" tone="secondary">
          {resetting ? 'Escolha uma nova palavra-passe.' : 'Indique o email da conta. Enviaremos uma ligação para definir uma nova palavra-passe.'}
        </AppText>
        <AppInput
          label={resetting ? 'Nova palavra-passe' : 'Email'}
          secureTextEntry={resetting}
          autoCapitalize="none"
          keyboardType={resetting ? 'default' : 'email-address'}
          value={value}
          onChangeText={setValue}
          error={error}
        />
        <AppButton label={resetting ? 'Guardar' : 'Enviar'} onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}
