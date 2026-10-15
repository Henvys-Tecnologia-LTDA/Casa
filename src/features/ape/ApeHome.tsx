import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { aptsSorted, simulate, STATUS_L } from '@/lib/calc';
import { fmtNum, money, pctTxt } from '@/lib/format';
import type { Apartment } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Btn, Empty, Label, Muted, Note, Pill, Summary, Txt, useAccent, ViewHead } from '@/ui/kit';
import { Photo } from '@/ui/Photo';
import { AppHeader, Appear, Loading, Screen } from '@/ui/Screen';
import { C, F, R, soft } from '@/ui/theme';

import { useSheets } from '../sheetsCtx';

export function ApeHome() {
  const d = useData();
  const sheets = useSheets();
  const list = aptsSorted(d.t.apartments);
  const active = list.filter(a => a.status !== 'descartado');
  return (
    <Screen tab="ape" onFab={d.ready ? () => sheets.open({ kind: 'apt', apt: null }) : undefined} fabLabel="Novo apartamento">
      <AppHeader />
      <ApeSummary />
      {!d.ready ? <Loading /> : (
        <>
          <ViewHead title="Apartamentos" sub="Comparem as opções e simulem entrada e financiamento." />
          {!d.renda ? (
            <Note>
              <View style={{ gap: 8 }}>
                <Txt size={13.5} color={C.muted}>Informe a renda do casal nos ajustes para ver quanto a parcela compromete.</Txt>
                <View style={{ alignSelf: 'flex-start' }}><Btn label="Ajustes" kind="ghost" size="xs" onPress={() => router.push('/ajustes')} /></View>
              </View>
            </Note>
          ) : null}
          {!list.length ? (
            <Empty icon="building" title="Nenhum apartamento ainda" text="Adicionem o primeiro apê que estão olhando: preço, entrada, juros e prazo. A simulação sai na hora."
              action={<Btn label="Adicionar apartamento" icon="plus" onPress={() => sheets.open({ kind: 'apt', apt: null })} />} />
          ) : (
            <View style={{ gap: 12 }}>
              {list.map((a, k) => <Appear key={a.id} i={k}><AptCard a={a} /></Appear>)}
              <Pressable onPress={() => sheets.open({ kind: 'apt', apt: null })}
                style={({ pressed }) => ({ borderWidth: 1, borderStyle: 'dashed', borderColor: pressed ? C.ink : C.line, borderRadius: R.card, padding: 20, alignItems: 'center', gap: 8 })}>
                <Icon name="plus" color={C.muted} />
                <Txt w="semibold" color={C.muted}>Novo apartamento</Txt>
              </Pressable>
            </View>
          )}
          {active.length >= 2 ? (
            <>
              <ViewHead title="Comparação" sub="O menor valor de cada linha fica em verde." style={{ marginTop: 6 }} />
              <CompareTable list={active} />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function ApeSummary() {
  const d = useData();
  const f = d.fav;
  if (!d.ready || !f) {
    return <Summary cells={['Apê favorito', '1ª parcela', 'Por mês com condomínio', 'Precisa ter na mão'].map(l => ({ label: l, value: '—', sub: l === 'Apê favorito' && d.ready ? 'Adicione um apartamento' : undefined }))} />;
  }
  const s = simulate(f), rd = d.renda;
  return (
    <Summary cells={[
      { label: 'Apê favorito', value: f.name || 'Sem nome', kind: 'txt', sub: money(s.price) },
      { label: '1ª parcela', value: money(s.firstFin), kind: 'acc', sub: `${s.sistema} · ${s.n} meses` },
      {
        label: 'Por mês com condomínio', value: money(s.monthlyKeys),
        sub: rd ? <Txt size={12.5} color={s.firstFin / rd > 0.3 ? C.hi : C.ok}>{`${pctTxt((s.firstFin / rd) * 100)} da renda na parcela`}</Txt> : 'informe a renda nos ajustes',
      },
      { label: 'Precisa ter na mão', value: money(s.cash), sub: s.parcelada ? 'ITBI e cartório' : 'entrada + ITBI e cartório' },
    ]} />
  );
}

function AptCard({ a }: { a: Apartment }) {
  const accent = useAccent();
  const d = useData();
  const s = simulate(a);
  const nums: [string, string][] = [
    ['Preço', money(s.price)], ['1ª parcela', money(s.firstFin)],
    ['Por mês c/ condomínio', money(s.monthlyKeys)], [s.parcelada ? 'Entrada por mês' : 'Na mão', money(s.parcelada ? s.entradaMes : s.cash)],
  ];
  const foot = [a.area ? `${fmtNum(a.area)} m²` : '', a.rooms ? `${a.rooms} quartos` : '', a.parking ? `${a.parking} ${Number(a.parking) === 1 ? 'vaga' : 'vagas'}` : ''].filter(Boolean).join(' · ');
  const likers = (a.likes || []).map(u => d.memberName(u)).filter(Boolean);
  return (
    <Pressable onPress={() => router.push({ pathname: '/apt/[id]', params: { id: a.id } })}
      style={({ pressed }) => ({ borderWidth: 1, borderColor: pressed ? C.ink : C.line, borderRadius: R.card, backgroundColor: C.surface, overflow: 'hidden', opacity: a.status === 'descartado' ? 0.62 : 1 })}>
      <View style={{ height: 150, backgroundColor: soft(accent) }}>
        <Photo path={a.image} icon="building" iconSize={42} iconColor={accent} bg={soft(accent)} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pill label={STATUS_L[a.status] || STATUS_L.visitar} kind={a.status} />
          {a.favorite ? <Badge icon="star" label="Favorito" color={C.mid} /> : null}
        </View>
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <Txt w="medium" size={18}>{a.name || 'Sem nome'}</Txt>
        {a.address ? <Muted size={13}>{a.address}</Muted> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 10 }}>
          {nums.map(([l, v]) => (
            <View key={l} style={{ width: '50%', gap: 1 }}>
              <Label>{l}</Label>
              <Txt w="medium" size={15}>{v}</Txt>
            </View>
          ))}
        </View>
        {foot || likers.length ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
            <Muted size={13}>{foot}</Muted>
            {likers.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="heart" size={13} color={C.heart} fill /><Muted size={12}>{likers.join(', ')}</Muted></View> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Badge({ icon, label, color = C.ink }: { icon: string; label: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 }}>
      <Icon name={icon} size={14} color={color} fill={icon === 'star'} />
      <Txt w="semibold" size={12}>{label}</Txt>
    </View>
  );
}

function CompareTable({ list }: { list: Apartment[] }) {
  const d = useData();
  const sims = list.map(a => [a, simulate(a)] as const);
  const rd = d.renda;
  type Row = [string, (x: (typeof sims)[number]) => number, (v: number) => string, ('max' | 'none')?];
  const rows: Row[] = [
    ['Preço', ([, s]) => s.price, money],
    ['Área', ([a]) => Number(a.area) || 0, v => (v ? `${fmtNum(v)} m²` : '—'), 'max'],
    ['Preço por m²', ([a, s]) => (Number(a.area) ? s.price / Number(a.area) : 0), v => (v ? money(v) : '—')],
    ['Entrada + FGTS', ([, s]) => s.entrada + s.fgts, money, 'none'],
    ['Entrada por mês', ([, s]) => (s.parcelada ? s.entradaMes : 0), v => (v ? money(v) : 'à vista'), 'none'],
    ['1ª parcela', ([, s]) => s.firstFin, money],
    ['Por mês com condomínio', ([, s]) => s.monthlyKeys, money],
    ['Precisa ter na mão', ([, s]) => s.cash, money],
    ['Total de juros', ([, s]) => s.juros, money],
    ['Custo total', ([, s]) => s.totalCost, money],
  ];
  if (rd) rows.push(['Parcela / renda', ([, s]) => (s.firstFin / rd) * 100, pctTxt]);
  const colW = 130, firstW = 150;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, backgroundColor: C.surface }}>
      <View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: firstW, padding: 10 }} />
          {sims.map(([a]) => <View key={a.id} style={{ width: colW, padding: 10 }}><Txt w="medium" size={14} style={{ textAlign: 'right' }} lines={2}>{a.name || 'Sem nome'}</Txt></View>)}
        </View>
        {rows.map(([label, get, fmt, mode]) => {
          const vals = sims.map(get);
          const valid = vals.filter(v => v > 0);
          const best = mode === 'none' || valid.length < 2 ? null : mode === 'max' ? Math.max(...valid) : Math.min(...valid);
          return (
            <View key={label} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line }}>
              <View style={{ width: firstW, padding: 10 }}><Txt size={14} color={C.muted}>{label}</Txt></View>
              {vals.map((v, k) => (
                <View key={k} style={{ width: colW, padding: 10 }}>
                  <Txt size={14} w={best != null && v === best ? 'semibold' : 'regular'} color={best != null && v === best ? C.ok : C.ink} style={{ textAlign: 'right', fontFamily: best != null && v === best ? F.semibold : F.regular }}>
                    {fmt(v)}{best != null && v === best ? ' ✓' : ''}
                  </Txt>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
