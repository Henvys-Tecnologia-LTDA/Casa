import {
  CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import { Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from '@expo-google-fonts/jost';
import { useFonts } from 'expo-font';
import { type Href, router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/data/session';
import { ConfirmProvider } from '@/ui/Sheet';
import { Splash } from '@/ui/Splash';
import { carregarTema, lembrarCaminho, PALETA, useTema } from '@/ui/theme';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});
carregarTema(); // no celular, a escolha de tema guardada (claro, escuro ou automático)

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold,
    CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold_Italic,
  });
  const tema = useTema();
  const path = usePathname();
  const ready = (loaded || !!error) && tema.pronto;
  const bg = tema.escuro ? PALETA.escuro.bg : PALETA.claro.bg;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  useEffect(() => { lembrarCaminho(path); }, [path]);
  useEffect(() => {
    if (Platform.OS !== 'web') SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [bg]);
  // Trocou o tema: tudo abaixo é desenhado de novo (key) e o app volta para a tela em que estava.
  useEffect(() => {
    if (!tema.versao || tema.volta === '/') return;
    const t = setTimeout(() => router.navigate(tema.volta as Href), 0);
    return () => clearTimeout(t);
  }, [tema.versao, tema.volta]);

  if (!ready) return <Splash label={false} />;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <SessionProvider>
          <ToastProvider key={tema.versao}>
            <ConfirmProvider>
              <StatusBar style={tema.escuro ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg }, animation: 'fade' }} />
            </ConfirmProvider>
          </ToastProvider>
        </SessionProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
