import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** O backend é opcional: sem configuração, o aplicativo funciona apenas localmente. */
export const isBackendConfigured = Boolean(url && anonKey);

/**
 * SecureStore (Keychain/Keystore) limita cada valor a ~2 KB; a sessão do
 * Supabase pode exceder isso, por isso é guardada em blocos.
 */
const CHUNK = 1800;
const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.some((p) => p === null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(n));
  },
  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return;
    for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isBackendConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export class BackendNotConfiguredError extends Error {
  constructor() {
    super('Servidor não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    this.name = 'BackendNotConfiguredError';
  }
}

export function requireSupabase(): SupabaseClient {
  const s = getSupabase();
  if (!s) throw new BackendNotConfiguredError();
  return s;
}

/** Traduz erros comuns do Supabase Auth para português. */
export function translateAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return 'Email ou palavra-passe incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme o seu email antes de entrar.';
  if (/already registered|already been registered/i.test(msg)) return 'Já existe uma conta com este email.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiadas tentativas. Aguarde um momento.';
  if (/network|fetch/i.test(msg)) return 'Sem ligação à Internet.';
  return msg;
}
