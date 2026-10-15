import { ActivityIndicator, View } from 'react-native';

import { Serif } from './kit';
import { C } from './theme';

export function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <Serif size={34} color={C.coral}>Casa a Dois</Serif>
      <ActivityIndicator color={C.coral} />
    </View>
  );
}
