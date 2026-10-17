import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useActions, useData } from '@/data/DataProvider';
import { marcos, novos, type Marco } from '@/lib/marcos';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, Muted, Serif, tap } from '@/ui/kit';
import { backdropIn, backdropOut, dialogIn, dialogOut } from '@/ui/motion';
import { ACCENT, C, soft } from '@/ui/theme';

// Comemora os marcos do casal (src/lib/marcos.ts) uma vez em cada aparelho: na primeira vez só
// anota o que já estava feito; depois, cada marco novo, feito por qualquer um dos dois, ganha confete.

export function Marcos() {
  const d = useData();
  const { hid } = useActions();
  const storeKey = `casa.marcos.${hid}`;
  // undefined: ainda lendo; null: primeira vez neste aparelho.
  const [visto, setVisto] = useState<string[] | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(storeKey)
      .then(v => { if (alive) setVisto(v ? JSON.parse(v) : null); })
      .catch(() => { if (alive) setVisto(null); });
    return () => { alive = false; };
  }, [storeKey]);

  const atual = useMemo(
    () => (d.ready ? marcos(d.t, { tabLabel: d.tabLabel, hidden: k => d.tabs[k].hidden }) : null),
    [d],
  );

  // Primeira vez: guarda o que já existe, sem festa.
  useEffect(() => {
    if (!atual || visto !== null) return;
    const keys = atual.map(m => m.key);
    AsyncStorage.setItem(storeKey, JSON.stringify(keys)).catch(() => {}).finally(() => setVisto(keys));
  }, [atual, visto, storeKey]);

  const pendente = atual && visto ? novos(atual, visto) : [];
  const m = pendente[0];
  if (!m || !atual || !visto) return null;

  const fechar = () => {
    // Guarda este como visto e esquece os que deixaram de valer (para poderem comemorar de novo).
    const ainda = new Set(atual.map(x => x.key));
    const next = [...new Set([...visto.filter(k => ainda.has(k)), m.key])];
    setVisto(next);
    AsyncStorage.setItem(storeKey, JSON.stringify(next)).catch(() => {});
  };
  return <Festa key={m.key} m={m} onClose={fechar} />;
}

function Festa({ m, onClose }: { m: Marco; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const accent = ACCENT[m.tab];
  useEffect(() => {
    tap('success');
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <AccentCtx.Provider value={accent}>
      <View style={[StyleSheet.absoluteFill, s.layer]}>
        <Animated.View entering={backdropIn} exiting={backdropOut} style={[StyleSheet.absoluteFill, s.backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar comemoração" />
        </Animated.View>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 36 }, (_, i) => <Confete key={i} i={i} w={width} h={height} />)}
        </View>
        <View style={s.center} pointerEvents="box-none">
          <Animated.View entering={dialogIn} exiting={dialogOut} style={s.card} accessibilityRole="alert">
            <View style={[s.badge, { backgroundColor: soft(accent) }]}>
              <Icon name={m.icon} size={30} color={accent} />
            </View>
            <Serif size={28} center>{m.title}</Serif>
            <Muted style={{ textAlign: 'center' }}>{m.text}</Muted>
            <Btn label="Oba!" icon="heart" onPress={onClose} style={{ marginTop: 6, alignSelf: 'stretch' }} />
          </Animated.View>
        </View>
      </View>
    </AccentCtx.Provider>
  );
}

const CORES = [C.coral, ACCENT.casa, ACCENT.switch, ACCENT.ape, ACCENT.viagem, C.mid, C.ok];
// "Aleatório" fixo por peça (sem Math.random no render).
const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

function Confete({ i, w, h }: { i: number; w: number; h: number }) {
  const y = useSharedValue(-30);
  const x0 = rnd(i + 1) * w, drift = (rnd(i + 7) - 0.5) * 120, spin = 360 + rnd(i + 3) * 540;
  const dur = 1800 + rnd(i + 11) * 1600, delay = rnd(i + 5) * 600;
  useEffect(() => {
    y.set(withDelay(delay, withTiming(h + 30, { duration: dur, easing: Easing.linear })));
  }, [y, h, dur, delay]);
  const st = useAnimatedStyle(() => {
    const p = (y.get() + 30) / (h + 60);
    return { transform: [{ translateX: x0 + drift * p }, { translateY: y.get() }, { rotate: `${spin * p}deg` }] };
  });
  return <Animated.View style={[s.piece, { backgroundColor: CORES[i % CORES.length], width: i % 3 ? 8 : 6, height: i % 3 ? 12 : 6, borderRadius: i % 3 ? 2 : 3 }, st]} />;
}

const s = StyleSheet.create({
  layer: { zIndex: 1300, elevation: 1300 },
  backdrop: { backgroundColor: C.backdrop },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: C.surface, borderRadius: 12, padding: 24, gap: 10, alignItems: 'center',
    shadowColor: C.shadow, shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 24,
  },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  piece: { position: 'absolute', left: 0, top: 0 },
});
