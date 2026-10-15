import { Redirect, Stack } from 'expo-router';

import { DataProvider } from '@/data/DataProvider';
import { useSession } from '@/data/session';
import { SheetsHost } from '@/features/SheetsHost';
import { Splash } from '@/ui/Splash';
import { C } from '@/ui/theme';

// Área logada: exige conta e um casal escolhido; carrega os dados do casal.
export default function AppLayout() {
  const { session, loading, membershipsLoaded, currentId } = useSession();
  if (loading || (session && !membershipsLoaded)) return <Splash />;
  if (!session) return <Redirect href="/login" />;
  if (!currentId) return <Redirect href="/casal" />;
  return (
    <DataProvider key={currentId} hid={currentId}>
      <SheetsHost>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
      </SheetsHost>
    </DataProvider>
  );
}
