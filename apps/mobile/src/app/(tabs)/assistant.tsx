import { MINUTE } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, LeafBackdrop, MOOD_LABEL, Offy, moodFromText, type OffyMood } from '@/components';
import { speak } from '@/services/coach';
import { familyInviteForChat, wantsFamilyInvite } from '@/services/family';
import { useToday } from '@/hooks/queries';
import { kvGet, kvSet } from '@/repositories/kv';
import { addMessage, listMessages, type ChatMessage } from '@/repositories/chat';
import { AssistantUnavailableError, sendToAssistant } from '@/services/assistant';
import { isBackendConfigured } from '@/services/supabase';
import { useSession } from '@/services/auth';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

const greeting = (name: string) =>
  name ? `Olá, ${name}. Estou aqui contigo. Como te sentes agora?` : 'Olá. Estou aqui contigo. Como te sentes agora?';

const nowMs = () => Date.now();

const SUGGESTIONS = [
  'Estou ansioso e não paro de pegar no telemóvel',
  'Ajuda-me a concentrar no estudo',
  'Quero adicionar o telemóvel do meu filho',
  'Preciso de uma pausa',
];

const OFFLINE_TEXT: Record<AssistantUnavailableError['reason'], string> = {
  no_backend: 'O assistente precisa de ligação ao servidor do offly, que não está configurado nesta instalação.',
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
  const { prefs } = usePrefs();
  const { session } = useSession();
  const today = useToday();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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
    {
      id: 'greeting',
      conversationId: conv.data?.id ?? '',
      role: 'assistant',
      content: greeting(prefs.displayName.trim()),
      kind: 'text',
      createdAt: 0,
    },
    ...(conv.data?.messages ?? []),
  ];

  // Emoção do Offy: acompanha a última coisa que a pessoa disse; senão, como está a correr o dia.
  const lastUser = [...(conv.data?.messages ?? [])].reverse().find((m) => m.role === 'user');
  const snap = today.data;
  const dayMood: OffyMood =
    snap?.measured && snap.totals.limitMs > 0
      ? snap.totals.usedMs >= snap.totals.limitMs
        ? 'calm'
        : snap.totals.usedMs < snap.totals.limitMs * 0.8
          ? 'joy'
          : 'idle'
      : 'idle';
  const mood: OffyMood = sending ? 'thinking' : (lastUser && moodFromText(lastUser.content)) || dayMood;

  const push = async (m: Omit<ChatMessage, 'id' | 'conversationId' | 'createdAt'>) => {
    if (!conv.data) return;
    await addMessage({
      ...m,
      id: randomUUID(),
      conversationId: conv.data.id,
      createdAt: nowMs(),
    });
  };

  // O Offy trata da conta família: cria o grupo (se preciso) e dá o código para o outro telemóvel.
  const inviteFamily = async () => {
    try {
      const r = await familyInviteForChat(prefs.displayName);
      await push({
        role: 'assistant',
        kind: 'text',
        content:
          `${r.created ? `Criei o grupo «${r.groupName}» e tu és o responsável. ` : ''}` +
          `Para adicionar um telemóvel: instala lá o offly, cria uma conta e vai a Família → Entrar num grupo com o código ${r.code}. ` +
          'Assim que entrar, aparece no teu Painel da família, com o tempo, o foco e os bloqueios.',
      });
      await qc.invalidateQueries({ queryKey: ['family'] });
      void Share.share({
        message: `Junta-te à minha família no offly. Abre o app → Família → Entrar num grupo e usa o código ${r.code}.`,
      });
    } catch (e) {
      const why = e instanceof Error ? e.message : '';
      await push({
        role: 'assistant',
        kind: 'text',
        content:
          why === 'not_guardian'
            ? 'Já fazes parte de uma família como membro. Só o responsável do grupo pode adicionar telemóveis.'
            : why === 'no_session'
              ? 'Preciso que tenhas sessão iniciada para criar a família.'
              : 'Agora não consegui ligar ao servidor. Tenta outra vez quando tiveres internet.',
      });
    } finally {
      await qc.invalidateQueries({ queryKey: ['chat'] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const send = async (preset?: string) => {
    const message = (preset ?? text).trim();
    if (!message || !conv.data || sending) return;
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
      if (wantsFamilyInvite(message))
        await push({
          role: 'assistant',
          content: 'family',
          kind: 'card:family',
        });
    } catch (e) {
      const reason = e instanceof AssistantUnavailableError ? e.reason : 'server';
      await push({
        role: 'system',
        content: OFFLINE_TEXT[reason],
        kind: 'text',
      });
      if (wantsFamilyInvite(message))
        await push({
          role: 'assistant',
          content: 'family',
          kind: 'card:family',
        });
      await push({
        role: 'assistant',
        content: 'breathing',
        kind: 'card:breathing',
      });
    } finally {
      setSending(false);
      await qc.invalidateQueries({ queryKey: ['chat'] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <LeafBackdrop />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Offy size={44} mood={mood} testID="offy-header" />
        <View style={{ flex: 1 }}>
          <AppText variant="small" weight="semibold">
            Offy
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={[
                styles.status,
                {
                  backgroundColor: online ? colors.text : 'transparent',
                  borderColor: colors.textMuted,
                },
              ]}
            />
            <AppText variant="caption" tone="muted" style={{ fontSize: 10 }}>
              {sending ? 'A pensar…' : `${online ? 'Online' : 'Offline'} · ${MOOD_LABEL[mood]}`}
            </AppText>
          </View>
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
        renderItem={({ item }) => <Bubble message={item} voice={online && prefs.voiceCoach} onFamily={() => void inviteFamily()} />}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Offy size={124} mood={mood} testID="offy-hero" />
            <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.sm }}>
              Sem pressa. Escreve como se fosse a um amigo.
            </AppText>
          </View>
        }
        ListFooterComponent={
          sending ? (
            <View
              style={[styles.bubble, styles.theirs, styles.thinking, { backgroundColor: colors.card, borderColor: colors.border }]}
              testID="offy-thinking"
            >
              <Offy size={28} mood="thinking" />
              <AppText variant="caption" tone="muted">
                O Offy está a pensar…
              </AppText>
            </View>
          ) : (conv.data?.messages.length ?? 0) === 0 ? (
            <View style={styles.chips}>
              {SUGGESTIONS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => void send(q)}
                  accessibilityRole="button"
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <AppText variant="caption">{q}</AppText>
                </Pressable>
              ))}
            </View>
          ) : undefined
        }
      />

      {!online ? (
        <AppText variant="caption" tone="muted" align="center" style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
          {isBackendConfigured
            ? 'Sem ligação ao Offy agora. O bloqueio, os limites e o foco continuam a funcionar.'
            : OFFLINE_TEXT.no_backend}
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
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          testID="chat-input"
        />
        <Pressable
          onPress={() => void send()}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          style={[
            styles.send,
            {
              backgroundColor: colors.accent,
              opacity: !text.trim() || sending ? 0.4 : 1,
            },
          ]}
        >
          <Feather name="send" size={16} color={colors.onAccent} style={{ marginLeft: -2 }} />
        </Pressable>
      </View>

    </KeyboardAvoidingView>
  );
}

function Bubble({ message, voice, onFamily }: { message: ChatMessage; voice: boolean; onFamily: () => void }) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  if (message.kind.startsWith('card:')) {
    const card = message.kind.slice(5);
    const meta =
      card === 'focus'
        ? {
            title: 'Sessão de foco',
            sub: '25 minutos',
            go: () => router.push({ pathname: '/focus', params: { autostart: '1' } }),
          }
        : card === 'help'
          ? {
              title: 'Preciso de ajuda agora',
              sub: 'Apoio passo a passo',
              go: () => router.push('/help-now'),
            }
          : card === 'family'
            ? {
                title: 'Adicionar telemóvel à família',
                sub: 'Eu crio o grupo e dou-te o código',
                go: onFamily,
              }
            : {
                title: 'Exercício de respiração',
                sub: '2 minutos',
                go: () => router.push('/breathing'),
              };
    return (
      <Pressable
        onPress={meta.go}
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
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
        {
          backgroundColor: mine ? colors.elevated : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <AppText variant="small" style={{ fontSize: 14, lineHeight: 21 }}>
        {message.content}
      </AppText>
      {!mine && voice && message.id !== 'greeting' ? (
        <Pressable
          onPress={async () => {
            setPlaying(true);
            await speak(message.content);
            setTimeout(() => setPlaying(false), 1500);
          }}
          accessibilityRole="button"
          accessibilityLabel="Ouvir esta resposta"
          hitSlop={8}
          style={styles.listen}
        >
          <Feather name={playing ? 'volume-2' : 'volume-1'} size={13} color={colors.textMuted} />
          <AppText variant="caption" tone="muted" style={{ fontSize: 11 }}>
            {playing ? 'A falar…' : 'Ouvir'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  status: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chips: { gap: spacing.sm, marginTop: spacing.lg, alignItems: 'flex-start' },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  helpBtn: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubble: {
    maxWidth: '84%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '86%',
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
