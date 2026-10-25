/** Identidade visual: AppLogo, ilustração de montanhas e ícones das aplicações. */
import { FontAwesome6 } from '@expo/vector-icons';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

/** Logótipo: sol a nascer sobre o horizonte. */
export function AppLogo({ size = 64, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  const rays = [-150, -120, -90, -60, -30].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return `M${50 + Math.cos(a) * 27} ${60 + Math.sin(a) * 27} L${50 + Math.cos(a) * 38} ${60 + Math.sin(a) * 38}`;
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Acorde Já">
      {rays.map((d) => (
        <Path key={d} d={d} stroke={c} strokeWidth={4} strokeLinecap="round" />
      ))}
      <Path d="M30 63 A20 20 0 0 1 70 63 Z" fill={c} />
      <Path d="M8 70 Q50 55 92 70 Q50 63 8 70 Z" fill={c} />
    </Svg>
  );
}

/** Ilustração monocromática de montanhas e pinheiros (ecrã de boas-vindas). */
export function MountainIllustration({ height = 260 }: { height?: number }) {
  const W = 400;
  const H = 300;
  const tree = (x: number, base: number, h: number) => {
    const w = h * 0.36;
    let d = '';
    for (let i = 0; i < 5; i++) {
      const top = base - h + (i * h) / 6;
      const bw = (w * (i + 1.4)) / 5.4;
      d += `M${x} ${top} L${x - bw} ${top + h / 3.2} L${x + bw} ${top + h / 3.2} Z `;
    }
    d += `M${x - 1.5} ${base - 8} h3 v10 h-3 Z`;
    return d;
  };
  const leftTrees = [
    [8, 300, 190],
    [40, 300, 150],
    [70, 300, 115],
    [96, 300, 85],
  ];
  const rightTrees = [
    [392, 300, 200],
    [358, 300, 155],
    [328, 300, 110],
    [304, 300, 80],
  ];
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5a5a5a" />
          <Stop offset="0.55" stopColor="#9a9a9a" />
          <Stop offset="1" stopColor="#3a3a3a" />
        </LinearGradient>
        <LinearGradient id="far" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#d9d9d9" />
          <Stop offset="1" stopColor="#5e5e5e" />
        </LinearGradient>
        <LinearGradient id="near" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4a4a4a" />
          <Stop offset="1" stopColor="#151515" />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#sky)" />
      {/* Cordilheira distante */}
      <Path d="M0 190 L60 150 L110 170 L170 95 L205 60 L240 98 L290 140 L330 120 L400 165 L400 300 L0 300 Z" fill="url(#far)" opacity={0.85} />
      {/* Neve no pico */}
      <Path d="M205 60 L183 84 L196 82 L205 92 L214 80 L226 86 Z" fill="#f2f2f2" />
      <Path d="M170 95 L158 108 L170 104 L178 110 Z" fill="#e6e6e6" opacity={0.8} />
      {/* Encostas próximas */}
      <Path d="M0 230 L80 190 L150 215 L220 170 L300 210 L360 190 L400 205 L400 300 L0 300 Z" fill="url(#near)" />
      <G fill="#050505">
        {[...leftTrees, ...rightTrees].map(([x, b, h]) => (
          <Path key={`${x}`} d={tree(x!, b!, h!)} />
        ))}
      </G>
      <Rect width={W} height={H} fill="url(#fade)" />
    </Svg>
  );
}

const BRANDS: Record<string, { bg: string; glyph: string; gradient?: string[]; tiktok?: boolean }> = {
  instagram: { bg: '#D62976', glyph: 'instagram', gradient: ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'] },
  tiktok: { bg: '#000000', glyph: 'tiktok', tiktok: true },
  facebook: { bg: '#1877F2', glyph: 'facebook-f' },
  youtube: { bg: '#FF0000', glyph: 'play' },
};

/**
 * Ícone de uma aplicação. As apps conhecidas usam as cores oficiais; as
 * restantes usam o ícone real fornecido pelo Android ou uma inicial.
 */
export function BrandIcon({
  appId,
  name,
  size = 32,
  iconBase64,
  monochrome,
}: {
  appId: string;
  name: string;
  size?: number;
  iconBase64?: string | null;
  monochrome?: boolean;
}) {
  const { colors } = useTheme();
  const brand = BRANDS[appId];
  const radius = size * 0.26;
  if (monochrome && brand) {
    return (
      <View style={[styles.icon, { width: size, height: size, borderRadius: radius, backgroundColor: '#2a2a2a', borderColor: '#555', borderWidth: 1 }]}>
        <FontAwesome6 name={brand.glyph} brand={brand.glyph !== 'play'} solid={brand.glyph === 'play'} size={size * 0.56} color="#e5e5e5" />
      </View>
    );
  }
  if (brand) {
    return (
      <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }} accessibilityLabel={name}>
        {brand.gradient ? (
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`g-${appId}`} x1="0" y1="1" x2="1" y2="0">
                {brand.gradient.map((c, i) => (
                  <Stop key={c} offset={i / (brand.gradient!.length - 1)} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect width={size} height={size} fill={`url(#g-${appId})`} />
          </Svg>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: brand.bg }]} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.icon]}>
          {brand.tiktok ? (
            <>
              <FontAwesome6 name="tiktok" brand size={size * 0.54} color="#25F4EE" style={{ position: 'absolute', transform: [{ translateX: -1.2 }, { translateY: -1 }] }} />
              <FontAwesome6 name="tiktok" brand size={size * 0.54} color="#FE2C55" style={{ position: 'absolute', transform: [{ translateX: 1.2 }, { translateY: 1 }] }} />
              <FontAwesome6 name="tiktok" brand size={size * 0.54} color="#FFFFFF" />
            </>
          ) : (
            <FontAwesome6 name={brand.glyph} brand={brand.glyph !== 'play'} solid={brand.glyph === 'play'} size={size * (brand.glyph === 'play' ? 0.42 : 0.6)} color="#FFFFFF" />
          )}
        </View>
      </View>
    );
  }
  if (iconBase64) {
    return <Image source={{ uri: `data:image/png;base64,${iconBase64}` }} style={{ width: size, height: size, borderRadius: radius }} accessibilityLabel={name} />;
  }
  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: radius, backgroundColor: colors.elevated }]} accessibilityLabel={name}>
      <AppText variant="bodyStrong">{name.charAt(0).toUpperCase()}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
});
