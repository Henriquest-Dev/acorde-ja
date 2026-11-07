import { Linking, Platform } from 'react-native';
import { AcordeNative } from '../../modules/acorde-native';

export interface LauncherApp {
  packageName: string;
  label: string;
}

/**
 * Pré-visualização web: o browser não tem acesso às apps instaladas, por isso
 * mostramos uma lista fixa só para ver o layout. Nunca usada no Android.
 */
const WEB_PREVIEW: LauncherApp[] = [
  'Agenda', 'Banco', 'Calculadora', 'Câmara', 'Facebook', 'Gmail', 'Instagram', 'Mapas', 'Mensagens', 'Spotify',
  'Telefone', 'TikTok', 'Uber', 'WhatsApp', 'YouTube',
].map((label) => ({
  label,
  packageName:
    { Instagram: 'com.instagram.android', TikTok: 'com.zhiliaoapp.musically', Facebook: 'com.facebook.katana', YouTube: 'com.google.android.youtube' }[label] ??
    `preview.${label.toLowerCase()}`,
}));

export const isLauncherPreview = Platform.OS === 'web';
export const launcherSupported = Platform.OS === 'android' && AcordeNative !== null;

export async function listLauncherApps(): Promise<LauncherApp[]> {
  if (isLauncherPreview) return WEB_PREVIEW;
  if (!AcordeNative || Platform.OS !== 'android') return [];
  return AcordeNative.getLauncherApps();
}

export async function launchApp(packageName: string): Promise<boolean> {
  if (!AcordeNative || Platform.OS !== 'android') return false;
  return AcordeNative.launchApp(packageName);
}

export async function openDialer() {
  await Linking.openURL('tel:');
}

export async function openCamera() {
  await AcordeNative?.openCamera();
}

/** Activa o offly como candidato a ecrã inicial e abre a escolha do sistema. */
export async function enableAsHome(enabled: boolean) {
  if (!AcordeNative || Platform.OS !== 'android') return;
  await AcordeNative.setLauncherEnabled(enabled);
  if (enabled) await AcordeNative.openHomeSettings();
}

export async function isDefaultHome(): Promise<boolean> {
  if (!AcordeNative || Platform.OS !== 'android') return false;
  return AcordeNative.isDefaultLauncher();
}

export async function openHomeSettings() {
  await AcordeNative?.openHomeSettings();
}

export async function openGrayscaleSettings() {
  await AcordeNative?.openGrayscaleSettings();
}

/** Agrupa por inicial para a gaveta (A, B, C… e # para dígitos/símbolos). */
export function groupByInitial(apps: LauncherApp[]): { letter: string; apps: LauncherApp[] }[] {
  const map = new Map<string, LauncherApp[]>();
  for (const a of apps) {
    const first = a.label.normalize('NFD').replace(/\p{M}/gu, '').charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : '#';
    map.set(key, [...(map.get(key) ?? []), a]);
  }
  return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))).map(([letter, list]) => ({ letter, apps: list }));
}
