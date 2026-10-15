import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { Btn, IconBtn, Muted, Serif, Txt } from './kit';
import { C } from './theme';

// Janelas que sobem de baixo (bottom sheets), como os modais da página no celular.

export function Sheet({ visible, onClose, title, children, footer, media, live }: {
  visible: boolean; onClose: () => void; title?: string; children?: ReactNode; footer?: ReactNode; media?: ReactNode; live?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={s.wrap}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav} pointerEvents="box-none">
          <Animated.View entering={SlideInDown.duration(280)} style={[s.sheet, { maxHeight: '100%' }]}>
            {media}
            {title ? (
              <View style={s.head}>
                <Serif size={27} style={{ flex: 1 }}>{title}</Serif>
                <IconBtn icon="x" label="Fechar" onPress={onClose} />
              </View>
            ) : (
              <View style={s.floatX}><IconBtn icon="x" label="Fechar" onPress={onClose} /></View>
            )}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.body, !title && { paddingTop: 18 }]} style={{ flexShrink: 1 }}>
              {children}
            </ScrollView>
            {live}
            {footer ? (
              <View style={[s.foot, { paddingBottom: 14 + insets.bottom }]}>{footer}</View>
            ) : <View style={{ height: insets.bottom }} />}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export const Spacer = () => <View style={{ flex: 1 }} />;

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,12,18,0.55)' },
  kav: { maxHeight: '94%', width: '100%', maxWidth: 640, alignSelf: 'center' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  floatX: { position: 'absolute', top: 12, right: 12, zIndex: 2 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18, gap: 14 },
  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
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
  const done = (v: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setOpts(null);
    r?.(v);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal visible={!!opts} transparent animationType="fade" onRequestClose={() => done(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <Pressable style={s.backdrop} onPress={() => done(false)} />
          <Animated.View entering={FadeInDown.duration(220)} style={{ backgroundColor: C.surface, borderRadius: 6, padding: 22, gap: 10, alignItems: 'center', maxWidth: 420, width: '100%', alignSelf: 'center' }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={26} color={C.hi} />
            </View>
            <Txt w="medium" size={20} center>{opts?.title}</Txt>
            <Muted style={{ textAlign: 'center' }}>{opts?.text}</Muted>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' }}>
              <Btn label="Cancelar" kind="ghost" onPress={() => done(false)} grow />
              <Btn label={opts?.yes || 'Excluir'} kind="dangerSolid" onPress={() => done(true)} grow />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
