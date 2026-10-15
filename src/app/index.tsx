import { Redirect } from 'expo-router';

import { useSession } from '@/data/session';
import { Splash } from '@/ui/Splash';

export default function Index() {
  const { session, loading, membershipsLoaded, currentId } = useSession();
  if (loading || (session && !membershipsLoaded)) return <Splash />;
  if (!session) return <Redirect href="/login" />;
  if (!currentId) return <Redirect href="/casal" />;
  return <Redirect href="/casa" />;
}
