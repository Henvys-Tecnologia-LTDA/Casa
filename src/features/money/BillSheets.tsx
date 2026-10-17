import { useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { CONTAS_COMUNS } from '@/lib/contas';
import { fmtInput, mLabel, parsePrice } from '@/lib/format';
import type { Bill, Who } from '@/lib/types';
import { IntField, MoneyField } from '@/ui/fields';
import { AccentCtx, Btn, Chip, ErrText, Field, Grid2, Hint, Seg, Toggle } from '@/ui/kit';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

// Conta fixa (nome, valor de costume, dia do vencimento, quem costuma pagar) e o pagamento de um mês.

export function BillSheet({ bill, name: name0, onClose }: { bill: Bill | null; name?: string; onClose: () => void }) {
  const d = useData();
  const { insert, update } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(bill?.name || name0 || '');
  const [amount, setAmount] = useState(Number(bill?.amount) ? fmtInput(bill?.amount) : '');
  const [day, setDay] = useState(String(bill?.due_day || 10));
  const [payer, setPayer] = useState<Who>(bill?.payer || '');
  const [active, setActive] = useState(bill ? bill.active : true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const nm = name.trim();
    if (!nm) { setErr('Dê um nome à conta.'); return; }
    const v = amount.trim() ? parsePrice(amount) : 0;
    if (v == null) { setErr('Valor inválido. Escreva algo como 180,00.'); return; }
    const dd = parseInt(day, 10);
    if (!(dd >= 1 && dd <= 31)) { setErr('O dia do vencimento vai de 1 a 31.'); return; }
    const data: Partial<Bill> = { name: nm, amount: v, due_day: dd, payer, active };
    setBusy(true);
    try {
      if (bill) await update('bills', bill.id, data); else await insert('bills', data);
      onClose();
      toast(bill ? 'Conta salva' : `${nm} nas contas da casa`, bill ? 'check' : 'receipt');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  async function del() {
    if (!bill) return;
    const ok = await confirm({
      title: `Excluir ${bill.name}?`,
      text: 'Os pagamentos anotados dela também saem (e do acerto). Para só parar de lembrar, desligue “Ativa”.',
      yes: 'Excluir conta',
    });
    if (!ok) return;
    try { await apagar('bills', bill.id, `${bill.name} excluída`); onClose(); } catch (e: any) { setErr(e?.message || ''); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.dinheiro}>
      <Sheet visible onClose={onClose} title={bill ? 'Editar conta' : 'Nova conta'} footer={<>
        {bill ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Field label="Conta" value={name} onChangeText={setName} placeholder="Ex.: Luz" autoFocus={!bill && !name0} maxLength={80} />
        {!bill && !name.trim() ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6 }}>
            {CONTAS_COMUNS.map(n => <Chip key={n} label={n} onPress={() => setName(n)} />)}
          </View>
        ) : null}
        <Grid2>
          <MoneyField label="Valor de costume (R$)" value={amount} onChange={setAmount} placeholder="Ex.: 180,00" />
          <IntField label="Vence todo dia" value={day} onChange={setDay} placeholder="10" />
        </Grid2>
        <Seg label="Quem costuma pagar" value={payer} onChange={setPayer} options={[['a', d.nm('a')], ['b', d.nm('b')], ['ambos', 'Os dois']]} />
        <Hint>Se o valor muda todo mês, anotem o certo ao marcar como paga. O app lembra 2 dias antes, no dia e no dia seguinte, se não estiver paga.</Hint>
        {bill ? <Toggle label="Ativa (desligue para pausar)" value={active} onChange={setActive} /> : null}
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}

export function BillPaySheet({ billId, ym, onClose }: { billId: string; ym: string; onClose: () => void }) {
  const d = useData();
  const { insert, update, me } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const b = d.t.bills.find(x => x.id === billId);
  const p = d.t.bill_payments.find(x => x.bill_id === billId && x.ym === ym);
  const [amount, setAmount] = useState(fmtInput(p ? p.amount : b?.amount));
  const [payer, setPayer] = useState<Who>(p?.payer || b?.payer || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!b) return null;

  async function save() {
    const v = parsePrice(amount);
    if (v == null) { setErr('Valor inválido. Escreva algo como 180,00.'); return; }
    setBusy(true);
    try {
      if (p) await update('bill_payments', p.id, { amount: v, payer });
      else await insert('bill_payments', { bill_id: billId, ym, amount: v, payer, by_user: me });
      onClose();
      toast(`${b!.name} paga`, 'check');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.dinheiro}>
      <Sheet visible onClose={onClose} title={`${b.name} · ${mLabel(ym, true)}`} footer={<>
        {p ? <Btn label="Desmarcar" kind="danger" icon="undo" onPress={async () => { try { await apagar('bill_payments', p.id, `${b.name} desmarcada`); onClose(); } catch (e: any) { setErr(e?.message || ''); } }} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label={p ? 'Salvar' : 'Marcar como paga'} onPress={save} busy={busy} />
      </>}>
        <MoneyField label="Quanto pagaram (R$)" value={amount} onChange={setAmount} autoFocus />
        <Seg label="Quem pagou" value={payer} onChange={setPayer} options={[['a', d.nm('a')], ['b', d.nm('b')], ['ambos', 'Os dois']]} />
        <Hint>Com “quem pagou”, entra no acerto do casal. Os dois: metade para cada um.</Hint>
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
