import { buildMobileConfig, pickResolver, type ResolverId } from '@acorde/core';
import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppText, ListRow, Screen, SectionTitle, toast } from '@/components';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

type Choice = ResolverId | 'custom';

/** Resolvedor próprio (ex.: NextDNS / AdGuard DNS privado) para incluir apostas e listas à medida. */
const CUSTOM_DOH = process.env.EXPO_PUBLIC_IOS_DOH_URL;

const OPTIONS: { id: Choice; title: string; subtitle: string }[] = [
  { id: 'adguard_family', title: 'Adultos + anúncios', subtitle: 'AdGuard DNS Family' },
  { id: 'cloudflare_family', title: 'Só adultos', subtitle: 'Cloudflare for Families' },
  { id: 'adguard', title: 'Só anúncios e rastreadores', subtitle: 'AdGuard DNS' },
  ...(CUSTOM_DOH ? [{ id: 'custom' as const, title: 'Filtro offly completo', subtitle: 'Adultos, apostas e anúncios' }] : []),
];

/**
 * Proteção no iPhone/iPad sem App Store: gera um perfil de configuração
 * (.mobileconfig) com DNS cifrado de filtragem. Funciona em todas as apps e
 * navegadores do iPhone, mas pode ser removido pelo utilizador nas Definições.
 */
export default function IphoneShield() {
  const categories = usePrefs((s) => s.prefs.shield.categories);
  const initial: Choice = CUSTOM_DOH ? 'custom' : pickResolver({ ...categories, ads: categories.ads ?? false, adult: true });
  const [choice, setChoice] = useState<Choice>(initial);

  const download = async () => {
    const resolver = choice === 'custom' ? { doh: CUSTOM_DOH!, label: 'offly' } : choice;
    const xml = buildMobileConfig({ resolver, profileUuid: randomUUID(), payloadUuid: randomUUID() });
    const name = 'offly-protecao.mobileconfig';
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([xml], { type: 'application/x-apple-aspen-config' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        toast('Perfil descarregado. Abra as Definições do iPhone para o instalar.');
        return;
      }
      const file = new File(Paths.cache, name);
      file.create({ overwrite: true });
      file.write(xml);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/x-apple-aspen-config', UTI: 'com.apple.mobileconfig', dialogTitle: 'Perfil de proteção' });
    } catch {
      toast('Não foi possível gerar o perfil.', 'error');
    }
  };

  return (
    <Screen testID="shield-iphone">
      <AppHeader title="iPhone e iPad" back />
      <AppText variant="small" tone="secondary">
        Um perfil de DNS cifrado filtra sites em todas as apps e navegadores do iPhone, sem instalar nada da App Store e sem ver o
        seu histórico.
      </AppText>

      <SectionTitle>O que bloquear</SectionTitle>
      <View style={{ gap: spacing.md }}>
        {OPTIONS.map((o) => (
          <ListRow
            key={o.id}
            title={o.title}
            subtitle={o.subtitle}
            icon={{ set: 'mci', name: choice === o.id ? 'radiobox-marked' : 'radiobox-blank' }}
            onPress={() => setChoice(o.id)}
            accessibilityLabel={`${o.title}${choice === o.id ? ', seleccionado' : ''}`}
          />
        ))}
      </View>

      <AppButton label="Gerar perfil" onPress={() => void download()} style={{ marginTop: spacing.xl }} testID="download-profile" />

      <SectionTitle>Como instalar</SectionTitle>
      <AppCard>
        {[
          'Abra o offly no Safari do iPhone e toque em «Gerar perfil» (ou envie o ficheiro por AirDrop ou e-mail).',
          'Toque em «Permitir». Aparece «Perfil descarregado».',
          'Definições → Geral → VPN e gestão de dispositivos → offly — Proteção → Instalar.',
          'Pronto: os sites filtrados deixam de abrir em qualquer app.',
        ].map((t, i) => (
          <AppText key={t} variant="small" style={{ marginTop: i ? spacing.sm : 0 }}>
            {i + 1}. {t}
          </AppText>
        ))}
      </AppCard>

      <SectionTitle>Limitações honestas</SectionTitle>
      <AppCard>
        <AppText variant="caption" tone="muted">
          O perfil pode ser removido nas Definições, excepto num iPhone supervisionado (Apple Configurator). Os filtros públicos não
          bloqueiam sites de apostas; para isso é preciso um resolvedor próprio (NextDNS ou AdGuard DNS privado), que se configura com
          EXPO_PUBLIC_IOS_DOH_URL. Limites de tempo por app e o bloqueio trancado do desafio no iPhone exigem a app nativa, que só pode
          ser instalada com uma conta Apple Developer paga.
        </AppText>
      </AppCard>
    </Screen>
  );
}
