import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActions, useData } from '@/data/DataProvider';

import { Icon } from './Icon';
import { AccentCtx, IconBtn, tap, Txt } from './kit';
import { ACCENT, C, F, R, type TabKey } from './theme';

// Moldura de cada tela: cor da aba, rolagem com "puxar para atualizar" e botão + flutuante.

export function Screen({ tab, children, onFab, fabLabel, inTabs = true }: {
  tab: TabKey; children: ReactNode; onFab?: () => void; fabLabel?: string; inTabs?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { reload } = useActions();
  const [refreshing, setRefreshing] = useState(false);
  const accent = ACCENT[tab];
  return (
    <AccentCtx.Provider value={accent}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView
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
          {children}
        </ScrollView>
        {onFab ? (
          <Pressable
            onPress={() => { tap(); onFab(); }}
            accessibilityRole="button"
            accessibilityLabel={fabLabel || 'Adicionar'}
            style={({ pressed }) => ({
              position: 'absolute', right: 16, bottom: 18 + (inTabs ? 0 : insets.bottom), width: 58, height: 58, borderRadius: R.pill,
              backgroundColor: accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }],
              shadowColor: accent, shadowOpacity: 0.45, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 6,
            })}>
            <Icon name="plus" size={26} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </AccentCtx.Provider>
  );
}

export function AppHeader() {
  const d = useData();
  const status = d.status === 'ok' && d.ready ? 'ok' : d.status === 'offline' ? 'offline' : 'loading';
  const dot = status === 'ok' ? C.ok : status === 'offline' ? C.mid : C.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt w="medium" size={11.5} color={C.coral} upper track={3.2} style={{ marginBottom: 4 }}>Planejamento a dois</Txt>
        <Text style={{ fontFamily: F.medium, fontSize: 31, lineHeight: 36, color: C.ink, letterSpacing: -1 }}>
          Casa -{' '}
          <Text style={{ fontFamily: F.serif, fontSize: 35, color: C.coral, letterSpacing: -0.3 }}>{d.nm('a')} e {d.nm('b')}</Text>{' '}
          <Text style={{ fontSize: 24 }}>❤️</Text>
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8, paddingTop: 2 }}>
        <IconBtn icon="sliders" label="Ajustes do casal" onPress={() => router.push('/ajustes')} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
          <Txt size={11.5} color={C.muted}>{status === 'ok' ? 'Sincronizado' : status === 'offline' ? 'Sem conexão' : 'Conectando…'}</Txt>
        </View>
      </View>
    </View>
  );
}

export function BackBar({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/casa'))}
        accessibilityRole="button"
        accessibilityLabel={`Voltar para ${label}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingLeft: 10, paddingRight: 14,
          borderRadius: R.pill, borderWidth: 1, borderColor: pressed ? C.muted : C.line, backgroundColor: C.surface,
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
