import { signUpSchema } from '@acorde/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AppButton, AppInput, AppText, toast, type OffyMood } from '@/components';
import { AuthShell } from '@/features/auth/AuthShell';
import { resendVerification, signUp } from '@/services/auth';
import { translateAuthError } from '@/services/supabase';
import { afterAuth } from '@/features/auth/afterAuth';

type Form = z.infer<typeof signUpSchema>;

const SAY: Record<string, string> = {
  idle: 'Vamos começar juntos. Leva menos de um minuto.',
  email: 'O teu email fica só para entrares na conta.',
  password: 'Uma palavra-passe forte. Eu fecho os olhos.',
  busy: 'A preparar tudo para ti…',
  error: 'Quase! Vê o que está assinalado.',
  done: 'Conta criada. Bem-vindo!',
  sent: 'Enviei-te um email. Abre a ligação e voltamos a ver-nos.',
};

export default function SignUp() {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<keyof typeof SAY>('idle');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(signUpSchema), defaultValues: { email: '', password: '', confirm: '' } });

  const submit = handleSubmit(
    async (v) => {
      setBusy(true);
      setState('busy');
      try {
        const r = await signUp(v.email.trim(), v.password);
        if (r.needsVerification) {
          setSentTo(v.email.trim());
          setState('sent');
        } else {
          setState('done');
          afterAuth();
        }
      } catch (e) {
        setState('error');
        toast(translateAuthError(e), 'error');
      } finally {
        setBusy(false);
      }
    },
    () => setState('error'),
  );

  const mood: OffyMood =
    state === 'email' ? 'listening' : state === 'password' ? 'calm' : state === 'busy' ? 'thinking' : state === 'error' ? 'anxious' : state === 'done' || state === 'sent' ? 'joy' : 'idle';

  if (sentTo) {
    return (
      <AuthShell mood="joy" say={SAY.sent!} title="Verifica o email" subtitle={`Enviámos a ligação para ${sentTo}.`}>
        <AppButton label="Já confirmei — entrar" onPress={() => router.replace('/auth/sign-in')} />
        <AppButton
          label="Reenviar email"
          variant="secondary"
          onPress={() => void resendVerification(sentTo).then(() => toast('Email reenviado.')).catch((e) => toast(translateAuthError(e), 'error'))}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mood={mood}
      say={SAY[state]!}
      title="Criar conta"
      subtitle="O teu primeiro passo para mais tempo livre."
      footer={<AppButton label="Já tenho conta — entrar" variant="ghost" onPress={() => router.replace('/auth/sign-in')} testID="go-sign-in" />}
    >
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <AppInput label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} onFocus={() => setState('email')} error={formState.errors.email?.message} />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <AppInput
            label="Palavra-passe"
            secureTextEntry
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onFocus={() => setState('password')}
            error={formState.errors.password?.message}
            hint="Mínimo de 8 caracteres, com letras e números"
          />
        )}
      />
      <Controller
        control={control}
        name="confirm"
        render={({ field }) => (
          <AppInput label="Confirmar palavra-passe" secureTextEntry value={field.value} onChangeText={field.onChange} onFocus={() => setState('password')} onBlur={() => setState('idle')} error={formState.errors.confirm?.message} />
        )}
      />
      <AppButton label="Criar conta" onPress={submit} loading={busy} />
      <AppText variant="caption" tone="muted" align="center">
        Ao criar conta aceitas os Termos e a Política de Privacidade. Os teus dados só são sincronizados com o teu consentimento.
      </AppText>
    </AuthShell>
  );
}
