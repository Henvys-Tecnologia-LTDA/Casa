import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { Txt } from './kit';
import { C } from './theme';

// Aviso curto na parte de baixo ("Comprado!", "Tarefa adicionada"...), com ação opcional.

type ToastFn = (msg: string, icon?: string, action?: { label: string; fn: () => void }) => void;
const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);

interface ToastState { id: number; msg: string; icon: string; action?: { label: string; fn: () => void } }

export function ToastProvider({ children, bottom = 92 }: { children: ReactNode; bottom?: number }) {
  const [t, setT] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const toast = useCallback<ToastFn>((msg, icon = 'check', action) => {
    if (timer.current) clearTimeout(timer.current);
    setT({ id: Date.now(), msg, icon, action });
    timer.current = setTimeout(() => setT(null), action ? 6000 : 2600);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      {t ? (
        <Animated.View
          key={t.id}
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(180)}
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: bottom + insets.bottom, alignItems: 'center', zIndex: 1200, elevation: 1200 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.ink, borderRadius: 999, paddingVertical: 10, paddingLeft: 16, paddingRight: t.action ? 8 : 18, maxWidth: 520 }}>
            <Icon name={t.icon} size={16} color={t.icon === 'heart' ? C.heart : C.bg} fill={t.icon === 'heart'} />
            <Txt w="semibold" size={14} color={C.bg} style={{ flexShrink: 1 }}>{t.msg}</Txt>
            {t.action ? (
              <Pressable
                onPress={() => { const a = t.action; setT(null); a?.fn(); }}
                style={{ backgroundColor: 'rgba(251,241,239,0.18)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Txt w="semibold" size={13} color={C.bg}>{t.action.label}</Txt>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}
