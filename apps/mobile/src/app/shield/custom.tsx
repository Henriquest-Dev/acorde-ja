import { normalizeDomain } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppButton, AppEmptyState, AppHeader, AppInput, AppText, ListRow, Screen, SegmentedControl, toast } from '@/components';
import { applyShield } from '@/services/shield';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Lista personalizada de domínios bloqueados e permitidos. */
export default function ShieldCustom() {
  const { colors } = useTheme();
  const { prefs, update } = usePrefs();
  const [mode, setMode] = useState<'block' | 'allow'>('block');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const key = mode === 'block' ? 'customDomains' : 'allowDomains';
  const list = prefs.shield[key];

  const save = async (next: string[]) => {
    const shield = { ...prefs.shield, [key]: next };
    await update({ shield });
    const r = await applyShield(shield);
    if (r.status === 'unsupported') toast(r.reason, 'error');
  };

  const add = async () => {
    const d = normalizeDomain(value);
    if (!d) return setError('Indique um domínio válido, ex.: exemplo.pt');
    if (list.includes(d)) return setError('Este domínio já está na lista');
    setError(undefined);
    setValue('');
    await save([...list, d].sort());
  };

  const remove = async (d: string) => {
    if (mode === 'block' && prefs.shield.strictMode) return toast('O modo restrito impede remover domínios.', 'error');
    await save(list.filter((x) => x !== d));
  };

  return (
    <Screen>
      <AppHeader title="Lista personalizada" back />
      <SegmentedControl
        options={[
          { value: 'block', label: 'Bloquear' },
          { value: 'allow', label: 'Permitir sempre' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppInput
            placeholder="exemplo.pt"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={value}
            onChangeText={setValue}
            onSubmitEditing={add}
            error={error}
            accessibilityLabel="Domínio"
          />
        </View>
        <AppButton label="Adicionar" size="sm" onPress={add} style={{ minHeight: 50 }} />
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
        {mode === 'block' ? 'Os subdomínios também são bloqueados.' : 'Domínios permitidos não são afectados pelas categorias (excepto em modo restrito).'}
      </AppText>
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        {list.length === 0 ? (
          <AppEmptyState icon="list" title="Lista vazia" message="Adicione os sites que quer evitar." />
        ) : (
          list.map((d) => (
            <ListRow
              key={d}
              icon={{ set: 'feather', name: 'globe' }}
              title={d}
              right={
                <Pressable onPress={() => void remove(d)} accessibilityRole="button" accessibilityLabel={`Remover ${d}`} hitSlop={10}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </Pressable>
              }
            />
          ))
        )}
      </View>
    </Screen>
  );
}
