import { Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { contasDoMes, situacao } from '@/lib/contas';
import { mLabel, money, ymOf } from '@/lib/format';
import type { Bill, BillPayment } from '@/lib/types';
import { Atalho } from '@/ui/Atalho';
import { CheckBox, IconBtn, Muted, Panel, Pill, Txt } from '@/ui/kit';
import { ACCENT, C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

import { useSheets } from '../sheetsCtx';

// Contas da casa no mês (aluguel, luz, internet): marcar como paga, com quem pagou (entra no acerto).
// Sem nenhuma conta, fica só uma linha para começar, para não ocupar a tela de quem não usa.

export function ContasPanel() {
  const d = useData();
  const sheets = useSheets();
  const ym = ymOf(undefined); // mês atual
  const { lista, total, pago } = contasDoMes(d.t.bills, d.t.bill_payments, ym);

  if (!d.t.bills.length) {
    return <Atalho icon="receipt" title="Contas da casa" sub="Aluguel, luz e internet, com lembrete e no acerto" color={ACCENT.dinheiro} onPress={() => sheets.open({ kind: 'bill', bill: null })} />;
  }
  return (
    <Panel title="Contas da casa" icon="receipt" right={<IconBtn icon="plus" size={30} label="Nova conta" onPress={() => sheets.open({ kind: 'bill', bill: null })} />}>
      <Muted size={12.5}>{`${mLabel(ym, true)} · ${money(pago)} de ${money(total)} pagos`}</Muted>
      {lista.length ? (
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
          {lista.map(({ b, pago: p }, i) => <Conta key={b.id} b={b} p={p} ym={ym} first={i === 0} />)}
        </View>
      ) : <Muted size={13}>Todas as contas estão pausadas.</Muted>}
    </Panel>
  );
}

function Conta({ b, p, ym, first }: { b: Bill; p: BillPayment | undefined; ym: string; first: boolean }) {
  const d = useData();
  const { insert, me } = useActions();
  const sheets = useSheets();
  const apagar = useApagar();
  const toast = useToast();
  const s = situacao(b, p, ym);

  async function marcar(v: boolean) {
    try {
      if (!v) { if (p) await apagar('bill_payments', p.id, `${b.name} desmarcada`); return; }
      // Com valor e quem paga de costume, marca direto; senão pergunta.
      if (Number(b.amount) > 0 && b.payer) {
        await insert('bill_payments', { bill_id: b.id, ym, amount: Number(b.amount), payer: b.payer, by_user: me });
        toast(`${b.name} paga`, 'check', { label: 'Ajustar', fn: () => sheets.open({ kind: 'billpay', billId: b.id, ym }) });
      } else sheets.open({ kind: 'billpay', billId: b.id, ym });
    } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); }
  }

  return (
    <Pressable onPress={() => sheets.open({ kind: 'bill', bill: b })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line, backgroundColor: pressed ? C.pressed : C.surface, opacity: b.active ? 1 : 0.6 })}>
      <CheckBox checked={!!p} onChange={marcar} label={`Paga: ${b.name}`} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="semibold" color={p ? C.muted : C.ink}>{b.name}</Txt>
        <Muted size={12.5}>{`dia ${b.due_day} · ${money(p ? p.amount : b.amount)}${p && d.whoLabel(p.payer) ? ` · pago: ${d.whoLabel(p.payer)}` : ''}`}</Muted>
      </View>
      {p ? (
        <Pressable onPress={() => sheets.open({ kind: 'billpay', billId: b.id, ym })} hitSlop={6}>
          <Pill label="Paga" kind="ok" icon="check" />
        </Pressable>
      ) : <Pill label={s.label} kind={s.cls} />}
    </Pressable>
  );
}
