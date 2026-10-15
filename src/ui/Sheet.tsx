import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn, ZoomOut, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { Btn, IconBtn, Muted, Serif, Txt } from './kit';
import { C } from './theme';

// Janelas que sobem de baixo (bottom sheets). Ficam numa camada dentro do app (não em Modal nativo):
// assim a janela gruda na parte de baixo da tela e sobe junto com o teclado, e o campo
// em foco rola para cima do teclado.

function useBackToClose(onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { ref.current(); return true; });
    return () => sub.remove();
  }, []);
}

export function Sheet({ visible = true, onClose, title, children, footer, media, live }: {
  visible?: boolean; onClose: () => void; title?: string; children?: ReactNode; footer?: ReactNode; media?: ReactNode; live?: ReactNode;
}) {
  if (!visible) return null;
  return <SheetBody onClose={onClose} title={title} footer={footer} media={media} live={live}>{children}</SheetBody>;
}

function SheetBody({ onClose, title, children, footer, media, live }: {
  onClose: () => void; title?: string; children?: ReactNode; footer?: ReactNode; media?: ReactNode; live?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height, progress } = useReanimatedKeyboardAnimation();
  useBackToClose(onClose);
  // A janela sobe exatamente a altura do teclado; a barra de navegação some debaixo dele.
  const lift = useAnimatedStyle(() => ({ paddingBottom: Math.abs(height.get()) }));
  const foot = useAnimatedStyle(() => ({ paddingBottom: 14 + insets.bottom * (1 - progress.get()) }));
  const footH = footer ? 74 : 0;
  return (
    <View style={[StyleSheet.absoluteFill, s.layer]} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, s.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
      </Animated.View>
      <Animated.View style={[s.wrap, { top: insets.top + 10 }, lift]} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(190).mass(0.9)} exiting={SlideOutDown.duration(200)} style={s.sheet}>
          <View style={s.grab} />
          {media}
          {title ? (
            <View style={s.head}>
              <Serif size={27} style={{ flex: 1 }}>{title}</Serif>
              <IconBtn icon="x" label="Fechar" onPress={onClose} />
            </View>
          ) : (
            <View style={s.floatX}><IconBtn icon="x" label="Fechar" onPress={onClose} /></View>
          )}
          <KeyboardAwareScrollView
            bottomOffset={footH + (live ? 44 : 0) + 18}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.body, !title && { paddingTop: 18 }]}
            style={{ flexShrink: 1 }}>
            {children}
          </KeyboardAwareScrollView>
          {live}
          {footer ? (
            <Animated.View style={[s.foot, foot]}>{footer}</Animated.View>
          ) : <Animated.View style={foot} />}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export const Spacer = () => <View style={{ flex: 1 }} />;

const s = StyleSheet.create({
  // Acima das telas empilhadas (Ajustes, cômodo, apê...) no Android e no navegador.
  layer: { zIndex: 1000, elevation: 1000 },
  backdrop: { backgroundColor: 'rgba(20,14,12,0.5)' },
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', maxHeight: '100%',
    width: '100%', maxWidth: 640, alignSelf: 'center',
    shadowColor: '#2A2320', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 16,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  floatX: { position: 'absolute', top: 16, right: 12, zIndex: 2 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18, gap: 14 },
  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface },
});

/* ---------- confirmação (excluir) ---------- */

interface ConfirmOpts { title: string; text: string; yes: string }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(res => {
    resolver.current = res;
    setOpts(o);
  }), []);
  const done = useCallback((v: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setOpts(null);
    r?.(v);
  }, []);
  return (
    <ConfirmCtx.Provider value={confirm}>
      <View style={{ flex: 1 }}>
        {children}
        {opts ? <ConfirmBox opts={opts} done={done} /> : null}
      </View>
    </ConfirmCtx.Provider>
  );
}

function ConfirmBox({ opts, done }: { opts: ConfirmOpts; done: (v: boolean) => void }) {
  useBackToClose(() => done(false));
  return (
    <View style={[StyleSheet.absoluteFill, s.layer, { zIndex: 1100, elevation: 1100, justifyContent: 'center', padding: 24 }]}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, s.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => done(false)} />
      </Animated.View>
      <Animated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(140)}
        style={{ backgroundColor: C.surface, borderRadius: 8, padding: 22, gap: 10, alignItems: 'center', maxWidth: 420, width: '100%', alignSelf: 'center', elevation: 20 }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="trash" size={26} color={C.hi} />
        </View>
        <Txt w="medium" size={20} center>{opts.title}</Txt>
        <Muted style={{ textAlign: 'center' }}>{opts.text}</Muted>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' }}>
          <Btn label="Cancelar" kind="ghost" onPress={() => done(false)} grow />
          <Btn label={opts.yes || 'Excluir'} kind="dangerSolid" onPress={() => done(true)} grow />
        </View>
      </Animated.View>
    </View>
  );
}
