import Constants from 'expo-constants';
import { Linking, Platform, View } from 'react-native';
import { AppCard, AppHeader, AppLogo, AppText, ListRow, Screen, SectionTitle } from '@/components';
import { spacing } from '@/theme/tokens';

const SUPPORT = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;

/** Porque pedimos cada permissão — transparência total. */
const PERMISSIONS: { title: string; why: string }[] = [
  { title: 'Acesso aos dados de utilização', why: 'Para medir quanto tempo usa cada app e aplicar os limites que definiu. Os dados ficam no seu telemóvel.' },
  { title: 'Sobrepor a outras apps', why: 'Para mostrar o ecrã de pausa quando um limite termina.' },
  { title: 'VPN local', why: 'Filtra pedidos DNS no próprio telemóvel para bloquear os sites que escolheu. Não é uma VPN de terceiros: o tráfego não passa pelos nossos servidores e não guardamos histórico de navegação.' },
  { title: 'Bloqueio reforçado (acessibilidade, opcional)', why: 'Só para saber que app está aberta e fechar de imediato a que já esgotou o limite, como o YouTube e os Shorts. Não lê nem guarda o conteúdo do ecrã.' },
  { title: 'Notificações', why: 'Avisos de limite, lembretes de hábitos e o serviço que mantém os bloqueios activos.' },
];

const PRIVACY: string[] = [
  'Funciona sem conta: limites, tempos, hábitos e desafios ficam guardados só no dispositivo.',
  'Com conta, só sincronizamos o que autorizar, e pode desligar a sincronização a qualquer momento.',
  'Nunca vendemos dados nem mostramos anúncios.',
  'Não guardamos os sites que visita: apenas uma contagem diária de tentativas bloqueadas.',
  'Pode exportar ou eliminar todos os seus dados em Privacidade e dados.',
];

const TERMS: string[] = [
  'O offly é uma ferramenta de autocontrolo. Não é tratamento médico nem psicológico.',
  'Os bloqueios dependem das permissões do sistema; algumas definições do telemóvel podem contorná-los.',
  'As subscrições renovam até cancelar; o cancelamento mantém o acesso até ao fim do período pago.',
  'Pode pedir reembolso nos primeiros 14 dias após a compra, através do suporte.',
];

/** Sobre o offly: versão, permissões, privacidade, termos e contacto. */
export default function About() {
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Screen testID="about">
      <AppHeader title="Sobre" back />
      <View style={{ alignItems: 'center', marginVertical: spacing.xl }}>
        <AppLogo size={72} />
        <AppText variant="h2">offly</AppText>
        <AppText variant="caption" tone="muted">
          Versão {version} · {Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web'}
        </AppText>
        <AppText variant="small" tone="secondary" align="center" style={{ marginTop: spacing.sm }}>
          Menos tela. Mais vida.
        </AppText>
      </View>

      <SectionTitle>Porque pedimos permissões</SectionTitle>
      <AppCard>
        {PERMISSIONS.map((p, i) => (
          <View key={p.title} style={{ marginTop: i ? spacing.md : 0 }}>
            <AppText variant="bodyStrong">{p.title}</AppText>
            <AppText variant="small" tone="secondary">
              {p.why}
            </AppText>
          </View>
        ))}
      </AppCard>

      <SectionTitle>Privacidade</SectionTitle>
      <AppCard>
        {PRIVACY.map((t, i) => (
          <AppText key={t} variant="small" tone="secondary" style={{ marginTop: i ? spacing.sm : 0 }}>
            {t}
          </AppText>
        ))}
      </AppCard>

      <SectionTitle>Termos</SectionTitle>
      <AppCard>
        {TERMS.map((t, i) => (
          <AppText key={t} variant="small" tone="secondary" style={{ marginTop: i ? spacing.sm : 0 }}>
            {t}
          </AppText>
        ))}
      </AppCard>

      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        {PRIVACY_URL ? <ListRow title="Política de privacidade completa" icon={{ set: 'feather', name: 'file-text' }} chevron onPress={() => void Linking.openURL(PRIVACY_URL)} /> : null}
        {TERMS_URL ? <ListRow title="Termos de utilização completos" icon={{ set: 'feather', name: 'file-text' }} chevron onPress={() => void Linking.openURL(TERMS_URL)} /> : null}
        {SUPPORT ? (
          <ListRow title="Contactar o suporte" subtitle={SUPPORT} icon={{ set: 'feather', name: 'mail' }} chevron onPress={() => void Linking.openURL(`mailto:${SUPPORT}?subject=offly ${version}`)} />
        ) : null}
      </View>
    </Screen>
  );
}
