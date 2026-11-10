import { signInSchema } from '@acorde/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform } from 'react-native';
import type { z } from 'zod';
import { AppButton, AppInput, AppText, toast, type OffyMood } from '@/components';
import { AuthShell } from '@/features/auth/AuthShell';
import { afterAuth } from '@/features/auth/afterAuth';
import { signIn, signInWithProvider } from '@/services/auth';
import { isBackendConfigured, translateAuthError } from '@/services/supabase';

type Form = z.infer<typeof signInSchema>;

const OAUTH = (process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? '').split(',').map((x) => x.trim().toLowerCase());

const SAY: Record<string, string> = {
  idle: 'Olá! Eu sou o Offy. Vamos entrar?',
  email: 'Qual é o teu email?',
  password: 'Prometo que não estou a espreitar.',
  busy: 'Um segundo…',
  error: 'Hmm, algo não bateu certo. Tenta outra vez.',
  done: 'Que bom ver-te!',
};

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<keyof typeof SAY>('idle');
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const submit = handleSubmit(
    async (v) => {
      setBusy(true);
      setState('busy');
      try {
        await signIn(v.email.trim(), v.password);
        setState('done');
        afterAuth();
      } catch (e) {
        setState('error');
        toast(translateAuthError(e), 'error');
      } finally {
        setBusy(false);
      }
    },
    () => setState('error'),
  );

  const oauth = async (p: 'google' | 'apple') => {
    try {
      if (await signInWithProvider(p)) afterAuth();
    } catch (e) {
      toast(`${translateAuthError(e)} (o login ${p === 'google' ? 'Google' : 'Apple'} tem de estar configurado no Supabase)`, 'error');
    }
  };

  const mood: OffyMood =
    state === 'email' ? 'listening' : state === 'password' ? 'calm' : state === 'busy' ? 'thinking' : state === 'error' ? 'sad' : state === 'done' ? 'joy' : 'idle';

  return (
    <AuthShell
      mood={mood}
      say={SAY[state]!}
      title="Bem-vindo ao offly"
      subtitle="Menos tela. Mais vida."
      footer={
        <AppButton label="Ainda não tenho conta — criar agora" variant="ghost" onPress={() => router.replace('/auth/sign-up')} testID="go-sign-up" />
      }
    >
      {!isBackendConfigured ? (
        <AppText variant="small" tone="secondary" align="center">
          Servidor não configurado nesta instalação.
        </AppText>
      ) : (
        <>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <AppInput
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={field.value}
                onChangeText={field.onChange}
                onFocus={() => setState('email')}
                error={formState.errors.email?.message}
                testID="sign-in-email"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <AppInput
                label="Palavra-passe"
                secureTextEntry
                autoComplete="password"
                value={field.value}
                onChangeText={field.onChange}
                onFocus={() => setState('password')}
                onBlur={() => setState('idle')}
                error={formState.errors.password?.message}
                testID="sign-in-password"
              />
            )}
          />
          <AppButton label="Entrar" onPress={submit} loading={busy} testID="sign-in-submit" />
          <AppButton label="Esqueci-me da palavra-passe" variant="ghost" size="sm" onPress={() => router.push('/auth/forgot')} />
          {/* Só aparecem quando o fornecedor está activo no Supabase (EXPO_PUBLIC_AUTH_PROVIDERS=google,apple). */}
          {OAUTH.includes('google') ? <AppButton label="Continuar com Google" variant="subtle" onPress={() => void oauth('google')} /> : null}
          {Platform.OS === 'ios' && OAUTH.includes('apple') ? <AppButton label="Continuar com Apple" variant="subtle" onPress={() => void oauth('apple')} /> : null}
        </>
      )}
    </AuthShell>
  );
}
