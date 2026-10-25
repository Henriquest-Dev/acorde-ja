import { MINUTE } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheet, AppButton, AppLogo, AppText } from '@/components';
import { useToday } from '@/hooks/queries';
import { kvGet, kvSet } from '@/repositories/kv';
import { addMessage, listMessages, type ChatMessage } from '@/repositories/chat';
import { AssistantUnavailableError, sendToAssistant } from '@/services/assistant';
import { isBackendConfigured } from '@/services/supabase';
import { useSession } from '@/services/auth';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

const GREETING = 'Olá! Como posso ajudar-te hoje?';

const OFFLINE_TEXT: Record<AssistantUnavailableError['reason'], string> = {
  no_backend: 'O assistente precisa de ligação ao servidor do Acorde Já, que não está configurado nesta instalação.',
  no_session: 'Para conversar com o assistente, inicie sessão na sua conta.',
  rate_limited: 'Atingiu o limite de mensagens de hoje. Volte amanhã — entretanto, experimente o exercício abaixo.',
  network: 'Sem ligação à Internet. Entretanto, experimente o exercício abaixo — funciona offline.',
  server: 'O assistente está indisponível neste momento. Tente novamente daqui a pouco.',
};

/** Assistente IA — apoio e orientação. */
export default function Assistant() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { prefs, update } = usePrefs();
  const { session } = useSession();
  const today = useToday();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [consent, setConsent] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const conv = useQuery({
    queryKey: ['chat'],
    queryFn: async () => {
      let id = await kvGet<string | null>('conversationId', null);
      if (!id) {
        id = randomUUID();
        await kvSet('conversationId', id);
      }
      const messages = await listMessages(id);
      return { id, messages };
    },
  });

  const online = isBackendConfigured && !!session;
  const messages: ChatMessage[] = [
    { id: 'greeting', conversationId: conv.data?.id ?? '', role: 'assistant', content: GREETING, kind: 'text', createdAt: 0 },
    ...(conv.data?.messages ?? []),
  ];

  const push = async (m: Omit<ChatMessage, 'id' | 'conversationId' | 'createdAt'>) => {
    if (!conv.data) return;
    await addMessage({ ...m, id: randomUUID(), conversationId: conv.data.id, createdAt: Date.now() });
  };

  const send = async () => {
    const message = text.trim();
    if (!message || !conv.data || sending) return;
    if (!prefs.aiConsent && isBackendConfigured) {
      setConsent(true);
      return;
    }
    setText('');
    setSending(true);
    await push({ role: 'user', content: message, kind: 'text' });
    await qc.invalidateQueries({ queryKey: ['chat'] });
    try {
      const snap = today.data;
      const reply = await sendToAssistant({
        conversationId: conv.data.id,
        message,
        todayUsedMinutes: snap?.measured ? Math.round(snap.totals.usedMs / MINUTE) : null,
        todayLimitMinutes: snap?.measured ? Math.round(snap.totals.limitMs / MINUTE) : null,
      });
      await push({ role: 'assistant', content: reply.reply, kind: 'text' });
      for (const c of reply.cards) await push({ role: 'assistant', content: c, kind: `card:${c}` });
    } catch (e) {
      const reason = e instanceof AssistantUnavailableError ? e.reason : 'server';
      await push({ role: 'system', content: OFFLINE_TEXT[reason], kind: 'text' });
      await push({ role: 'assistant', content: 'breathing', kind: 'card:breathing' });
    } finally {
      setSending(false);
      await qc.invalidateQueries({ queryKey: ['chat'] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { borderColor: colors.borderStrong }]}>
          <AppLogo size={26} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="small" weight="semibold">
            Assistente Acorde Já
          </AppText>
          <AppText variant="caption" tone="muted" style={{ fontSize: 10 }}>
            {online ? 'Online' : 'Offline'}
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push('/help-now')}
          accessibilityRole="button"
          style={[styles.helpBtn, { borderColor: colors.text }]}
          testID="help-now"
        >
          <AppText variant="caption" weight="semibold">
            Preciso de ajuda agora
          </AppText>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <Bubble message={item} />}
        ListFooterComponent={
          sending ? (
            <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
              A escrever…
            </AppText>
          ) : undefined
        }
      />

      {!online ? (
        <AppText variant="caption" tone="muted" align="center" style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
          {isBackendConfigured ? 'Inicie sessão em Configurações → Sincronização para usar o assistente.' : OFFLINE_TEXT.no_backend}
        </AppText>
      ) : null}

      <View style={[styles.inputRow, { paddingBottom: spacing.md }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escreve a tua mensagem..."
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Mensagem para o assistente"
          multiline
          maxLength={2000}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          testID="chat-input"
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          style={[styles.send, { backgroundColor: colors.accent, opacity: !text.trim() || sending ? 0.4 : 1 }]}
        >
          <Feather name="send" size={16} color={colors.onAccent} style={{ marginLeft: -2 }} />
        </Pressable>
      </View>

      <AppBottomSheet visible={consent} onClose={() => setConsent(false)} title="Antes de começar">
        <AppText variant="small" tone="secondary">
          As suas mensagens são enviadas para o servidor do Acorde Já e processadas por um modelo de IA para gerar respostas. Enviamos
          também os seus objectivos e os minutos de hoje (valores agregados). Nunca enviamos listas de sites, contactos ou conteúdos de
          outras aplicações.
        </AppText>
        <AppText variant="small" tone="secondary" style={{ marginTop: spacing.md }}>
          O assistente não é um profissional de saúde. Em caso de perigo, ligue 112.
        </AppText>
        <AppButton
          label="Aceito e quero continuar"
          style={{ marginTop: spacing.xl }}
          onPress={async () => {
            await update({ aiConsent: true });
            setConsent(false);
          }}
        />
        <AppButton label="Agora não" variant="ghost" onPress={() => setConsent(false)} />
      </AppBottomSheet>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  if (message.kind.startsWith('card:')) {
    const card = message.kind.slice(5);
    const meta =
      card === 'focus'
        ? { title: 'Sessão de foco', sub: '25 minutos', go: () => router.push({ pathname: '/focus', params: { autostart: '1' } }) }
        : card === 'help'
          ? { title: 'Preciso de ajuda agora', sub: 'Apoio passo a passo', go: () => router.push('/help-now') }
          : { title: 'Exercício de respiração', sub: '2 minutos', go: () => router.push('/breathing') };
    return (
      <Pressable onPress={meta.go} accessibilityRole="button" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="small" weight="semibold">
            {meta.title}
          </AppText>
          <AppText variant="caption" tone="muted">
            {meta.sub}
          </AppText>
        </View>
        <View style={[styles.play, { backgroundColor: colors.accent }]}>
          <Feather name="play" size={14} color={colors.onAccent} style={{ marginLeft: 2 }} />
        </View>
      </Pressable>
    );
  }
  if (message.role === 'system') {
    return (
      <AppText variant="caption" tone="muted" align="center" style={{ paddingHorizontal: spacing.lg }}>
        {message.content}
      </AppText>
    );
  }
  const mine = message.role === 'user';
  return (
    <View
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        { backgroundColor: mine ? colors.elevated : colors.card, borderColor: colors.border },
      ]}
    >
      <AppText variant="small" style={{ fontSize: 13, lineHeight: 19 }}>
        {message.content}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  helpBtn: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  card: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, maxWidth: '86%' },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.regular, fontSize: 14 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
