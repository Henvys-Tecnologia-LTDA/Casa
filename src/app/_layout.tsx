import {
  CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import { Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from '@expo-google-fonts/jost';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/data/session';
import { ConfirmProvider } from '@/ui/Sheet';
import { Splash } from '@/ui/Splash';
import { C, ESCURO } from '@/ui/theme';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold,
    CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold_Italic,
  });
  const ready = loaded || !!error;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return <Splash label={false} />;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <SessionProvider>
          <ToastProvider>
            <ConfirmProvider>
              <StatusBar style={ESCURO ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }} />
            </ConfirmProvider>
          </ToastProvider>
        </SessionProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
