import { useLocalSearchParams } from 'expo-router';

import { AptScreen } from '@/features/ape/AptScreen';

export default function AptRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AptScreen id={String(id)} />;
}
