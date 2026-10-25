import { signInSchema } from '@acorde/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, View } from 'react-native';
import type { z } from 'zod';
import { AppButton, AppHeader, AppInput, AppLogo, AppText, Screen, toast } from '@/components';
import { signIn, signInWithProvider } from '@/services/auth';
import { isBackendConfigured, translateAuthError } from '@/services/supabase';
import { spacing } from '@/theme/tokens';

type Form = z.infer<typeof signInSchema>;

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      await signIn(v.email, v.password);
      toast('Sessão iniciada.');
      router.back();
    } catch (e) {
      toast(translateAuthError(e), 'error');
    } finally {
      setBusy(false);
    }
  });

  const oauth = async (p: 'google' | 'apple') => {
    try {
      if (await signInWithProvider(p)) router.back();
    } catch (e) {
      toast(`${translateAuthError(e)} (o login ${p === 'google' ? 'Google' : 'Apple'} tem de estar configurado no Supabase)`, 'error');
    }
  };

  return (
    <Screen>
      <AppHeader title="" back />
      <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
        <AppLogo size={64} />
        <AppText variant="h2" style={{ marginTop: spacing.md }}>
          Entrar
        </AppText>
        <AppText variant="small" tone="muted" align="center">
          A conta é opcional: serve para sincronizar, o assistente e a família.
        </AppText>
      </View>
      {!isBackendConfigured ? (
        <AppText variant="small" tone="secondary" align="center">
          Servidor não configurado nesta instalação.
        </AppText>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Controller control={control} name="email" render={({ field }) => <AppInput label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} error={formState.errors.email?.message} />} />
          <Controller control={control} name="password" render={({ field }) => <AppInput label="Palavra-passe" secureTextEntry autoComplete="password" value={field.value} onChangeText={field.onChange} error={formState.errors.password?.message} />} />
          <AppButton label="Entrar" onPress={submit} loading={busy} />
          <AppButton label="Esqueci-me da palavra-passe" variant="ghost" size="sm" onPress={() => router.push('/auth/forgot')} />
          <AppButton label="Continuar com Google" variant="subtle" onPress={() => void oauth('google')} />
          {Platform.OS === 'ios' ? <AppButton label="Continuar com Apple" variant="subtle" onPress={() => void oauth('apple')} /> : null}
          <AppButton label="Criar conta" variant="secondary" onPress={() => router.replace('/auth/sign-up')} />
        </View>
      )}
    </Screen>
  );
}
