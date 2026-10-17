import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { money, moneyK } from '@/lib/format';

import { Txt } from './kit';
import { alpha, C, F } from './theme';

// Barras empilhadas (pagamento por ano do apê e parcelas por mês), como os gráficos SVG da página.
// Tocar numa barra mostra o detalhe embaixo.

export interface Series { key: string; label: string; color: string }
export interface Bar { label: string; title: string; subtitle?: string; parts: Record<string, number> }

function niceStep(raw: number) {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const segPath = (x: number, y0: number, y1: number, w: number, round: boolean) => {
  const h = y0 - y1;
  if (h <= 0.5) return '';
  const r = round ? Math.min(4, w / 2, h) : 0;
  return r
    ? `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`
    : `M${x},${y0}V${y1}H${x + w}V${y0}Z`;
};

export function StackedBars({ bars, series, totalLabel, labelEvery }: { bars: Bar[]; series: Series[]; totalLabel: string; labelEvery?: number }) {
  const [W, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const H = W < 480 ? 200 : 240;
  const pad = { l: 60, r: 6, t: 10, b: 26 };
  const iw = Math.max(1, W - pad.l - pad.r), ih = H - pad.t - pad.b;
  const totals = bars.map(b => series.reduce((s, x) => s + (b.parts[x.key] || 0), 0));
  const maxV = Math.max(...totals, 1);
  const step = niceStep(maxV / 4), top = Math.ceil(maxV / step) * step;
  const yv = (v: number) => pad.t + ih - (v / top) * ih;
  const band = iw / Math.max(1, bars.length), bw = Math.max(2, Math.min(24, band - 2));
  const every = labelEvery || Math.max(1, Math.ceil(bars.length / (W < 480 ? 5 : 8)));
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  const cur = sel != null ? bars[sel] : null;

  return (
    <View onLayout={e => setW(Math.round(e.nativeEvent.layout.width))} style={{ gap: 8 }}>
      {W > 0 ? (
        <View style={{ width: W, height: H }}>
          <Svg width={W} height={H}>
            {ticks.map(v => (
              <Line key={`g${v}`} x1={pad.l} x2={W - pad.r} y1={yv(v)} y2={yv(v)} stroke={v === 0 ? C.axis : C.grid} strokeWidth={1} />
            ))}
            {ticks.map(v => (
              <SvgText key={`t${v}`} x={pad.l - 8} y={yv(v) + 4} fontSize={11} fontFamily={F.medium} fill={C.muted} textAnchor="end">{moneyK(v)}</SvgText>
            ))}
            {bars.map((b, k) => {
              const x = pad.l + k * band + (band - bw) / 2;
              const parts = series.map(s => [s, b.parts[s.key] || 0] as const).filter(p => p[1] > 0);
              let cum = 0;
              const dim = sel != null && sel !== k;
              return parts.map(([s, v], j) => {
                const y0 = yv(cum) - (j ? 2 : 0);
                cum += v;
                const y1 = yv(cum);
                return <Path key={`${k}-${s.key}`} d={segPath(x, y0, y1, bw, j === parts.length - 1)} fill={s.color} opacity={dim ? 0.35 : 1} />;
              });
            })}
            {bars.map((b, k) => (k % every === 0 || k === bars.length - 1 ? (
              <SvgText key={`l${k}`} x={pad.l + k * band + band / 2} y={H - 8} fontSize={11} fontFamily={F.medium} fill={C.muted} textAnchor="middle">{b.label}</SvgText>
            ) : null))}
          </Svg>
          <View style={{ position: 'absolute', left: pad.l, top: pad.t, width: iw, height: ih, flexDirection: 'row' }}>
            {bars.map((b, k) => (
              <Pressable key={k} style={{ flex: 1 }} onPress={() => setSel(sel === k ? null : k)} accessibilityLabel={b.title} />
            ))}
          </View>
        </View>
      ) : <View style={{ height: 200 }} />}
      {cur ? (
        <View style={{ backgroundColor: C.ink, borderRadius: 10, padding: 11, gap: 3 }}>
          <Txt w="semibold" size={13} color={C.bg}>{cur.title}{cur.subtitle ? <Txt size={13} color={alpha(C.bg, 0.7)}>{`  ·  ${cur.subtitle}`}</Txt> : null}</Txt>
          {series.filter(s => (cur.parts[s.key] || 0) > 0).map(s => (
            <View key={s.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
                <Txt size={12.5} color={C.bg}>{s.label}</Txt>
              </View>
              <Txt w="semibold" size={12.5} color={C.bg}>{money(cur.parts[s.key])}</Txt>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: alpha(C.bg, 0.3), paddingTop: 4, marginTop: 2 }}>
            <Txt size={12.5} color={C.bg}>{totalLabel}</Txt>
            <Txt w="semibold" size={12.5} color={C.bg}>{money(totals[sel!])}</Txt>
          </View>
        </View>
      ) : <Txt size={12} color={C.muted}>Toque numa barra para ver o detalhe.</Txt>}
    </View>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, columnGap: 16 }}>
      {series.map(s => (
        <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
          <Txt size={13} color={C.muted}>{s.label}</Txt>
        </View>
      ))}
    </View>
  );
}
