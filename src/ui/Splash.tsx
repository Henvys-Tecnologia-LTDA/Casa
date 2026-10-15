import { ActivityIndicator, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Serif } from './kit';
import { C } from './theme';

// Mesmo desenho de assets/brand/marca.svg (casa em tinta, coração coral no lugar da porta).
function Marca({ size }: { size: number }) {
  const common = { fill: 'none', strokeWidth: 1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2.5 11 12 3.6l9.5 7.4" stroke={C.ink} {...common} />
      <Path d="M5 9.4V20h14V9.4" stroke={C.ink} {...common} />
      <Path
        d="M12 17.6c-2.4-1.5-3.3-2.8-3.3-4 0-1.05.78-1.85 1.75-1.85.7 0 1.25.38 1.55.95.3-.57.85-.95 1.55-.95.97 0 1.75.8 1.75 1.85 0 1.2-.9 2.5-3.3 4z"
        stroke={C.coral} {...common}
      />
    </Svg>
  );
}

// A casinha fica no centro exato e com 120 px, como a splash nativa (imageWidth no app.json) e a
// do public/index.html, para a troca entre elas não dar pulo. `label` some antes das fontes carregarem.
export function Splash({ label = true }: { label?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Marca size={120} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', marginTop: 76, alignItems: 'center', gap: 14 }}>
        {label && <Serif size={34} color={C.coral}>Casa a Dois</Serif>}
        <ActivityIndicator color={C.coral} />
      </View>
    </View>
  );
}
