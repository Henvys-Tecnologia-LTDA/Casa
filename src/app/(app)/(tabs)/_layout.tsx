import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/ui/Icon';
import { tap, Txt } from '@/ui/kit';
import { ACCENT, C, soft, type TabKey } from '@/ui/theme';

// As 6 abas da página, na barra de baixo como no celular.
const META: Record<TabKey, { label: string; icon: string }> = {
  casa: { label: 'Casa', icon: 'house' },
  switch: { label: 'Switch 2', icon: 'switch' },
  ape: { label: 'Apê', icon: 'building' },
  mudanca: { label: 'Mudança', icon: 'truck' },
  viagem: { label: 'Viagem', icon: 'suitcase' },
  dinheiro: { label: 'Dinheiro', icon: 'wallet' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,250,248,0.97)', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 8 + insets.bottom }}>
      {state.routes.map((r, i) => {
        const key = r.name as TabKey;
        const meta = META[key];
        if (!meta) return null;
        const on = state.index === i;
        const accent = ACCENT[key];
        return (
          <Pressable
            key={r.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
              if (!on && !ev.defaultPrevented) { tap(); navigation.navigate(r.name, r.params); }
            }}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4, minHeight: 54 }}>
            <View style={{ width: 44, height: 30, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? soft(accent) : 'transparent' }}>
              <Icon name={meta.icon} size={22} color={on ? accent : C.muted} />
            </View>
            <Txt w="semibold" size={11} color={on ? C.ink : C.muted} lines={1}>{meta.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={p => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="casa" />
      <Tabs.Screen name="switch" />
      <Tabs.Screen name="ape" />
      <Tabs.Screen name="mudanca" />
      <Tabs.Screen name="viagem" />
      <Tabs.Screen name="dinheiro" />
    </Tabs>
  );
}
