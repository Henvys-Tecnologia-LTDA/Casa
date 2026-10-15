import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { countdown, nextTrip, tripCalc, tripsSorted, TSTATUS_L } from '@/lib/calc';
import { dayLabel, money, pctTxt } from '@/lib/format';
import type { Trip } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Btn, Empty, Label, Meter, Muted, Pill, Summary, Txt, useAccent, ViewHead } from '@/ui/kit';
import { Photo } from '@/ui/Photo';
import { AppHeader, Appear, Loading, Screen } from '@/ui/Screen';
import { C, R, soft } from '@/ui/theme';

import { Badge } from '../ape/ApeHome';
import { useSheets } from '../sheetsCtx';

export function TripsHome() {
  const d = useData();
  const sheets = useSheets();
  const list = tripsSorted(d.t.trips);
  return (
    <Screen tab="viagem" onFab={d.ready ? () => sheets.open({ kind: 'trip', trip: null }) : undefined} fabLabel="Nova viagem">
      <AppHeader />
      <TripSummary />
      {!d.ready ? <Loading /> : (
        <>
          <ViewHead title="Viagens" sub="Planejem os custos, juntem no cofrinho e montem a mala juntos." />
          {!list.length ? (
            <Empty icon="suitcase" title="Nenhuma viagem ainda" text="Adicionem a próxima viagem dos sonhos: destino, datas e quanto vai custar."
              action={<Btn label="Adicionar viagem" icon="plus" onPress={() => sheets.open({ kind: 'trip', trip: null })} />} />
          ) : (
            <View style={{ gap: 12 }}>
              {list.map((t, k) => <Appear key={t.id} i={k}><TripCard t={t} /></Appear>)}
              <Pressable onPress={() => sheets.open({ kind: 'trip', trip: null })}
                style={({ pressed }) => ({ borderWidth: 1, borderStyle: 'dashed', borderColor: pressed ? C.ink : C.line, borderRadius: R.card, padding: 20, alignItems: 'center', gap: 8 })}>
                <Icon name="plus" color={C.muted} />
                <Txt w="semibold" color={C.muted}>Nova viagem</Txt>
              </Pressable>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function TripSummary() {
  const d = useData();
  const nx = d.ready ? nextTrip(d.t.trips) : null;
  if (!nx) {
    return <Summary cells={['Próxima viagem', 'Custo previsto', 'Já juntaram', 'Guardar por mês'].map(l => ({ label: l, value: '—', sub: l === 'Próxima viagem' && d.ready ? 'Adicione uma viagem' : undefined }))} />;
  }
  const c = tripCalc(nx, d.costsOf(nx.id), d.depsOf(nx.id), d.packOf(nx.id));
  return (
    <Summary cells={[
      { label: 'Próxima viagem', value: nx.name || 'Sem nome', kind: 'txt', sub: countdown(c, nx.status) },
      { label: 'Custo previsto', value: money(c.total), sub: `${money(c.perPerson)} por pessoa` },
      { label: 'Já juntaram', value: money(c.paid + c.saved), kind: 'ok', sub: c.total ? `${pctTxt(c.pct * 100)} · pago ${money(c.paid)} + cofrinho ${money(c.saved)}` : undefined, extra: <Meter ratio={c.pct} style={{ marginTop: 4 }} /> },
      { label: 'Guardar por mês', value: money(c.months ? c.perMonth : c.falta), kind: 'acc', sub: c.falta <= 0 ? 'Tudo pago ou guardado' : c.months ? `por ${c.months} ${c.months === 1 ? 'mês' : 'meses'} até a viagem` : 'falta juntar' },
    ]} />
  );
}

function TripCard({ t }: { t: Trip }) {
  const d = useData();
  const accent = useAccent();
  const c = tripCalc(t, d.costsOf(t.id), d.depsOf(t.id), d.packOf(t.id));
  const dates = t.start_date ? `${dayLabel(t.start_date)}${t.end_date ? ' a ' + dayLabel(t.end_date, true) : ''}` : '';
  const nums: [string, string][] = [
    ['Custo total', money(c.total)], ['Por pessoa', money(c.perPerson)],
    ['Já juntaram', pctTxt(c.pct * 100)], [c.months ? 'Guardar por mês' : 'Falta juntar', money(c.months ? c.perMonth : c.falta)],
  ];
  return (
    <Pressable onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
      style={({ pressed }) => ({ borderWidth: 1, borderColor: pressed ? C.ink : C.line, borderRadius: R.card, backgroundColor: C.surface, overflow: 'hidden', opacity: t.status === 'feita' ? 0.62 : 1 })}>
      <View style={{ height: 150, backgroundColor: soft(accent) }}>
        <Photo path={t.image} icon="suitcase" iconSize={42} iconColor={accent} bg={soft(accent)} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Pill label={TSTATUS_L[t.status] || TSTATUS_L.planejando} kind={t.status} />
          <Badge icon="calendar" label={countdown(c, t.status)} />
        </View>
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <Txt w="medium" size={18}>{t.name || 'Sem nome'}</Txt>
        <Muted size={13}>{[t.destination, dates].filter(Boolean).join(' · ')}</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 10 }}>
          {nums.map(([l, v]) => (
            <View key={l} style={{ width: '50%', gap: 1 }}>
              <Label>{l}</Label>
              <Txt w="medium" size={15}>{v}</Txt>
            </View>
          ))}
        </View>
        <Meter ratio={c.pct} style={{ marginTop: 8 }} />
      </View>
    </Pressable>
  );
}
