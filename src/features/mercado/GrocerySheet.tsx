import { useState } from 'react';
import { View } from 'react-native';

import { useActions } from '@/data/DataProvider';
import { SECOES_MERCADO } from '@/lib/mercado';
import type { Grocery, GroceryCat } from '@/lib/types';
import { AccentCtx, Btn, Chip, ErrText, Field, Grid2, Txt } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { C } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

// Editar um item do mercado: nome, quantidade e seção do mercado.
export function GrocerySheet({ g, onClose }: { g: Grocery; onClose: () => void }) {
  const { update } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const [text, setText] = useState(g.text);
  const [qty, setQty] = useState(g.qty);
  const [cat, setCat] = useState<GroceryCat>(g.cat);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const t = text.trim();
    if (!t) { setErr('Escreva o item.'); return; }
    setBusy(true);
    try {
      await update('groceries', g.id, { text: t, qty: qty.trim(), cat });
      onClose();
      toast('Item salvo', 'check');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  return (
    <AccentCtx.Provider value={C.ok}>
      <Sheet visible onClose={onClose} title="Item do mercado" footer={<>
        <Btn label="Tirar" kind="danger" icon="trash" onPress={async () => { try { await apagar('groceries', g.id, `${g.text} saiu da lista`); onClose(); } catch (e: any) { setErr(e?.message || ''); } }} />
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Grid2>
          <Field label="Item" value={text} onChangeText={setText} maxLength={120} />
          <Field label="Quantidade" value={qty} onChangeText={setQty} placeholder="Ex.: 2 kg" maxLength={30} />
        </Grid2>
        <View style={{ gap: 6 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Seção do mercado</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SECOES_MERCADO.map(([k, l]) => <Chip key={k} label={l} on={cat === k} onPress={() => setCat(k)} />)}
          </View>
        </View>
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
