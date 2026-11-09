/**
 * Sons calmos em ciclo (chuva, ondas, floresta). Ficheiros locais, por isso funcionam offline.
 * Só toca um de cada vez; entra e sai com um fade curto.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type AmbientSound = 'none' | 'rain' | 'waves' | 'forest';

export const AMBIENT_LABEL: Record<AmbientSound, string> = { none: 'Silêncio', rain: 'Chuva', waves: 'Ondas', forest: 'Floresta' };

const SOURCES = {
  rain: require('../../assets/sounds/rain.mp3'),
  waves: require('../../assets/sounds/waves.mp3'),
  forest: require('../../assets/sounds/forest.mp3'),
} as const;

const VOLUME = 0.6;
let current: { sound: AmbientSound; player: AudioPlayer } | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

const fade = (player: AudioPlayer, from: number, to: number, ms: number, done?: () => void) => {
  if (fadeTimer) clearInterval(fadeTimer);
  const steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  player.volume = from;
  fadeTimer = setInterval(() => {
    i += 1;
    player.volume = from + ((to - from) * i) / steps;
    if (i >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      done?.();
    }
  }, 50);
};

/** Começa (ou troca) o som de fundo. `none` pára. */
export async function playAmbient(sound: AmbientSound): Promise<void> {
  if (current?.sound === sound) return;
  stopAmbient();
  if (sound === 'none') return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
    const player = createAudioPlayer(SOURCES[sound]);
    player.loop = true;
    player.volume = 0;
    player.play();
    current = { sound, player };
    fade(player, 0, VOLUME, 1200);
  } catch {
    current = null; // sem áudio: o ecrã continua a funcionar em silêncio
  }
}

/** Pára o som com um fade de meio segundo. */
export function stopAmbient(): void {
  const c = current;
  current = null;
  if (!c) return;
  fade(c.player, c.player.volume, 0, 500, () => {
    c.player.pause();
    c.player.remove();
  });
}
