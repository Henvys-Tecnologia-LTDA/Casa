import { FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { parse, useful, type LinkInfo } from '../../supabase/functions/ler-link/parse';
import { friendlyError, supabase } from './supabase';

// "Colar link": lê nome, foto, preço e loja da página do produto. No celular, lê direto do aparelho
// (as lojas costumam bloquear servidores, mas não celulares); se não der, ou no navegador (que não
// deixa ler páginas de outros sites), usa a função ler-link do Supabase.

export type { LinkInfo };

async function doCelular(url: string): Promise<LinkInfo | null> {
  if (Platform.OS === 'web') return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!res.ok) return null;
    const info = parse((await res.text()).slice(0, 3_000_000), res.url || url);
    return useful(info) ? info : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function lerLink(raw: string): Promise<LinkInfo> {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const direto = await doCelular(url);
  if (direto) return direto;
  const { data, error } = await supabase.functions.invoke('ler-link', { body: { url } });
  if (error) {
    let msg = '';
    if (error instanceof FunctionsHttpError) {
      try { msg = String((await error.context.json())?.error || ''); } catch {}
    }
    throw new Error(msg || friendlyError(error));
  }
  return data as LinkInfo;
}

/** Acha um link num texto colado (os apps de loja costumam compartilhar "Olha isso: https://…"). */
export function linkIn(text: string): string {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? text.trim();
}
