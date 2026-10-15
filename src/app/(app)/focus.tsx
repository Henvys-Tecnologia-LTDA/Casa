import { useLocalSearchParams } from 'expo-router';

import { FocusScreen } from '@/features/shop/SectionScreen';

export default function FocusRoute() {
  const { list, f } = useLocalSearchParams<{ list: string; f: string }>();
  return <FocusScreen list={list === 'switch' ? 'switch' : 'casa'} f={String(f || 'antes')} />;
}
