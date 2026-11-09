// Chamadas ao OpenRouter a partir das Edge Functions. A chave vive só nos segredos do Supabase.
import { OPENROUTER } from './coach.ts';

export function orHeaders(): Record<string, string> {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new Error('missing_openrouter_key');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://offly.app',
    'X-Title': 'offly',
  };
}

export async function orPost(path: string, body: unknown, timeoutMs = 45_000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(`${OPENROUTER}${path}`, { method: 'POST', headers: orHeaders(), body: JSON.stringify(body), signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}
