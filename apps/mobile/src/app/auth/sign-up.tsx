import { signUpSchema } from '@acorde/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { AppButton, AppHeader, AppInput, AppText, Screen, toast } from '@/components';
import { resendVerification, signUp } from '@/services/auth';
import { translateAuthError } from '@/services/supabase';
import { spacing } from '@/theme/tokens';

type Form = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(signUpSchema), defaultValues: { email: '', password: '', confirm: '' } });

  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      const r = await signUp(v.email, v.password);
      if (r.needsVerification) setSentTo(v.email);
      else router.back();
    } catch (e) {
      toast(translateAuthError(e), 'error');
    } finally {
      setBusy(false);
    }
  });

  if (sentTo) {
    return (
      <Screen>
        <AppHeader title="Verifique o email" back />
        <AppText variant="body" tone="secondary">
          Enviámos uma ligação de confirmação para {sentTo}. Abra-a neste dispositivo para activar a conta.
        </AppText>
        <AppButton label="Reenviar email" variant="secondary" style={{ marginTop: spacing.xl }} onPress={() => void resendVerification(sentTo).then(() => toast('Email reenviado.')).catch((e) => toast(translateAuthError(e), 'error'))} />
        <AppButton label="Já confirmei — entrar" style={{ marginTop: spacing.md }} onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Criar conta" back />
      <View style={{ gap: spacing.lg }}>
        <Controller control={control} name="email" render={({ field }) => <AppInput label="Email" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={formState.errors.email?.message} />} />
        <Controller control={control} name="password" render={({ field }) => <AppInput label="Palavra-passe" secureTextEntry autoComplete="new-password" value={field.value} onChangeText={field.onChange} error={formState.errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números" />} />
        <Controller control={control} name="confirm" render={({ field }) => <AppInput label="Confirmar palavra-passe" secureTextEntry value={field.value} onChangeText={field.onChange} error={formState.errors.confirm?.message} />} />
        <AppText variant="caption" tone="muted">
          Ao criar conta aceita os Termos e a Política de Privacidade. Os seus dados comportamentais só são sincronizados com o seu consentimento.
        </AppText>
        <AppButton label="Criar conta" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}
