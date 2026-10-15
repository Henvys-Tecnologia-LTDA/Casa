import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { CAT, CATS, countdown, PACK_BASIC, tripCalc, TSTATUS_L } from '@/lib/calc';
import { dateBR, dayLabel, money, parsePrice, plural } from '@/lib/format';
import { Icon } from '@/ui/Icon';
import { Btn, CheckBox, Empty, Field, IconBtn, LikeBtn, Meter, Mini, Minis, Muted, Panel, Pill, Serif, Txt } from '@/ui/kit';
import { Photo } from '@/ui/Photo';
import { BackBar, Loading, Screen } from '@/ui/Screen';
import { ACCENT, C, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { Badge } from '../ape/ApeHome';
import { useSheets } from '../sheetsCtx';

export function TripScreen({ id }: { id: string }) {
  const d = useData();
  const { update, insert, remove, me } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const accent = ACCENT.viagem;
  const [dep, setDep] = useState('');
  const [pk, setPk] = useState('');
  const t = d.t.trips.find(x => x.id === id);

  if (!d.ready) return <Screen tab="viagem" inTabs={false}><BackBar label="Viagens" /><Loading /></Screen>;
  if (!t) {
    return (
      <Screen tab="viagem" inTabs={false}>
        <BackBar label="Viagens" />
        <Empty icon="suitcase" title="Esta viagem não existe mais" text="Ela pode ter sido excluída no outro celular." />
      </Screen>
    );
  }

  const c = tripCalc(t, d.costsOf(t.id), d.depsOf(t.id), d.packOf(t.id));
  const dates = t.start_date ? `${dayLabel(t.start_date, true)}${t.end_date ? ' a ' + dayLabel(t.end_date, true) : ''}` : 'sem data';
  const order = new Map(CATS.map(([k], n) => [k, n]));
  const costs = [...c.costs].sort((a, b) => (order.get(a.cat) ?? 99) - (order.get(b.cat) ?? 99) || (Number(b.amount) || 0) - (Number(a.amount) || 0));
  const packing = [...c.packing].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const pkDone = packing.filter(p => p.done).length;
  const deps = [...c.deps].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const liked = (t.likes || []).includes(me);

  const fail = (e: any) => toast(e?.message || 'Não foi possível salvar.', 'x');

  async function addDeposit(amount: number) {
    if (!amount || !t) return;
    try {
      await insert('trip_deposits', { trip_id: t.id, amount, by_user: me });
      const after = c.falta - amount;
      if (amount > 0 && c.total && after <= 0) toast('Viagem toda paga ou guardada!', 'heart');
      else toast(amount > 0 ? `${money(amount)} no cofrinho` : `${money(-amount)} retirados`, amount > 0 ? 'heart' : 'undo');
    } catch (e) { fail(e); }
  }
  function submitDeposit() {
    const raw = dep.trim(), neg = /^[-−]/.test(raw);
    const v = parsePrice(raw.replace(/^[-−]\s*/, ''));
    if (!v) { toast('Escreva um valor, como 300 ou 1.200,00.', 'x'); return; }
    setDep('');
    addDeposit(neg ? -v : v);
  }
  async function packAdd(texts: string[]) {
    if (!t) return;
    try { for (const text of texts) await insert('packing_items', { trip_id: t.id, text }); } catch (e) { fail(e); }
  }
  async function packToggle(pid: string, val: boolean) {
    try {
      await update('packing_items', pid, { done: val });
      if (val && packing.every(p => p.id === pid || p.done)) toast('Mala pronta!', 'heart');
    } catch (e) { fail(e); }
  }

  return (
    <Screen tab="viagem" inTabs={false} onFab={() => sheets.open({ kind: 'cost', tripId: t.id, cost: null })} fabLabel="Novo custo">
      <BackBar label="Viagens" />
      <View style={{ height: 220, borderRadius: R.card, overflow: 'hidden', backgroundColor: soft(accent) }}>
        <Photo path={t.image} icon="suitcase" iconSize={56} iconColor={accent} bg={soft(accent)} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Pill label={TSTATUS_L[t.status] || TSTATUS_L.planejando} kind={t.status} />
          <Badge icon="calendar" label={countdown(c, t.status)} />
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Serif size={34}>{t.name || 'Sem nome'}</Serif>
        <Muted>{[t.destination, dates, c.nights ? plural(c.nights, 'noite', 'noites') : '', plural(c.people, 'pessoa', 'pessoas')].filter(Boolean).join(' · ')}</Muted>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <LikeBtn on={liked} label={liked ? 'Curtido' : 'Curtir'} onPress={async () => {
          try { await update('trips', t.id, { likes: liked ? t.likes.filter(u => u !== me) : [...(t.likes || []), me] }); } catch (e) { fail(e); }
        }} />
        <Btn label="Editar viagem" kind="ghost" size="sm" icon="pencil" onPress={() => sheets.open({ kind: 'trip', trip: t })} />
      </View>
      <Minis>
        <Mini label="Custo total" value={money(c.total)} small={`${money(c.perPerson)} por pessoa`} />
        <Mini label="Já pago" value={money(c.paid)} kind="ok" />
        <Mini label="No cofrinho" value={money(c.saved)} kind="ok" />
        <Mini label="Falta juntar" value={money(c.falta)} kind="acc" small={c.months && c.falta > 0 ? `${money(c.perMonth)} por mês até lá` : undefined}>
          <Meter ratio={c.pct} height={4} style={{ marginTop: 4 }} />
        </Mini>
      </Minis>

      <Panel title="Custos" icon="wallet">
        {costs.length ? (
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
            {costs.map((x, k) => {
              const cat = CAT[x.cat] || CAT.outros, n = Number(x.parcelas) || 1;
              return (
                <Pressable key={x.id} onPress={() => sheets.open({ kind: 'cost', tripId: t.id, cost: x })}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, backgroundColor: pressed ? '#FBF0EC' : C.surface, borderTopWidth: k ? 1 : 0, borderTopColor: C.line })}>
                  <CheckBox checked={x.paid} label={`Pago: ${x.descr}`} onChange={async v => {
                    try { await update('trip_costs', x.id, { paid: v }); if (v) toast('Custo pago', 'check'); } catch (e) { fail(e); }
                  }} />
                  <View style={{ width: 36, height: 36, borderRadius: R.icon, backgroundColor: soft(accent), alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={cat.ic} size={18} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt w="semibold" color={x.paid ? C.muted : C.ink}>{x.descr || cat.t}</Txt>
                    <Muted size={12.5}>{`${cat.t}${n > 1 ? ` · ${n}× de ${money((Number(x.amount) || 0) / n)}` : ''}${x.paid ? ' · pago' : ''}`}</Muted>
                  </View>
                  <Txt w="medium" size={15} color={x.paid ? C.ok : C.ink}>{money(x.amount)}</Txt>
                </Pressable>
              );
            })}
          </View>
        ) : <Muted size={12.5}>Nenhum custo ainda. Comecem pelas passagens e pela hospedagem.</Muted>}
        {c.parcMes > 0 ? <Muted size={12.5}>{`Parcelas no cartão somam ${money(c.parcMes)} por mês.`}</Muted> : null}
        <View style={{ alignSelf: 'flex-start' }}><Btn label="Adicionar custo" kind="ghost" size="sm" icon="plus" onPress={() => sheets.open({ kind: 'cost', tripId: t.id, cost: null })} /></View>
      </Panel>

      <Panel title="Cofrinho da viagem" icon="heart">
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Txt w="medium" size={30} color={C.ok} style={{ letterSpacing: -0.6, lineHeight: 36 }}>{money(c.saved)}</Txt>
          <Muted>{c.total ? `de ${money(Math.max(0, c.total - c.paid))} que ainda falta pagar` : 'guardado'}</Muted>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <Field value={dep} onChangeText={setDep} placeholder="Quanto guardaram (R$)" keyboardType="numbers-and-punctuation" onSubmit={submitDeposit} style={{ flex: 1 }} />
          <Btn label="Guardar" onPress={submitDeposit} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[100, 250, 500].map(v => <Btn key={v} label={`+ ${money(v)}`} kind="ghost" size="xs" onPress={() => addDeposit(v)} />)}
        </View>
        <Muted size={12.5}>Para tirar dinheiro do cofrinho, use um valor negativo, como -200.</Muted>
        {deps.length ? (
          <View style={{ gap: 6 }}>
            {deps.slice(0, 6).map(x => (
              <View key={x.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <Muted size={13.5}>{`${dateBR(x.created_at)}${x.by_user ? ` · por ${d.memberName(x.by_user)}` : ''}`}</Muted>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt w="semibold" size={13.5} color={Number(x.amount) < 0 ? C.hi : C.ok}>{`${Number(x.amount) < 0 ? '−' : '+'} ${money(Math.abs(Number(x.amount) || 0))}`}</Txt>
                  <IconBtn icon="x" size={26} label="Apagar este valor" onPress={async () => { try { await remove('trip_deposits', x.id); } catch (e) { fail(e); } }} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </Panel>

      <Panel title="Mala" icon="suitcase" right={packing.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Muted size={13}>{`${pkDone} de ${packing.length}`}</Muted>
          <Meter ratio={pkDone / packing.length} style={{ width: 80 }} />
        </View>
      ) : undefined}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <Field value={pk} onChangeText={setPk} placeholder="O que levar…" style={{ flex: 1 }} onSubmit={() => { const v = pk.trim(); if (v) { setPk(''); packAdd([v]); } }} />
          <Btn label="Adicionar" kind="ghost" icon="plus" onPress={() => { const v = pk.trim(); if (v) { setPk(''); packAdd([v]); } }} />
        </View>
        {packing.length ? (
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
            {packing.map((p, k) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: k ? 1 : 0, borderTopColor: C.line, backgroundColor: C.surface }}>
                <CheckBox checked={p.done} onChange={v => packToggle(p.id, v)} label={`Na mala: ${p.text}`} />
                <Txt size={14.5} color={p.done ? C.muted : C.ink} style={[{ flex: 1 }, p.done ? { textDecorationLine: 'line-through' } : null]}>{p.text}</Txt>
                <IconBtn icon="x" size={30} label={`Tirar ${p.text} da lista`} onPress={async () => { try { await remove('packing_items', p.id); } catch (e) { fail(e); } }} />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignSelf: 'flex-start' }}><Btn label="Começar com uma lista básica" kind="ghost" size="sm" icon="suitcase" onPress={() => packAdd(PACK_BASIC)} /></View>
        )}
      </Panel>
      {t.notes ? <Panel title="Observações" icon="pencil"><Txt>{t.notes}</Txt></Panel> : null}
    </Screen>
  );
}
