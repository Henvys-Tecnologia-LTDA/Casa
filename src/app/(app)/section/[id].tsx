import { useLocalSearchParams } from 'expo-router';

import { SectionScreen } from '@/features/shop/SectionScreen';

export default function SectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SectionScreen id={String(id)} />;
}
