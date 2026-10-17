import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '@/data/DataProvider';
import type { TabKey } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { tap, Txt } from '@/ui/kit';
import { DUR, ease } from '@/ui/motion';
import { ACCENT, C, soft } from '@/ui/theme';

// Barra de abas de baixo: uma pílula na cor da aba desliza até a aba tocada e o ícone sobe um pouco.
// Abas escondidas nos ajustes do casal não aparecem.

function TabBar({ state, navigation }: BottomTabBarProps) {
  const d = useData();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter(r => d.tabs[r.name as TabKey] && !d.tabs[r.name as TabKey].hidden);
  const activeKey = state.routes[state.index]?.name as TabKey;
  const activeIdx = Math.max(0, routes.findIndex(r => r.name === activeKey));
  const [w, setW] = useState(0);
  const tabW = routes.length ? w / routes.length : 0;
  const accent = ACCENT[activeKey] || ACCENT.casa;

  const x = useSharedValue(0);
  const color = useSharedValue(soft(accent));
  const placed = useSharedValue(false);
  useEffect(() => {
    if (!tabW) return;
    if (!placed.get()) { x.set(activeIdx * tabW); placed.set(true); } else x.set(withTiming(activeIdx * tabW, ease(DUR.slow)));
  }, [activeIdx, tabW, x, placed]);
  useEffect(() => { color.set(withTiming(soft(accent), ease(DUR.slow))); }, [accent, color]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], backgroundColor: color.get() }));

  // Se a aba aberta foi escondida nos ajustes, vai para a primeira visível.
  const hiddenNow = !!d.tabs[activeKey]?.hidden;
  const first = routes[0]?.name;
  useEffect(() => {
    if (hiddenNow && first) navigation.navigate(first);
  }, [hiddenNow, first, navigation]);

  return (
    <View style={{
      backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 6 + insets.bottom,
      shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8,
    }}>
      <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}>
        {tabW > 0 ? (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 2, bottom: 2, left: 3, width: tabW - 6, borderRadius: 16 }, pill]} />
        ) : null}
        {routes.map(r => {
          const key = r.name as TabKey;
          const info = d.tabs[key];
          const on = key === activeKey;
          return (
            <TabButton key={r.key} on={on} label={info.label} icon={info.icon} accent={ACCENT[key]} onPress={() => {
              const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
              if (!on && !ev.defaultPrevented) { tap(); navigation.navigate(r.name, r.params); }
            }} />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({ on, label, icon, accent, onPress }: { on: boolean; label: string; icon: string; accent: string; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.set(withTiming(on ? 1 : 0, ease())); }, [on, p]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * p.get() }, { scale: 1 + 0.06 * p.get() }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 9, paddingBottom: 7, minHeight: 56 }}>
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={23} color={on ? accent : C.muted} strokeWidth={on ? 2 : 1.8} />
      </Animated.View>
      <Txt w={on ? 'semibold' : 'medium'} size={11} color={on ? C.ink : C.muted} lines={1}>{label}</Txt>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={p => <TabBar {...p} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg }, animation: 'shift' }}>
      <Tabs.Screen name="casa" />
      <Tabs.Screen name="switch" />
      <Tabs.Screen name="ape" />
      <Tabs.Screen name="mudanca" />
      <Tabs.Screen name="viagem" />
      <Tabs.Screen name="dinheiro" />
    </Tabs>
  );
}
