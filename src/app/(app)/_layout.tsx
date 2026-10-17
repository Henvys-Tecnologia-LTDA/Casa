import { type Href, Redirect, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { DataProvider } from '@/data/DataProvider';
import { useSession } from '@/data/session';
import { ShareBridge } from '@/features/compartilhar/ShareBridge';
import { Marcos } from '@/features/marcos/Marcos';
import { SearchHost } from '@/features/search/SearchHost';
import { SheetsHost } from '@/features/SheetsHost';
import { onPushOpen, refreshPush } from '@/lib/push';
import { Splash } from '@/ui/Splash';
import { C } from '@/ui/theme';

// Área logada: exige conta e um casal escolhido; carrega os dados do casal.
export default function AppLayout() {
  const { session, loading, membershipsLoaded, currentId } = useSession();
  if (loading || (session && !membershipsLoaded)) return <Splash />;
  if (!session) return <Redirect href="/login" />;
  if (!currentId) return <Redirect href="/casal" />;
  return (
    <>
      <PushBridge />
      <DataProvider key={currentId} hid={currentId}>
        <SheetsHost>
          <SearchHost>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
          </SearchHost>
          <ShareBridge />
        </SheetsHost>
        <Marcos />
      </DataProvider>
    </>
  );
}

// Avisos: cadastra o aparelho ao entrar e, no toque num aviso, abre a tela dele no casal certo
// (troca de casal primeiro, se precisar; a navegação vai depois que os dados do casal montam).
function PushBridge() {
  const { session, memberships, currentId, setCurrentId } = useSession();
  const uid = session?.user.id;
  const [open, setOpen] = useState<{ url: string; household: string | null } | null>(null);

  useEffect(() => {
    if (uid) refreshPush();
  }, [uid]);

  useEffect(() => onPushOpen((url, household) => setOpen({ url, household })), []);

  useEffect(() => {
    if (!open) return;
    if (open.household && open.household !== currentId && memberships.some(m => m.household_id === open.household)) {
      setCurrentId(open.household);
      return;
    }
    const t = setTimeout(() => {
      setOpen(null);
      if (open.url) router.push(open.url as Href);
    }, 0);
    return () => clearTimeout(t);
  }, [open, currentId, memberships, setCurrentId]);

  return null;
}
