import { router } from 'expo-router';
import { Children, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActions, useData } from '@/data/DataProvider';

import { Icon } from './Icon';
import { AccentCtx, IconBtn, tap, Txt } from './kit';
import { fabIn, sectionIn } from './motion';
import { Photo } from './Photo';
import { ACCENT, C, F, R, soft, type TabKey } from './theme';

// Moldura de cada tela: cor da aba, rolagem que sobe o campo em foco acima do teclado,
// "puxar para atualizar", entrada animada das seções e botão + flutuante.

export function Appear({ i = 0, children, style }: { i?: number; children?: ReactNode; style?: object }) {
  return (
    <Animated.View entering={sectionIn(i)} style={style}>
      {children}
    </Animated.View>
  );
}

export function Screen({ tab, children, onFab, fabLabel, inTabs = true }: {
  tab: TabKey; children: ReactNode; onFab?: () => void; fabLabel?: string; inTabs?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { reload } = useActions();
  const [refreshing, setRefreshing] = useState(false);
  const accent = ACCENT[tab];
  const kids = Children.toArray(children);
  return (
    <AccentCtx.Provider value={accent}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <KeyboardAwareScrollView
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: (inTabs ? 110 : 110 + insets.bottom),
            gap: 18, width: '100%', maxWidth: 1080, alignSelf: 'center',
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={accent}
              colors={[accent]}
              onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }}
            />
          }>
          {kids.map((c, k) => <Appear key={(c as { key?: string }).key ?? k} i={k} style={{ gap: 18 }}>{c}</Appear>)}
        </KeyboardAwareScrollView>
        {onFab ? <Fab accent={accent} label={fabLabel} onPress={onFab} bottom={18 + (inTabs ? 0 : insets.bottom)} /> : null}
      </View>
    </AccentCtx.Provider>
  );
}

function Fab({ accent, label, onPress, bottom }: { accent: string; label?: string; onPress: () => void; bottom: number }) {
  return (
    <Animated.View entering={fabIn} style={{ position: 'absolute', right: 16, bottom }}>
      <Pressable
        onPress={() => { tap(); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={label || 'Adicionar'}
        style={({ pressed }) => ({
          width: 58, height: 58, borderRadius: R.pill, backgroundColor: accent, alignItems: 'center', justifyContent: 'center',
          transform: [{ scale: pressed ? 0.94 : 1 }],
          shadowColor: accent, shadowOpacity: 0.45, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 6,
        })}>
        <Icon name="plus" size={26} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>
    </Animated.View>
  );
}

export function CoupleAvatar({ size = 48, onPress }: { size?: number; onPress?: () => void }) {
  const d = useData();
  const initials = `${d.nm('a').slice(0, 1)}${d.nm('b').slice(0, 1)}`.toUpperCase();
  const body = d.household?.photo ? (
    <Photo path={d.household.photo} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: soft(C.coral), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.serif, fontSize: size * 0.42, color: C.coral }}>{initials}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityLabel="Foto do casal" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }], borderRadius: size / 2, borderWidth: 2, borderColor: C.surface })}>
      {body}
    </Pressable>
  );
}

export function AppHeader() {
  const d = useData();
  const status = d.status === 'ok' && d.ready ? 'ok' : d.status === 'offline' ? 'offline' : 'loading';
  const dot = status === 'ok' ? C.ok : status === 'offline' ? C.mid : C.muted;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CoupleAvatar size={46} onPress={() => router.push('/ajustes')} />
        <View style={{ flex: 1 }}>
          <Txt w="medium" size={11} color={C.coral} upper track={3} lines={1}>Planejamento a dois</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
            <Txt size={11.5} color={C.muted}>{status === 'ok' ? 'Sincronizado' : status === 'offline' ? 'Sem conexão' : 'Conectando…'}</Txt>
          </View>
        </View>
        <IconBtn icon="sliders" label="Ajustes do casal" onPress={() => router.push('/ajustes')} />
      </View>
      <Text style={{ fontFamily: F.medium, fontSize: 31, lineHeight: 36, color: C.ink, letterSpacing: -1 }}>
        Casa -{' '}
        <Text style={{ fontFamily: F.serif, fontSize: 35, color: C.coral, letterSpacing: -0.3 }}>{d.nm('a')} e {d.nm('b')}</Text>{' '}
        <Text style={{ fontSize: 24 }}>❤️</Text>
      </Text>
    </View>
  );
}

export function BackBar({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel={`Voltar para ${label}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingLeft: 10, paddingRight: 14,
          borderRadius: R.pill, borderWidth: 1, borderColor: pressed ? C.muted : C.line, backgroundColor: C.surface,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}>
        <Icon name="back" size={16} />
        <Txt w="medium" size={14}>{label}</Txt>
      </Pressable>
      {right}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ gap: 12 }}>
      <Txt w="medium" size={22}>Carregando a lista de vocês…</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[0, 1, 2, 3].map(k => <View key={k} style={{ width: '48%', height: 130, borderRadius: R.card, backgroundColor: C.sunken }} />)}
      </View>
    </View>
  );
}
