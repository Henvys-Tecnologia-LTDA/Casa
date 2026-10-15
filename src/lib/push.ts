import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Avisos no celular (expo-notifications): pede permissão, pega o token do Expo e cadastra o aparelho no banco
// (register_push_device). Quem junta e manda os avisos é a Edge Function notify. No navegador: push.web.ts.

export type PushState = 'on' | 'off' | 'denied' | 'unsupported' | 'install' | 'error';

const TOKEN = 'casa.push.token';
const ASKED = 'casa.push.asked';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function channel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('avisos', {
    name: 'Avisos do casal',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#E2504F',
  });
}

async function register(): Promise<PushState> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_device', { p_kind: 'expo', p_endpoint: token });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN, token);
  return 'on';
}

export async function pushState(): Promise<PushState> {
  const p = await Notifications.getPermissionsAsync();
  if (!p.granted) return p.canAskAgain ? 'off' : 'denied';
  return (await AsyncStorage.getItem(TOKEN)) ? 'on' : 'off';
}

// Liga os avisos neste aparelho, pedindo permissão se precisar.
export async function enablePush(): Promise<PushState> {
  try {
    await channel();
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return p.canAskAgain ? 'off' : 'denied';
    return await register();
  } catch (e) {
    console.warn('avisos', e);
    return 'error';
  }
}

// Ao entrar na conta: na primeira vez pergunta; depois só recadastra (o token pode mudar, e o aparelho pode
// ter trocado de conta).
export async function refreshPush() {
  try {
    if (!(await AsyncStorage.getItem(ASKED))) {
      await AsyncStorage.setItem(ASKED, '1');
      await enablePush();
      return;
    }
    if ((await Notifications.getPermissionsAsync()).granted) {
      await channel();
      await register();
    }
  } catch (e) {
    console.warn('avisos', e);
  }
}

// Ao sair da conta: este aparelho para de receber os avisos dela.
export async function disablePush() {
  const token = await AsyncStorage.getItem(TOKEN);
  if (!token) return;
  await supabase.rpc('unregister_push_device', { p_endpoint: token });
  await AsyncStorage.removeItem(TOKEN);
}

// Toque num aviso: devolve a tela (url) e o casal dele. O mesmo toque pode chegar pelos dois caminhos
// (app aberto pelo aviso e ouvinte), por isso guardamos o último tratado.
let lastOpened = '';
export function onPushOpen(cb: (url: string, household: string | null) => void) {
  const handle = (r: Notifications.NotificationResponse | null) => {
    const id = r?.notification.request.identifier;
    if (!r || !id || id === lastOpened) return;
    lastOpened = id;
    const data = r.notification.request.content.data as { url?: string; household?: string } | undefined;
    if (data?.url) cb(String(data.url), data.household ? String(data.household) : null);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
