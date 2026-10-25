import { supportTicketSchema } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppInput, AppText, Screen, SectionTitle, toast } from '@/components';
import { useSession } from '@/services/auth';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Porque é que o tempo aparece como «—»?',
    a: 'Mostramos apenas dados reais. No Android conceda «Acesso a dados de utilização». No iOS a Apple não disponibiliza os minutos ao aplicativo.',
  },
  {
    q: 'O bloqueio não aparece sobre a aplicação.',
    a: 'Confirme a permissão «Sobrepor a outras apps» e que a optimização de bateria não está a terminar o Acorde Já (Definições → Bateria).',
  },
  {
    q: 'O filtro de sites não bloqueia num navegador.',
    a: 'Alguns navegadores usam DNS seguro próprio. Desactive-o nas definições do navegador ou active «VPN sempre activa».',
  },
  { q: 'Os limites reiniciam quando?', a: 'Todos os dias à meia-noite, na hora local do dispositivo. Alterar a hora manualmente fica registado.' },
  { q: 'Posso usar sem conta?', a: 'Sim. Limites, foco, hábitos e relatórios funcionam offline e sem conta.' },
];

/** Ajuda e suporte. */
export default function Help() {
  const { colors } = useTheme();
  const { session } = useSession();
  const [open, setOpen] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({});
  const [sending, setSending] = useState(false);

  const send = async () => {
    const parsed = supportTicketSchema.safeParse({ subject, message });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      return setErrors({ subject: f.subject?.[0], message: f.message?.[0] });
    }
    setErrors({});
    const sb = getSupabase();
    if (!sb || !session) {
      await Linking.openURL(`mailto:suporte@acordeja.pt?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`);
      return;
    }
    setSending(true);
    const { error } = await sb.from('support_tickets').insert({
      subject: parsed.data.subject,
      message: parsed.data.message,
      app_version: Constants.expoConfig?.version ?? null,
      platform: Platform.OS,
    });
    setSending(false);
    if (error) return toast(error.message, 'error');
    setSubject('');
    setMessage('');
    toast('Pedido enviado. Responderemos por email.');
  };

  return (
    <Screen>
      <AppHeader title="Ajuda e suporte" back />
      <View style={{ gap: spacing.sm }}>
        {FAQ.map((f, i) => (
          <AppCard key={f.q} onPress={() => setOpen(open === i ? null : i)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <AppText variant="small" weight="semibold" style={{ flex: 1 }}>
                {f.q}
              </AppText>
              <Feather name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </View>
            {open === i ? (
              <AppText variant="small" tone="secondary" style={{ marginTop: spacing.sm }}>
                {f.a}
              </AppText>
            ) : null}
          </AppCard>
        ))}
      </View>

      <SectionTitle>Contactar o suporte</SectionTitle>
      <View style={{ gap: spacing.md }}>
        <AppInput label="Assunto" value={subject} onChangeText={setSubject} error={errors.subject} />
        <AppInput label="Mensagem" value={message} onChangeText={setMessage} multiline style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }} error={errors.message} />
        <AppButton label={session ? 'Enviar pedido' : 'Enviar por email'} onPress={send} loading={sending} />
      </View>

      <SectionTitle>Apoio especializado</SectionTitle>
      <AppCard>
        <AppText variant="small" tone="secondary">
          O Acorde Já é uma ferramenta de autocontrolo e não substitui acompanhamento médico ou psicológico.
        </AppText>
        {[
          { label: 'Emergência — 112', url: 'tel:112' },
          { label: 'SNS 24 — 808 24 24 24', url: 'tel:808242424' },
          { label: 'Linha Vida (comportamentos aditivos) — 1414', url: 'tel:1414' },
        ].map((l) => (
          <Pressable key={l.url} onPress={() => void Linking.openURL(l.url)} accessibilityRole="link" style={{ marginTop: spacing.md }}>
            <AppText variant="small" style={{ textDecorationLine: 'underline' }}>
              {l.label}
            </AppText>
          </Pressable>
        ))}
      </AppCard>
    </Screen>
  );
}
