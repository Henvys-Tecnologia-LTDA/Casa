import type { PushState } from './push';
import { supabase } from './supabase';

// Avisos no navegador (web push). No iPhone só funcionam com o site instalado na Tela de Início (iOS 16.4+).
// O service worker (public/sw.js) mostra o aviso e, no toque, abre o app na tela dele.

const SW = '/sw.js';
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

async function subscription() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON();
  const { error } = await supabase.rpc('register_push_device', { p_kind: 'web', p_endpoint: j.endpoint, p_keys: j.keys });
  if (error) throw error;
}

function keyBytes(b64url: string) {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return ios() && !installed() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await subscription()) ? 'on' : 'off';
}

// Liga os avisos neste navegador. Precisa ser chamado direto do toque num botão.
export async function enablePush(): Promise<PushState> {
  if (!supported()) return pushState();
  try {
    // A permissão vem antes de tudo: o Safari só pergunta se for logo em resposta ao toque.
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
    const reg = await navigator.serviceWorker.register(SW);
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { data, error } = await supabase.rpc('push_public_key');
      if (error || !data) throw error ?? new Error('Servidor sem chave de avisos.');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(String(data)) });
    }
    await save(sub);
    return 'on';
  } catch (e) {
    console.warn('avisos', e);
    return 'error';
  }
}

// Ao entrar na conta: registra o service worker e, se os avisos já estão liberados, recadastra a inscrição.
export async function refreshPush() {
  if (!supported()) return;
  try {
    await navigator.serviceWorker.register(SW);
    if (Notification.permission !== 'granted') return;
    const sub = await subscription();
    if (sub) await save(sub);
  } catch (e) {
    console.warn('avisos', e);
  }
}

// Ao sair da conta: este navegador para de receber os avisos dela.
export async function disablePush() {
  if (!supported()) return;
  const sub = await subscription();
  if (!sub) return;
  await supabase.rpc('unregister_push_device', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

// Toque num aviso: com o app aberto, o service worker manda uma mensagem; com ele fechado, abre o
// endereço do aviso com ?casal=<id>.
export function onPushOpen(cb: (url: string, household: string | null) => void) {
  const params = new URLSearchParams(window.location.search);
  const casal = params.get('casal');
  if (casal) {
    params.delete('casal');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    cb('', casal);
  }
  if (!('serviceWorker' in navigator)) return () => {};
  const onMessage = (e: MessageEvent) => {
    if (e.data?.type === 'abrir-aviso') cb(String(e.data.url || ''), e.data.household ? String(e.data.household) : null);
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
