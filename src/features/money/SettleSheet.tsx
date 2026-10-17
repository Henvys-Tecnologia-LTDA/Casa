import { useState } from 'react';

import { useActions, useData } from '@/data/DataProvider';
import { fmtInput, parsePrice } from '@/lib/format';
import { MoneyField } from '@/ui/fields';
import { AccentCtx, Btn, ErrText, Field, Hint, Seg } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Registrar um acerto: quem passou quanto para o outro (Pix, dinheiro…). Vem preenchido com o
// que falta para ficarem quites.
export function SettleSheet({ payer: payer0, amount, onClose }: { payer: 'a' | 'b'; amount: number; onClose: () => void }) {
  const d = useData();
  const { insert, me } = useActions();
  const toast = useToast();
  const [payer, setPayer] = useState<'a' | 'b'>(payer0);
  const [value, setValue] = useState(amount > 0 ? fmtInput(amount) : '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const other = payer === 'a' ? 'b' : 'a';

  async function save() {
    const v = parsePrice(value);
    if (!v) { setErr('Quanto foi? Escreva algo como 150,00.'); return; }
    setBusy(true);
    try {
      await insert('settlements', { payer, amount: v, note: note.trim().slice(0, 200), by_user: me });
      onClose();
      toast('Acerto registrado', 'check');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.dinheiro}>
      <Sheet visible onClose={onClose} title="Registrar acerto" footer={<>
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Seg label="Quem passou o dinheiro" value={payer} onChange={setPayer} options={[['a', d.nm('a')], ['b', d.nm('b')]]} />
        <MoneyField label={`Quanto ${d.nm(payer)} passou para ${d.nm(other)} (R$)`} value={value} onChange={setValue} />
        <Field label="Observação (opcional)" value={note} onChangeText={setNote} placeholder="Ex.: Pix do sofá" />
        <Hint>O saldo do casal desconta este valor. Dá para apagar depois, se foi engano.</Hint>
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
