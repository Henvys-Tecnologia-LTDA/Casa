import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { ICONS, optsOf, TABS } from '@/lib/calc';
import { fmtInput, parsePrice, plural } from '@/lib/format';
import type { Section, ShopList } from '@/lib/types';
import { MoneyField } from '@/ui/fields';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, ErrText, Field, Txt } from '@/ui/kit';
import { useApagar } from '@/ui/useApagar';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT, C, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Novo cômodo / seção, teto de gastos e ícone (secDlg da página).
export function SectionSheet({ list, sec, name: name0, onClose }: { list: ShopList; sec: Section | null; name?: string; onClose: () => void }) {
  const d = useData();
  const { insert, update } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const confirm = useConfirm();
  const L = sec?.list || list;
  const T = TABS[L];
  const accent = ACCENT[L];
  const [name, setName] = useState(sec?.name || name0 || '');
  const [budget, setBudget] = useState(Number(sec?.budget) ? fmtInput(sec?.budget) : '');
  const [icon, setIcon] = useState(ICONS.some(([k]) => k === sec?.icon) ? sec!.icon : T.defIcon);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const nm = name.trim();
    if (!nm) { setErr('Dê um nome.'); return; }
    const b = budget.trim() ? parsePrice(budget) : 0;
    if (b == null) { setErr('Teto inválido. Escreva algo como 8.000.'); return; }
    setBusy(true);
    try {
      if (sec) {
        await update('sections', sec.id, { name: nm, icon, budget: b });
        onClose();
        toast('Alterações salvas');
      } else {
        const order = Math.max(0, ...d.secs(L).map(s => Number(s.sort_order) || 0)) + 1;
        const row = await insert('sections', { list: L, name: nm, icon, sort_order: order, budget: b });
        onClose();
        router.push({ pathname: '/section/[id]', params: { id: row.id } });
        toast(`${nm} criado`, 'plus');
      }
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!sec) return;
    const its = d.itemsOf(sec.id);
    const ok = await confirm({
      title: `Excluir ${sec.name}?`,
      text: its.length ? `${plural(its.length, 'item', 'itens')} deste ${T.unit} também ${its.length === 1 ? 'será apagado' : 'serão apagados'}. Dá para desfazer logo depois.` : 'Dá para desfazer logo depois.',
      yes: `Excluir ${T.unit}`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      // Os itens saem junto (on delete cascade) e voltam juntos no desfazer.
      await apagar('sections', sec.id, `${sec.name} excluído`, its.flatMap(it => [it.image, ...optsOf(it).map(o => o.image)]));
      onClose();
      if (router.canGoBack()) router.back();
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível excluir.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccentCtx.Provider value={accent}>
      <Sheet visible onClose={onClose} title={sec ? `Editar ${T.unit}` : T.novo} footer={<>
        {sec ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Field label="Nome" value={name} onChangeText={setName} placeholder={L === 'casa' ? 'Ex.: Varanda' : 'Ex.: Colecionáveis'} autoFocus={!sec} />
        <MoneyField label={`Teto de gastos deste ${T.unit} (R$, opcional)`} value={budget} onChange={setBudget} placeholder="Ex.: 8.000" />
        <View style={{ gap: 6 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Ícone</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ICONS.map(([k, t]) => {
              const on = icon === k;
              return (
                <Pressable key={k} onPress={() => setIcon(k)} accessibilityLabel={t} accessibilityState={{ selected: on }}
                  style={{ width: '14.5%', aspectRatio: 1, minWidth: 44, borderRadius: R.icon + 4, borderWidth: 1.5, borderColor: on ? accent : C.line, backgroundColor: on ? soft(accent) : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={k} size={24} color={on ? accent : C.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
