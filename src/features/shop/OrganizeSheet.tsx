import { useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { TABS } from '@/lib/calc';
import type { ShopList } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, Hint, IconBtn, Txt } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT, C, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

const H = 58; // altura de cada linha

// Organizar os cômodos (ou seções) arrastando pela alça, como no Trello; as setas fazem o mesmo
// com um toque. A ordem vale para os dois.
export function OrganizeSheet({ list, onClose }: { list: ShopList; onClose: () => void }) {
  const d = useData();
  const { update } = useActions();
  const toast = useToast();
  const secs = d.secs(list);
  const [order, setOrder] = useState(() => secs.map(s => s.id));
  const [drag, setDrag] = useState<{ id: string; from: number; dy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const byId = new Map(secs.map(s => [s.id, s]));
  const ids = order.filter(id => byId.has(id));
  const accent = ACCENT[list];

  const move = (from: number, to: number) => setOrder(o => {
    const next = o.filter(id => byId.has(id));
    const [x] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, x);
    return next;
  });
  const target = drag ? Math.max(0, Math.min(ids.length - 1, Math.round((drag.from * H + drag.dy) / H))) : -1;

  // Posição de cada linha enquanto arrasta: a arrastada segue o dedo, as outras abrem espaço.
  const topOf = (k: number) => {
    if (!drag) return k * H;
    if (k === drag.from) return drag.from * H + drag.dy;
    if (drag.from < target && k > drag.from && k <= target) return (k - 1) * H;
    if (drag.from > target && k < drag.from && k >= target) return (k + 1) * H;
    return k * H;
  };

  async function save() {
    setBusy(true);
    try {
      for (const [k, id] of ids.entries()) if (byId.get(id)!.sort_order !== k) await update('sections', id, { sort_order: k });
      onClose();
      toast('Ordem salva', 'check');
    } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); } finally { setBusy(false); }
  }

  return (
    <AccentCtx.Provider value={accent}>
      <Sheet visible onClose={onClose} title={`Organizar ${TABS[list].units}`} footer={<>
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar ordem" onPress={save} busy={busy} />
      </>}>
        <Hint>Arraste pela alça (≡) ou use as setas. É a ordem em que aparecem para vocês dois.</Hint>
        <View style={{ height: ids.length * H, position: 'relative' }}>
          {ids.map((id, k) => (
            <Linha key={id} name={byId.get(id)!.name} icon={byId.get(id)!.icon || 'box'} top={topOf(k)} active={drag?.id === id} accent={accent}
              first={k === 0} last={k === ids.length - 1}
              onUp={() => move(k, k - 1)} onDown={() => move(k, k + 1)}
              onDragStart={() => setDrag({ id, from: k, dy: 0 })}
              onDrag={dy => setDrag(g => (g ? { ...g, dy } : g))}
              onDrop={() => { if (drag) move(drag.from, target); setDrag(null); }} />
          ))}
        </View>
      </Sheet>
    </AccentCtx.Provider>
  );
}

function Linha({ name, icon, top, active, accent, first, last, onUp, onDown, onDragStart, onDrag, onDrop }: {
  name: string; icon: string; top: number; active: boolean; accent: string; first: boolean; last: boolean;
  onUp: () => void; onDown: () => void; onDragStart: () => void; onDrag: (dy: number) => void; onDrop: () => void;
}) {
  // Arrastar pela alça com o sistema de toque do próprio React Native (celular e navegador):
  // guarda onde o dedo começou e manda o deslocamento a cada movimento.
  const [y0, setY0] = useState<number | null>(null);
  const soltar = () => { setY0(null); onDrop(); };
  const handlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => { setY0(e.nativeEvent.pageY); onDragStart(); },
    onResponderMove: (e: GestureResponderEvent) => { if (y0 != null) onDrag(e.nativeEvent.pageY - y0); },
    onResponderRelease: soltar,
    onResponderTerminate: soltar,
  };

  return (
    <View style={[{
      position: 'absolute', left: 0, right: 0, top, height: H - 6, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10,
      borderRadius: R.icon + 4, borderWidth: 1, borderColor: active ? accent : C.line, backgroundColor: active ? soft(accent) : C.surface,
      zIndex: active ? 2 : 1, elevation: active ? 6 : 0, shadowColor: C.shadow, shadowOpacity: active ? 0.15 : 0, shadowRadius: 10,
    }, NO_SELECT]}>
      <View {...handlers} accessibilityLabel={`Arrastar ${name}`} style={{ padding: 6, cursor: 'grab', touchAction: 'none' } as object}>
        <Icon name="grip" size={18} color={C.muted} />
      </View>
      <Icon name={icon} size={18} color={accent} />
      <Txt w="medium" size={15} style={{ flex: 1 }} lines={1}>{name}</Txt>
      <IconBtn icon="up" size={30} label={`Subir ${name}`} onPress={first ? undefined : onUp} style={{ opacity: first ? 0.35 : 1 }} />
      <IconBtn icon="down" size={30} label={`Descer ${name}`} onPress={last ? undefined : onDown} style={{ opacity: last ? 0.35 : 1 }} />
    </View>
  );
}

// No navegador, arrastar a linha não seleciona o texto.
const NO_SELECT = { userSelect: 'none' } as object;
