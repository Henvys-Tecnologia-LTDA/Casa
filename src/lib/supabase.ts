import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // No navegador a sessão fica no localStorage (padrão); no celular, no AsyncStorage.
    ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// No celular, só renova o token com o app aberto.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const msg = String(e?.message || '');
  const code = String(e?.code || '');
  if (/network|fetch|Failed to fetch|timeout/i.test(msg)) return 'Sem conexão. Verifique a internet e tente de novo.';
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Sem acesso para salvar neste casal.';
  if (code === '23514' || code === '22P02') return 'Algum valor está inválido. Confira os campos.';
  if (code === '23503') return 'Esse registro não existe mais. Atualize a tela.';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme o e-mail antes de entrar (veja a caixa de entrada).';
  if (/User already registered/i.test(msg)) return 'Já existe uma conta com esse e-mail. Use “Entrar”.';
  if (/Password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  if (/mime type|Invalid key|Payload too large|exceeded the maximum/i.test(msg)) return 'Não foi possível enviar a foto. Use uma imagem JPG ou PNG menor.';
  return msg || 'Não foi possível salvar. Tente de novo.';
}
