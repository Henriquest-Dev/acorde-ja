import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppHeader, AppText, FadeInItem, PressableScale, Screen, SectionTitle, SegmentedControl, toast } from '@/components';
import { BillingNotConfiguredError, purchase, restorePurchases } from '@/features/billing/billing';
import { COMPARISON, PLANS, formatUsd, yearlySavings, type BillingPeriod, type Plan, type PlanPrice } from '@/features/billing/plans';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

/** Planos e faturação — tabela de planos em USD, mensal ou anual. */
export default function Billing() {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const [selected, setSelected] = useState<Plan['id']>('pro');
  const [busy, setBusy] = useState(false);
  const plan = PLANS.find((p) => p.id === selected)!;
  const price = priceFor(plan, period);

  const buy = async () => {
    if (!price) return;
    setBusy(true);
    try {
      await purchase(price.price);
    } catch (e) {
      toast(e instanceof BillingNotConfiguredError ? e.message : 'Não foi possível concluir a compra.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const cta =
    plan.id === 'free'
      ? 'Continuar grátis'
      : plan.trialDays && price?.kind === 'yearly'
        ? `Começar ${plan.trialDays} dias grátis`
        : price?.kind === 'once'
          ? `Comprar por ${formatUsd(price.price.usd)}`
          : `Subscrever por ${formatUsd(price?.price.usd ?? 0)}`;

  return (
    <Screen
      testID="billing"
      footer={
        <View style={{ gap: spacing.sm }}>
          <AppButton label={cta} onPress={plan.id === 'free' ? () => toast('Está no plano Grátis.') : buy} loading={busy} testID="billing-cta" />
          <AppText variant="caption" tone="muted" align="center">
            {plan.id === 'free' || price?.kind === 'once'
              ? 'Sem renovação automática.'
              : `Renova automaticamente. Cancele quando quiser na loja de aplicações.${plan.trialDays && price?.kind === 'yearly' ? ' Não é cobrado durante o teste.' : ''}`}
          </AppText>
        </View>
      }
    >
      <AppHeader title="Planos" back />
      <FadeInItem index={0}>
        <AppText variant="display" style={{ fontSize: 40, letterSpacing: -1.5 }}>
          offly <AppText variant="display" tone="muted" style={{ fontSize: 40, letterSpacing: -1.5 }}>Pro</AppText>
        </AppText>
        <AppText variant="body" tone="secondary" style={{ marginTop: spacing.xs }}>
          Menos tela. Mais vida. Escolha o plano certo para si.
        </AppText>
      </FadeInItem>

      <View style={{ marginTop: spacing.xl }}>
        <SegmentedControl
          options={[
            { value: 'yearly', label: `Anual · poupe ${yearlySavings(PLANS[1]!)}%` },
            { value: 'monthly', label: 'Mensal' },
          ]}
          value={period}
          onChange={setPeriod}
          testID="billing-period"
        />
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        {PLANS.map((p, i) => {
          const pr = priceFor(p, period);
          const active = p.id === selected;
          return (
            <FadeInItem key={p.id} index={i + 1}>
              <PressableScale
                onPress={() => setSelected(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${p.name}${pr ? `, ${formatUsd(pr.price.usd)} ${pr.suffix}` : ''}`}
                style={[styles.plan, { backgroundColor: colors.card, borderColor: active ? colors.text : colors.border, borderWidth: active ? 2 : 1 }]}
                scaleTo={0.98}
                testID={`plan-${p.id}`}
              >
                <View style={styles.planTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <AppText variant="h3">{p.name}</AppText>
                      {p.highlight ? (
                        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                          <AppText variant="caption" weight="bold" style={{ color: colors.onAccent, fontSize: 10, letterSpacing: 0.8 }}>
                            {p.highlight.toUpperCase()}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <AppText variant="caption" tone="muted">
                      {p.tagline}
                    </AppText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText variant="h2" style={{ fontSize: 24 }}>
                      {p.id === 'free' ? '$0' : pr ? formatUsd(pr.price.usd) : '—'}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {p.id === 'free' ? 'para sempre' : pr?.suffix ?? 'só anual'}
                    </AppText>
                  </View>
                </View>
                {pr?.kind === 'yearly' && p.prices.monthly ? (
                  <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
                    Equivale a {formatUsd(pr.price.usd / 12)}/mês · poupa {yearlySavings(p)}%
                    {p.trialDays ? ` · ${p.trialDays} dias grátis` : ''}
                  </AppText>
                ) : null}
                {active ? (
                  <View style={{ gap: 6, marginTop: spacing.md }}>
                    {p.features.map((f) => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Feather name="check" size={14} color={colors.text} />
                        <AppText variant="small" tone="secondary">
                          {f}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </PressableScale>
            </FadeInItem>
          );
        })}
      </View>

      <SectionTitle>Comparar planos</SectionTitle>
      <View style={[styles.table, { borderColor: colors.border }]} testID="billing-table">
        <View style={[styles.tr, { borderBottomColor: colors.border }]}>
          <AppText variant="caption" tone="muted" style={styles.th}>
            {' '}
          </AppText>
          {['Grátis', 'Pro', 'Pro+IA', 'Família'].map((h) => (
            <AppText key={h} variant="caption" weight="semibold" align="center" style={styles.td}>
              {h}
            </AppText>
          ))}
        </View>
        {COMPARISON.map((row, i) => (
          <View key={row.feature} style={[styles.tr, { borderBottomColor: colors.border, borderBottomWidth: i === COMPARISON.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
            <AppText variant="caption" tone="secondary" style={styles.th}>
              {row.feature}
            </AppText>
            {(['free', 'pro', 'pro_ai', 'family'] as const).map((k) => {
              const v = row.values[k];
              return (
                <View key={k} style={[styles.td, { alignItems: 'center' }]}>
                  {typeof v === 'string' ? (
                    <AppText variant="caption">{v}</AppText>
                  ) : v ? (
                    <Feather name="check" size={14} color={colors.text} accessibilityLabel="Incluído" />
                  ) : (
                    <Feather name="minus" size={14} color={colors.textMuted} accessibilityLabel="Não incluído" />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <AppButton
        label="Restaurar compras"
        variant="ghost"
        size="sm"
        style={{ marginTop: spacing.lg }}
        onPress={() =>
          void restorePurchases().catch((e) => toast(e instanceof BillingNotConfiguredError ? e.message : 'Não foi possível restaurar.', 'error'))
        }
      />
      <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.sm }}>
        Preços em dólares americanos (USD). A loja pode mostrar o valor convertido para a sua moeda. Se a subscrição terminar durante um
        desafio, a proteção mantém-se até à data escolhida.
      </AppText>
    </Screen>
  );
}

function priceFor(plan: Plan, period: BillingPeriod): { price: PlanPrice; suffix: string; kind: BillingPeriod | 'once' } | null {
  if (plan.prices.once) return { price: plan.prices.once, suffix: 'uma vez', kind: 'once' };
  const p = plan.prices[period] ?? plan.prices.yearly;
  if (!p) return null;
  const kind = plan.prices[period] ? period : 'yearly';
  return { price: p, suffix: kind === 'yearly' ? '/ano' : '/mês', kind };
}

const styles = StyleSheet.create({
  plan: { borderRadius: radii.lg, padding: spacing.lg },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm },
  th: { flex: 1.7, paddingVertical: 8 },
  td: { flex: 1 },
});
