import { Feather } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, AppInput, AppText, LeafBackdrop, Offy, SegmentedControl, toast } from '@/components';
import { COUNTRIES, OTHER_COUNTRY, findCountry, type HelpLines } from '@/features/country/countries';
import { saveProfile } from '@/services/profile';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

const FIELDS: { key: keyof HelpLines; label: string; hint: string }[] = [
  { key: 'emergency', label: 'Emergência geral', hint: 'Ex.: 112, 911, 190' },
  { key: 'police', label: 'Polícia / segurança', hint: '' },
  { key: 'medical', label: 'Emergência médica (ambulância)', hint: '' },
  { key: 'crisis', label: 'Apoio emocional', hint: 'Linha de prevenção do suicídio do teu país' },
];

const deviceRegion = () => {
  try {
    return Localization.getLocales()[0]?.regionCode?.toUpperCase() ?? '';
  } catch {
    return '';
  }
};

/** Primeira configuração (e para quem já tinha conta): nome, país, língua e números de ajuda. */
export default function ProfileSetup() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { prefs } = usePrefs();
  const initialCountry = prefs.country || (findCountry(deviceRegion()) ? deviceRegion() : '');
  const [name, setName] = useState(prefs.displayName);
  const [country, setCountry] = useState(initialCountry);
  const [language, setLanguage] = useState<'pt-PT' | 'pt-BR'>(prefs.country ? prefs.language : (findCountry(initialCountry)?.language ?? 'pt-PT'));
  const [lines, setLines] = useState<Partial<HelpLines>>(() => ({ ...(findCountry(initialCountry)?.lines ?? {}), ...prefs.helpLines }));
  const [search, setSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickCountry = (code: string) => {
    const c = findCountry(code) ?? OTHER_COUNTRY;
    setCountry(c.code);
    setLanguage(c.language);
    setLines({ ...c.lines });
    setSearch('');
  };

  const useLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return toast('Sem autorização de localização. Escolhe o país na lista.', 'error');
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const code = place?.isoCountryCode?.toUpperCase() ?? '';
      if (!code) return toast('Não consegui perceber o país. Escolhe-o na lista.', 'error');
      pickCountry(findCountry(code) ? code : 'XX');
      toast(`Localização: ${place?.city ? `${place.city}, ` : ''}${findCountry(code)?.name ?? place?.country ?? code}`);
    } catch {
      toast('Não foi possível obter a localização. Escolhe o país na lista.', 'error');
    } finally {
      setLocating(false);
    }
  };

  const ready = name.trim().length >= 2 && !!country && !!(lines.emergency || lines.medical || lines.police);

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      await saveProfile({ name, country, language, helpLines: lines });
      router.replace(usePrefs.getState().prefs.onboardingDone ? '/' : '/onboarding');
    } finally {
      setSaving(false);
    }
  };

  const selected = findCountry(country);
  const list = COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <LeafBackdrop opacity={0.035} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg }}>
        <View style={{ alignItems: 'center' }}>
          <Offy size={110} mood={name.trim().length >= 2 ? 'joy' : 'listening'} />
          <AppText variant="h1" align="center" style={{ marginTop: spacing.sm }} accessibilityRole="header">
            {name.trim().length >= 2 ? `Prazer, ${name.trim().split(' ')[0]}!` : 'Como te chamas?'}
          </AppText>
          <AppText variant="body" tone="secondary" align="center">
            Assim falo contigo do teu jeito e sei a quem ligar se precisares de ajuda.
          </AppText>
        </View>

        <AppInput label="O teu nome" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" maxLength={40} testID="profile-name" />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="bodyStrong">Onde vives?</AppText>
          <AppButton label={locating ? 'A procurar…' : 'Usar a minha localização'} variant="secondary" trailingIcon="map-pin" loading={locating} onPress={() => void useLocation()} testID="profile-locate" />
          {selected ? (
            <View style={[styles.selected, { borderColor: colors.text }]}>
              <Feather name="check" size={16} color={colors.text} />
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {selected.name}
              </AppText>
              <AppText variant="small" tone="secondary" onPress={() => setCountry('')}>
                Mudar
              </AppText>
            </View>
          ) : (
            <>
              <AppInput placeholder="Procurar país" value={search} onChangeText={setSearch} />
              <View style={styles.chips}>
                {list.map((c) => (
                  <Pressable key={c.code} onPress={() => pickCountry(c.code)} accessibilityRole="button" style={[styles.chip, { borderColor: colors.border }]}>
                    <AppText variant="small">{c.name}</AppText>
                  </Pressable>
                ))}
                <Pressable onPress={() => pickCountry('XX')} accessibilityRole="button" style={[styles.chip, { borderColor: colors.border }]}>
                  <AppText variant="small">Outro país</AppText>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {selected ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyStrong">Como queres que fale contigo?</AppText>
              <SegmentedControl
                options={[
                  { value: 'pt-PT', label: 'Português de Portugal' },
                  { value: 'pt-BR', label: 'Português do Brasil' },
                ]}
                value={language}
                onChange={setLanguage}
              />
            </View>

            <View style={{ gap: spacing.md }}>
              <AppText variant="bodyStrong">Números de ajuda do teu país</AppText>
              <AppText variant="small" tone="secondary">
                Confirma ou escreve os números. Aparecem em «Preciso de ajuda agora».
              </AppText>
              {FIELDS.map((f) => (
                <AppInput
                  key={f.key}
                  label={f.label}
                  hint={f.hint || undefined}
                  value={lines[f.key] ?? ''}
                  onChangeText={(v) => setLines((l) => ({ ...l, [f.key]: v.replace(/[^\d +]/g, '') }))}
                  keyboardType="phone-pad"
                  maxLength={18}
                />
              ))}
            </View>
          </>
        ) : null}

        <AppButton label="Continuar" disabled={!ready} loading={saving} onPress={() => void save()} testID="profile-save" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  selected: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1 },
});
