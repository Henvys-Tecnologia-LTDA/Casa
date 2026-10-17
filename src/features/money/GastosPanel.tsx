import { View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { gastosPorMes, SHOP } from '@/lib/calc';
import { mLabel, money, mTick, pctTxt } from '@/lib/format';
import { Legend, StackedBars, type Series } from '@/ui/Chart';
import { Icon } from '@/ui/Icon';
import { Label, Muted, Panel, Txt } from '@/ui/kit';
import { C, porTema } from '@/ui/theme';

const CORES = porTema((): Record<string, string> => ({ casa: C.s1, switch: C.s2 }));

// Gastos do mês (como o Mobills e o Organizze): o que compraram em cada mês, por lista, comparado
// com o mês anterior, e os cômodos que mais pesaram no mês.
export function GastosPanel() {
  const d = useData();
  const meses = gastosPorMes(d.t.items, d.t.sections, 6);
  if (!meses.some(m => m.total > 0)) return null;
  const atual = meses[meses.length - 1], anterior = meses[meses.length - 2];
  const series: Series[] = SHOP.filter(l => !d.tabs[l].hidden).map(l => ({ key: l, label: d.tabLabel(l), color: CORES()[l] }));
  const variacao = anterior.total > 0 ? (atual.total - anterior.total) / anterior.total : null;
  const top = Object.entries(atual.porSecao).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, v]) => ({ s: d.secById(id), v })).filter(x => x.s);

  return (
    <Panel title="Gastos por mês" icon="calendar">
      <View style={{ gap: 2 }}>
        <Label>{mLabel(atual.ym, true)}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Txt w="medium" size={24} style={{ letterSpacing: -0.5 }}>{money(atual.total)}</Txt>
          {variacao != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ transform: [{ rotate: variacao > 0 ? '90deg' : '-90deg' }] }}>
                <Icon name="back" size={13} color={variacao > 0 ? C.hi : C.ok} />
              </View>
              <Muted size={13}>{`${pctTxt(Math.abs(variacao) * 100)} ${variacao > 0 ? 'a mais' : 'a menos'} que ${mLabel(anterior.ym, true)}`}</Muted>
            </View>
          ) : anterior.total === 0 && atual.total > 0 ? <Muted size={13}>{`nada em ${mLabel(anterior.ym, true)}`}</Muted> : null}
        </View>
      </View>
      <Legend series={series} />
      <StackedBars totalLabel="Gasto no mês" series={series}
        bars={meses.map((m, k) => ({ label: mTick(m.ym, k === 0), title: mLabel(m.ym, true), parts: m.porLista }))} />
      {top.length ? (
        <View style={{ gap: 4 }}>
          <Label>Onde mais gastaram este mês</Label>
          {top.map(({ s, v }) => (
            <View key={s!.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={s!.icon || 'box'} size={15} color={C.muted} />
              <Txt size={14} style={{ flex: 1 }} lines={1}>{s!.name}</Txt>
              <Txt w="medium" size={14}>{money(v)}</Txt>
            </View>
          ))}
        </View>
      ) : null}
      <Muted size={12.5}>Pelo mês da compra, com o valor cheio (as parcelas aparecem no calendário abaixo).</Muted>
    </Panel>
  );
}
