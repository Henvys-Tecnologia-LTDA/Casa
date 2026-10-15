import { Redirect } from 'expo-router';

import { useSession } from '@/data/session';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { Splash } from '@/ui/Splash';

export default function Login() {
  const { session, loading } = useSession();
  if (loading) return <Splash />;
  if (session) return <Redirect href="/" />;
  return <LoginScreen />;
}
