import { SEED_DOMAINS, SHIELD_CATEGORIES, type ShieldCategory } from '@acorde/core';
import { View } from 'react-native';
import { AppHeader, AppSwitch, AppText, ListRow, Screen, toast } from '@/components';
import { applyShield } from '@/services/shield';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

/** Bloquear por categoria. */
export default function ShieldCategories() {
  const { prefs, update } = usePrefs();

  const toggle = async (id: ShieldCategory, on: boolean) => {
    if (!on && prefs.shield.strictMode) return toast('O modo restrito impede desligar categorias.', 'error');
    const shield = { ...prefs.shield, categories: { ...prefs.shield.categories, [id]: on } };
    await update({ shield });
    const r = await applyShield(shield);
    if (r.status === 'unsupported') toast(r.reason, 'error');
    if (r.status === 'permission_denied') toast('A VPN local não foi autorizada.', 'error');
  };

  return (
    <Screen>
      <AppHeader title="Bloquear por categoria" back />
      <View style={{ gap: spacing.md }}>
        {SHIELD_CATEGORIES.map((c) => (
          <ListRow
            key={c.id}
            title={c.label}
            subtitle={`${c.description} ${SEED_DOMAINS[c.id].length} domínios base.`}
            right={<AppSwitch value={prefs.shield.categories[c.id]} onValueChange={(v) => void toggle(c.id, v)} accessibilityLabel={c.label} />}
          />
        ))}
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xl }}>
        Com «Sites adultos» activo, os pedidos DNS são também resolvidos pelo Cloudflare for Families, que cobre muitos mais domínios
        de conteúdo adulto. Nenhum histórico de navegação é guardado — apenas uma contagem diária de tentativas bloqueadas.
      </AppText>
    </Screen>
  );
}
