import { Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { acerto } from '@/lib/calc';
import { dateBR, money } from '@/lib/format';
import { Btn, Dot, DuoBar, Hint, IconBtn, Label, Muted, Panel, Txt } from '@/ui/kit';
import { useConfirm } from '@/ui/Sheet';
import { C, F } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

import { useSheets } from '../sheetsCtx';

// Acerto do casal (como o Splitwise): quanto cada um já pagou nas listas, quem passa quanto para o
// outro para ficarem quites e o histórico dos acertos.
export function AcertoPanel() {
  const d = useData();
  const apagar = useApagar();
  const sheets = useSheets();
  const confirm = useConfirm();
  const toast = useToast();
  const r = acerto(d.t.items, d.t.settlements, d.t.trip_costs, d.t.bill_payments);
  if (!(r.a + r.b + r.none > 0) && !d.t.settlements.length) return null;

  const quites = Math.abs(r.diff) < 0.5;
  const deve: 'a' | 'b' = r.diff > 0 ? 'b' : 'a';
  const recebe: 'a' | 'b' = deve === 'a' ? 'b' : 'a';
  const hist = [...d.t.settlements].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).slice(0, 5);
  const b = (s: string) => <Text style={{ fontFamily: F.semibold }}>{s}</Text>;

  async function apagarAcerto(id: string, txt: string) {
    const ok = await confirm({ title: 'Apagar este acerto?', text: `${txt}. O saldo volta a contar sem ele (dá para desfazer logo depois).`, yes: 'Apagar' });
    if (!ok) return;
    try { await apagar('settlements', id, 'Acerto apagado'); } catch (e: any) { toast(e?.message || 'Não foi possível apagar.', 'x'); }
  }

  return (
    <Panel title="Acerto do casal" icon="users">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['a', 'b'] as const).map(k => (
          <View key={k} style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Dot kind={k} />
              <Label>{d.nm(k)} pagou</Label>
            </View>
            <Txt w="medium" size={17}>{money(k === 'a' ? r.a : r.b)}</Txt>
            {(k === 'a' ? r.deA : r.deB) > 0 ? <Muted size={12.5}>e passou {money(k === 'a' ? r.deA : r.deB)} em acertos</Muted> : null}
          </View>
        ))}
      </View>
      <DuoBar a={r.a} b={r.b} />
      <Txt size={15}>
        {quites ? 'Vocês estão quites.' : <>{b(d.nm(deve))} passa {b(money(Math.abs(r.diff)))} para {b(d.nm(recebe))} e vocês ficam quites.</>}
      </Txt>
      <View style={{ alignSelf: 'flex-start' }}>
        <Btn label={quites ? 'Registrar um acerto' : 'Registrar acerto'} kind={quites ? 'ghost' : 'primary'} size="sm" icon="check"
          onPress={() => sheets.open({ kind: 'acerto', payer: deve, amount: quites ? 0 : Math.abs(r.diff) })} />
      </View>
      {hist.length ? (
        <View style={{ gap: 2 }}>
          <Label>Últimos acertos</Label>
          {hist.map(s => {
            const to = s.payer === 'a' ? 'b' : 'a';
            const txt = `${d.nm(s.payer)} passou ${money(s.amount)} para ${d.nm(to)}`;
            return (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt size={14}>{txt}</Txt>
                  <Muted size={12.5}>{dateBR(s.created_at)}{s.note ? ` · ${s.note}` : ''}</Muted>
                </View>
                <IconBtn icon="x" size={28} label="Apagar acerto" onPress={() => apagarAcerto(s.id, txt)} />
              </View>
            );
          })}
        </View>
      ) : null}
      {r.none > 0.5 ? <Hint>{`${money(r.none)} em compras, custos e contas sem “quem pagou” ficam fora da conta.`}</Hint> : null}
      <Hint>{`Conta as compras com “quem pagou” em ${d.tabLabel('casa')} e ${d.tabLabel('switch')}, os custos já pagos das viagens e as contas da casa pagas. O que é dos dois conta metade para cada um.`}</Hint>
    </Panel>
  );
}
