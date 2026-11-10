import { DEFAULT_APPS, MINUTE, dayKey, formatDuration } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppBottomSheet,
  AppButton,
  AppCard,
  AppEmptyState,
  AppErrorState,
  AppHeader,
  AppSkeleton,
  AppText,
  BrandIcon,
  Screen,
  SectionTitle,
  toast,
} from '@/components';
import { DurationPicker, formatDurationLabel } from '@/features/limits/DurationPicker';
import { clearMemberLimit, loadDashboard, removeMember, setMemberLimit, type DashboardMember } from '@/services/family';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 2) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dias`;
};

/** Painel do responsável: os telemóveis que adicionou, o que usam, o foco, os bloqueios e os limites. */
export default function FamilyDashboard() {
  const dash = useQuery({ queryKey: ['family-dashboard'], queryFn: () => loadDashboard(7) });
  const [editing, setEditing] = useState<{ member: DashboardMember; appId: string | null } | null>(null);

  return (
    <Screen refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()} testID="family-dashboard">
      <AppHeader title="Painel da família" back />
      {dash.isLoading ? (
        <View style={{ gap: spacing.md }}>
          <AppSkeleton height={160} />
          <AppSkeleton height={160} />
        </View>
      ) : dash.isError ? (
        <AppErrorState message="Não foi possível carregar o painel. Só o responsável do grupo o pode abrir." onRetry={() => void dash.refetch()} />
      ) : !dash.data?.length ? (
        <AppEmptyState
          icon="smartphone"
          title="Ainda sem telemóveis"
          message="Partilhe o código do grupo. Quando alguém o usar no telemóvel dele, aparece aqui."
        />
      ) : (
        <View style={{ gap: spacing.xl }}>
          {dash.data.map((m) => (
            <MemberCard key={m.memberId} member={m} onEditLimit={(appId) => setEditing({ member: m, appId })} onRemoved={() => void dash.refetch()} />
          ))}
          <AppText variant="caption" tone="muted">
            Os números atualizam quando cada telemóvel abre o offly com internet. Nunca vê mensagens, conversas nem sites
            visitados.
          </AppText>
        </View>
      )}
      {editing ? (
        <LimitSheet
          member={editing.member}
          initialAppId={editing.appId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void dash.refetch();
          }}
        />
      ) : null}
    </Screen>
  );
}

function MemberCard({ member, onEditLimit, onRemoved }: { member: DashboardMember; onEditLimit: (appId: string | null) => void; onRemoved: () => void }) {
  const { colors } = useTheme();
  const today = dayKey(new Date());
  const todayApps = member.usage.filter((u) => u.day === today && u.appId !== '__screen__').sort((a, b) => b.usedMs - a.usedMs);
  const screenToday = member.usage.find((u) => u.day === today && u.appId === '__screen__')?.usedMs ?? todayApps.reduce((s, u) => s + u.usedMs, 0);
  const focusWeek = member.focus.reduce((s, f) => s + f.minutes, 0);
  const device = member.devices[0];
  const max = Math.max(1, ...todayApps.map((a) => a.usedMs));

  return (
    <AppCard testID={`member-${member.name}`}>
      <View style={styles.row}>
        <View style={[styles.avatar, { borderColor: colors.borderStrong }]}>
          <AppText variant="bodyStrong">{member.name.slice(0, 1).toUpperCase()}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{member.name}</AppText>
          <AppText variant="caption" tone="muted">
            {device ? `${device.platform === 'ios' ? 'iPhone' : device.platform === 'android' ? 'Android' : 'Web'} · visto ${ago(device.lastSeenAt)}` : 'Telemóvel ainda não sincronizou'}
          </AppText>
        </View>
      </View>

      <View style={[styles.stats, { borderColor: colors.border }]}>
        <Stat label="Ecrã hoje" value={screenToday ? formatDuration(screenToday) : '—'} />
        <Stat label="Foco (7 dias)" value={`${focusWeek} min`} />
        <Stat label="Bloqueios" value={String(member.blocks.reduce((s, b) => s + b.count, 0))} />
      </View>

      <SectionTitle>O que usou hoje</SectionTitle>
      {todayApps.length ? (
        <View style={{ gap: spacing.sm }}>
          {todayApps.slice(0, 6).map((a) => (
            <View key={a.appId} style={styles.row}>
              <BrandIcon appId={a.appId} name={a.appName} size={22} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="small">{a.appName}</AppText>
                <View style={[styles.track, { backgroundColor: colors.track }]}>
                  <View style={[styles.fill, { backgroundColor: colors.text, width: `${Math.max(4, (a.usedMs / max) * 100)}%` }]} />
                </View>
              </View>
              <AppText variant="caption" tone="secondary">
                {Math.round(a.usedMs / MINUTE)} min
              </AppText>
            </View>
          ))}
        </View>
      ) : (
        <AppText variant="small" tone="muted">
          Sem dados de hoje.
        </AppText>
      )}

      <SectionTitle>Limites</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {member.limits.map((l) => {
          const blocked = member.blocks.find((b) => b.appId === l.appId && b.lastDay === today);
          return (
            <Pressable key={l.appId} onPress={() => onEditLimit(l.appId)} accessibilityRole="button" style={styles.row}>
              <BrandIcon appId={l.appId} name={l.appName} size={22} />
              <AppText variant="small" style={{ flex: 1 }}>
                {l.appName}
                {blocked ? '  · bloqueado hoje' : ''}
              </AppText>
              <AppText variant="caption" tone={l.managed ? 'primary' : 'muted'}>
                {l.enabled ? formatDurationLabel(l.limitMinutes) : 'desligado'}
                {l.managed ? ' · definido por si' : ''}
              </AppText>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          );
        })}
        <AppButton label="Definir limite" size="sm" variant="secondary" onPress={() => onEditLimit(null)} />
      </View>

      <AppButton
        label="Retirar este telemóvel do grupo"
        size="sm"
        variant="ghost"
        style={{ marginTop: spacing.md }}
        onPress={() =>
          void removeMember(member.memberId)
            .then(() => {
              toast(`${member.name} saiu do grupo.`);
              onRemoved();
            })
            .catch(() => toast('Não foi possível retirar.', 'error'))
        }
      />
    </AppCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AppText variant="bodyStrong">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function LimitSheet({ member, initialAppId, onClose, onSaved }: { member: DashboardMember; initialAppId: string | null; onClose: () => void; onSaved: () => void }) {
  const { colors } = useTheme();
  const [appId, setAppId] = useState(initialAppId ?? DEFAULT_APPS[0]!.id);
  const app = DEFAULT_APPS.find((a) => a.id === appId) ?? DEFAULT_APPS[0]!;
  const current = member.limits.find((l) => l.appId === appId);
  const [minutes, setMinutes] = useState(current?.limitMinutes ?? app.defaultLimitMinutes);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await setMemberLimit(member.memberId, { appId: app.id, name: app.name, packageNames: [...app.androidPackages] }, minutes, true);
      toast(`Limite de ${formatDurationLabel(minutes)} no ${app.name} enviado para o telemóvel de ${member.name}.`);
      onSaved();
    } catch {
      toast('Não foi possível guardar o limite.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppBottomSheet visible onClose={onClose} title={`Limite para ${member.name}`}>
      <View style={styles.apps}>
        {DEFAULT_APPS.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              setAppId(a.id);
              setMinutes(member.limits.find((l) => l.appId === a.id)?.limitMinutes ?? a.defaultLimitMinutes);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: a.id === appId }}
            style={[styles.appChip, { borderColor: a.id === appId ? colors.text : colors.border }]}
          >
            <BrandIcon appId={a.id} name={a.name} size={20} />
            <AppText variant="caption">{a.name}</AppText>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <DurationPicker value={minutes} onChange={setMinutes} />
      </View>
      <AppButton label="Enviar limite" onPress={() => void save()} loading={busy} style={{ marginTop: spacing.lg }} testID="family-limit-save" />
      {current?.managed ? (
        <AppButton
          label="Retirar este limite"
          variant="ghost"
          onPress={() =>
            void clearMemberLimit(member.memberId, app.id)
              .then(onSaved)
              .catch(() => toast('Não foi possível retirar.', 'error'))
          }
        />
      ) : null}
      <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.sm }}>
        O telemóvel aplica o limite da próxima vez que abrir o offly com internet; a partir daí funciona mesmo offline.
      </AppText>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  apps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  appChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1 },
});
