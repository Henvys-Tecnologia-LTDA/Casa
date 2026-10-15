import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/data/session';
import { CoupleScreen } from '@/features/auth/CoupleScreen';
import { Splash } from '@/ui/Splash';

export default function Casal() {
  const { session, loading } = useSession();
  const { outro } = useLocalSearchParams<{ outro?: string }>();
  if (loading) return <Splash />;
  if (!session) return <Redirect href="/login" />;
  return <CoupleScreen another={!!outro} />;
}
