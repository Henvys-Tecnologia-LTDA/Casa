import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { TAB_DEFAULTS, TAB_HINT, TAB_ICON_CHOICES, TAB_ORDER } from '@/lib/tabs';
import type { TabKey } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, ErrText, Field, Hint, Toggle, Txt } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT, C, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Editar uma aba: nome, ícone e se aparece na barra de baixo.
export function TabSheet({ tab, onClose }: { tab: TabKey; onClose: () => void }) {
  const d = useData();
  const { updateHousehold } = useActions();
  const toast = useToast();
  const cur = d.tabs[tab];
  const accent = ACCENT[tab];
  const [label, setLabel] = useState(cur.label);
  const [icon, setIcon] = useState(cur.icon);
  const [show, setShow] = useState(!cur.hidden);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const othersVisible = TAB_ORDER.filter(k => k !== tab && !d.tabs[k].hidden).length;

  async function save() {
    const l = label.trim();
    if (!l) { setErr('Dê um nome para a aba.'); return; }
    if (l.length > 16) { setErr('Use um nome curto (até 16 letras) para caber na barra.'); return; }
    if (!show && !othersVisible) { setErr('Deixe pelo menos uma aba aparecendo.'); return; }
    setBusy(true);
    try {
      const tabs = { ...(d.household?.tabs || {}), [tab]: { label: l, icon, hidden: !show } };
      await updateHousehold({ tabs });
      onClose();
      toast(show ? `Aba ${l} salva` : `Aba ${l} escondida`);
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  return (
    <AccentCtx.Provider value={accent}>
      <Sheet onClose={onClose} title="Editar aba" footer={<>
        <Btn label="Padrão" kind="ghost" size="sm" onPress={() => { setLabel(TAB_DEFAULTS[tab].label); setIcon(TAB_DEFAULTS[tab].icon); setShow(true); }} />
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: soft(accent), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={26} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="semibold" size={17}>{label.trim() || TAB_DEFAULTS[tab].label}</Txt>
            <Hint>{TAB_HINT[tab]}</Hint>
          </View>
        </View>
        <Field label="Nome da aba" value={label} onChangeText={setLabel} placeholder={TAB_DEFAULTS[tab].label} maxLength={16} />
        <View style={{ gap: 6 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Ícone</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TAB_ICON_CHOICES.map(k => {
              const on = k === icon;
              return (
                <Pressable key={k} onPress={() => setIcon(k)} accessibilityLabel={k} accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    width: 46, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: on ? accent : C.line,
                    backgroundColor: on ? soft(accent) : 'transparent', alignItems: 'center', justifyContent: 'center',
                    transform: [{ scale: pressed ? 0.92 : on ? 1.04 : 1 }],
                  })}>
                  <Icon name={k} size={22} color={on ? accent : C.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <Toggle label="Mostrar na barra de baixo" value={show} onChange={setShow} />
        {!show ? <Hint>Os dados desta aba continuam guardados; é só mostrar de novo para ver.</Hint> : null}
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
