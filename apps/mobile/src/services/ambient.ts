/**
 * Sons calmos em ciclo (chuva, ondas, floresta). Ficheiros locais, por isso funcionam offline.
 * Só toca um de cada vez; entra e sai com um fade curto.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';

export type AmbientSound = 'none' | 'rain' | 'waves' | 'forest';

export const AMBIENT_LABEL: Record<AmbientSound, string> = { none: 'Silêncio', rain: 'Chuva', waves: 'Ondas', forest: 'Floresta' };

const SOURCES = {
  rain: require('../../assets/sounds/rain.mp3'),
  waves: require('../../assets/sounds/waves.mp3'),
  forest: require('../../assets/sounds/forest.mp3'),
} as const;

const VOLUME = 0.6;
let current: { sound: AmbientSound; player: AudioPlayer } | null = null;
/** Cada pedido tem um número: um pedido antigo que termine depois de um «parar» não volta a tocar. */
let generation = 0;

// Ao sair do app, o som pára sempre.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') stopAmbient(true);
});

const fades = new Map<AudioPlayer, ReturnType<typeof setInterval>>();

/** Fade de volume próprio de cada leitor (trocar de som não deixa o anterior a tocar). */
const fade = (player: AudioPlayer, from: number, to: number, ms: number, done?: () => void) => {
  const old = fades.get(player);
  if (old) clearInterval(old);
  const steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  player.volume = from;
  const timer = setInterval(() => {
    i += 1;
    try {
      player.volume = from + ((to - from) * i) / steps;
    } catch {
      i = steps;
    }
    if (i >= steps) {
      clearInterval(timer);
      fades.delete(player);
      done?.();
    }
  }, 50);
  fades.set(player, timer);
};

/** Começa (ou troca) o som de fundo. `none` pára. */
export async function playAmbient(sound: AmbientSound): Promise<void> {
  if (current?.sound === sound) return;
  stopAmbient();
  if (sound === 'none') return;
  const mine = generation;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
    if (mine !== generation || AppState.currentState !== 'active') return; // entretanto pediram para parar
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

/** Pára o som (com um fade de meio segundo, ou de imediato). */
export function stopAmbient(immediate = false): void {
  generation += 1;
  const c = current;
  current = null;
  if (!c) return;
  const end = () => {
    try {
      c.player.pause();
      c.player.remove();
    } catch {
      // o leitor já foi libertado
    }
  };
  if (immediate) {
    const t = fades.get(c.player);
    if (t) clearInterval(t);
    fades.delete(c.player);
    end();
  } else fade(c.player, c.player.volume, 0, 500, end);
}

export const isAmbientPlaying = () => current !== null;
