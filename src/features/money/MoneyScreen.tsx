import { Pressable, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { calendar, goalCalc, SRC } from '@/lib/calc';
import { dateBR, mLabel, money, mTick, pctTxt, plural, validYm } from '@/lib/format';
import type { Goal } from '@/lib/types';
import { Legend, StackedBars, type Series } from '@/ui/Chart';
import { Icon } from '@/ui/Icon';
import { Btn, Card, Dot, DuoBar, Empty, Meter, Muted, Note, Panel, Pill, Serif, Summary, Txt, ViewHead } from '@/ui/kit';
import { AppHeader, Appear, Loading, Screen } from '@/ui/Screen';
import { ACCENT, C, R, soft } from '@/ui/theme';

import { useSheets } from '../sheetsCtx';

const SRC_COLORS: Record<string, string> = { casa: C.s1, switch: C.s2, ape: C.s3, viagem: C.s4 };

export function MoneyScreen() {
  const d = useData();
  const sheets = useSheets();
  const cal = calendar({ items: d.t.items, sections: d.t.sections, trips: d.t.trips, costs: d.t.trip_costs, fav: d.fav });
  const cur = cal[0], next12 = cal.reduce((s, m) => s + m.total, 0);
  const peak = cal.reduce((p, m) => (m.total > p.total ? m : p), cal[0]);
  const goals = [...d.t.goals].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const gs = goals.map(g => goalCalc(g, d.goalDeps(g.id)));
  const saved = gs.reduce((s, g) => s + g.saved, 0), left = gs.reduce((s, g) => s + g.left, 0), per = gs.reduce((s, g) => s + g.per, 0);
  const any = cal.some(m => m.total > 0);
  const used = SRC.filter(([k]) => cal.some(m => m.src[k] > 0));
  const series: Series[] = used.map(([k, t]) => ({ key: k, label: k === 'ape' ? t : d.tabLabel(k), color: SRC_COLORS[k] }));
  const accent = ACCENT.dinheiro;

  return (
    <Screen tab="dinheiro" onFab={d.ready ? () => sheets.open({ kind: 'goal', goal: null }) : undefined} fabLabel="Nova meta">
      <AppHeader />
      <Summary cells={d.ready ? [
        { label: 'Parcelas este mês', value: money(cur.total), kind: 'acc', sub: d.renda && cur.total ? `${pctTxt((cur.total / d.renda) * 100)} da renda` : mLabel(cur.ym, true) },
        { label: 'Próximos 12 meses', value: money(next12), sub: peak.total ? `mês mais pesado: ${mLabel(peak.ym, true)}` : 'nada parcelado' },
        { label: 'Guardado nas metas', value: money(saved), kind: 'ok', sub: plural(goals.length, 'meta', 'metas') },
        { label: 'Falta para as metas', value: money(left), sub: per > 0 ? `${money(per)} por mês até os prazos` : goals.length ? 'Metas sem prazo ou alcançadas' : 'Criem a primeira meta' },
      ] : ['Parcelas este mês', 'Próximos 12 meses', 'Guardado nas metas', 'Falta para as metas'].map(l => ({ label: l, value: '—' }))} />
      {!d.ready ? <Loading /> : (
        <>
          <ViewHead title="Metas do casal" sub="Juntem dinheiro para a entrada do apê, a reserva ou o que vier." />
          {goals.length ? (
            <View style={{ gap: 12 }}>
              {goals.map((g, k) => <Appear key={g.id} i={k}><GoalCard g={g} /></Appear>)}
              <Pressable onPress={() => sheets.open({ kind: 'goal', goal: null })}
                style={({ pressed }) => ({ borderWidth: 1, borderStyle: 'dashed', borderColor: pressed ? C.ink : C.line, borderRadius: R.card, padding: 20, alignItems: 'center', gap: 8 })}>
                <Icon name="plus" color={C.muted} />
                <Txt w="semibold" color={C.muted}>Nova meta</Txt>
              </Pressable>
            </View>
          ) : (
            <Empty icon="wallet" title="Nenhuma meta ainda" text="Criem a primeira meta, como a entrada do apê, e anotem cada valor que guardarem. O app mostra quanto falta por mês."
              action={<Btn label="Criar meta" icon="plus" onPress={() => sheets.open({ kind: 'goal', goal: null })} />} />
          )}

          <ViewHead title="Calendário de parcelas" sub="Próximos 12 meses: compras parceladas, custos de viagem e o apê favorito." style={{ marginTop: 6 }} />
          {d.fav && !validYm(d.fav.inicio_mes) ? <Note>O apê favorito entra aqui quando vocês marcarem o mês do primeiro pagamento na simulação dele.</Note> : null}
          {!any ? (
            <Empty icon="calendar" title="Nada parcelado por enquanto" text="Ao anotar uma compra parcelada, um custo de viagem parcelado ou o mês de início do apê, as parcelas aparecem aqui mês a mês." />
          ) : (
            <>
              <Panel>
                <Legend series={series} />
                <StackedBars totalLabel="Total do mês" series={series} labelEvery={3}
                  bars={cal.map((m, k) => ({ label: mTick(m.ym, k === 0), title: mLabel(m.ym, true), parts: m.src }))} />
              </Panel>
              <Card>
                {cal.map((m, k) => {
                  const top = m.entries.slice(0, 5), more = m.entries.length - top.length;
                  return (
                    <View key={m.ym} style={{ padding: 12, gap: 8, borderTopWidth: k ? 1 : 0, borderTopColor: C.line, backgroundColor: k === 0 ? soft(accent) : C.surface }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <View>
                          <Serif size={21}>{`${mLabel(m.ym)} ${m.ym.slice(0, 4)}`}</Serif>
                          {k === 0 ? <Txt w="medium" size={10.5} color={accent} upper track={1.9}>este mês</Txt> : null}
                        </View>
                        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
                          <Txt w="medium" size={18}>{money(m.total)}</Txt>
                          {m.total ? <Muted size={12} style={{ textAlign: 'right' }}>{`${d.nm('a')} ${money(m.a)} · ${d.nm('b')} ${money(m.b)}${m.none > 0.5 ? ` · sem marcar ${money(m.none)}` : ''}`}</Muted> : null}
                        </View>
                      </View>
                      <View style={{ gap: 4 }}>
                        {top.map((e, i) => (
                          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SRC_COLORS[e.src] }} />
                              <Muted size={13.5} style={{ flexShrink: 1 }}>{e.label}</Muted>
                            </View>
                            <Txt size={13.5}>{money(e.amount)}</Txt>
                          </View>
                        ))}
                        {more > 0 ? <Muted size={13.5}>{`+ ${plural(more, 'outra parcela', 'outras parcelas')}`}</Muted> : null}
                        {!m.entries.length ? <Muted size={13.5}>Nada parcelado neste mês</Muted> : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
              <Muted size={12.5}>Apê e viagem entram divididos meio a meio. Nas compras, vale o “quem pagou” de cada item.</Muted>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function GoalCard({ g }: { g: Goal }) {
  const d = useData();
  const sheets = useSheets();
  const c = goalCalc(g, d.goalDeps(g.id));
  const deps = [...c.deps].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).slice(0, 3);
  const msg = c.target && c.left <= 0 ? null
    : c.target ? `Faltam ${money(c.left)}${c.months ? ` · ${money(c.per)} por mês até ${mLabel(c.dl, true)}` : ''}` : 'Definam quanto querem juntar.';
  return (
    <Panel>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <Serif size={26} style={{ flexShrink: 1 }}>{g.name || 'Meta'}</Serif>
        {c.dl ? <Pill label={`até ${mLabel(c.dl, true)}`} kind="acc" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <Txt w="medium" size={30} color={C.ok} style={{ letterSpacing: -0.6, lineHeight: 36 }}>{money(c.saved)}</Txt>
        <Muted>{c.target ? `de ${money(c.target)} · ${pctTxt(c.pct * 100)}` : 'guardado'}</Muted>
      </View>
      <Meter ratio={c.pct} />
      <Muted size={12.5}>
        {msg === null ? <Txt size={12.5} color={C.ok}>Meta alcançada!</Txt> : msg}
        {c.thisMonth ? ` · este mês: ${money(c.thisMonth)}` : ''}
      </Muted>
      {c.a + c.b > 0 ? (
        <>
          <DuoBar a={Math.max(0, c.a)} b={Math.max(0, c.b)} />
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot kind="a" /><Muted size={12.5}>{`${d.nm('a')} ${money(c.a)}`}</Muted></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot kind="b" /><Muted size={12.5}>{`${d.nm('b')} ${money(c.b)}`}</Muted></View>
          </View>
        </>
      ) : null}
      {deps.length ? (
        <View style={{ gap: 6 }}>
          {deps.map(x => (
            <View key={x.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Muted size={13.5}>{`${dateBR(x.created_at)} · ${d.whoLabel(x.who) || 'Os dois'}`}</Muted>
              <Txt w="semibold" size={13.5} color={Number(x.amount) < 0 ? C.hi : C.ok}>{`${Number(x.amount) < 0 ? '−' : '+'} ${money(Math.abs(Number(x.amount) || 0))}`}</Txt>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Guardar" size="sm" icon="plus" onPress={() => sheets.open({ kind: 'deposit', goalId: g.id })} />
        <Btn label="Editar" kind="ghost" size="sm" icon="pencil" onPress={() => sheets.open({ kind: 'goal', goal: g })} />
      </View>
    </Panel>
  );
}
