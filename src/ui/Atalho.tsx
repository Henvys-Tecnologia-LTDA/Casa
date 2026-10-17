import { Pressable, View } from 'react-native';

import { Icon } from './Icon';
import { Muted, Txt } from './kit';
import { C, R, soft } from './theme';

// Uma linha discreta que leva a uma tela fora das abas (Mercado, Caderno da casa), sem ocupar espaço
// de botão grande.
export function Atalho({ icon, title, sub, color, onPress }: { icon: string; title: string; sub: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}: ${sub}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12,
        borderWidth: 1, borderColor: C.line, borderRadius: R.card, backgroundColor: pressed ? C.pressed : C.surface,
      })}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: soft(color), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt w="semibold" size={15}>{title}</Txt>
        <Muted size={12.5} lines={1}>{sub}</Muted>
      </View>
      <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" size={14} color={C.muted} /></View>
    </Pressable>
  );
}
