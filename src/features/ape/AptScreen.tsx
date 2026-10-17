import { Linking, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { simulate, STATUS_L } from '@/lib/calc';
import { fmtNum, money, pctTxt, safeUrl } from '@/lib/format';
import { Btn, Empty, LikeBtn, Meter, Mini, Minis, Muted, Note, Panel, Pill, Rows, Serif, Txt } from '@/ui/kit';
import { Legend, StackedBars, type Series } from '@/ui/Chart';
import { Photo } from '@/ui/Photo';
import { BackBar, Loading, Screen } from '@/ui/Screen';
import { ACCENT, C, porTema, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';
import { AteOTrabalho } from './Trabalho';
import { Badge } from './ApeHome';

const SERIES = porTema((): Series[] => [
  { key: 'ent', label: 'Entrada', color: C.s1 },
  { key: 'fin', label: 'Financiamento + seguros', color: C.s2 },
  { key: 'fix', label: 'Condomínio + IPTU', color: C.s3 },
]);

export function AptScreen({ id }: { id: string }) {
  const d = useData();
  const { update, me } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const accent = ACCENT.ape;
  const a = d.t.apartments.find(x => x.id === id);

  if (!d.ready) return <Screen tab="ape" inTabs={false}><BackBar label="Apartamentos" /><Loading /></Screen>;
  if (!a) {
    return (
      <Screen tab="ape" inTabs={false}>
        <BackBar label="Apartamentos" />
        <Empty icon="building" title="Este apê não existe mais" text="Ele pode ter sido excluído no outro celular." />
      </Screen>
    );
  }

  const s = simulate(a), url = safeUrl(a.link), rd = d.renda;
  const comp = rd ? s.firstFin / rd : 0;
  const compCls = comp > 0.3 ? 'hi' : comp > 0.25 ? 'mid' : 'ok';
  const liked = (a.likes || []).includes(me);

  const toggleFav = async () => {
    const turnOn = !a.favorite;
    try {
      for (const x of d.t.apartments) {
        const want = turnOn && x.id === a.id;
        if (!!x.favorite !== want) await update('apartments', x.id, { favorite: want });
      }
      toast(turnOn ? 'Agora é o favorito' : 'Favorito removido', turnOn ? 'star' : 'check');
    } catch (e: any) { toast(e.message, 'x'); }
  };
  const toggleLike = async () => {
    const likes = liked ? a.likes.filter(u => u !== me) : [...(a.likes || []), me];
    try { await update('apartments', a.id, { likes }); } catch (e: any) { toast(e.message, 'x'); }
  };

  return (
    <Screen tab="ape" inTabs={false}>
      <BackBar label="Apartamentos" />
      <View style={{ height: 220, borderRadius: R.card, overflow: 'hidden', backgroundColor: soft(accent) }}>
        <Photo path={a.image} icon="building" iconSize={56} iconColor={accent} bg={soft(accent)} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pill label={STATUS_L[a.status] || STATUS_L.visitar} kind={a.status} />
          {a.favorite ? <Badge icon="star" label="Favorito" color={C.mid} /> : null}
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Serif size={34}>{a.name || 'Sem nome'}</Serif>
        <Muted>{[a.address, a.area ? `${fmtNum(a.area)} m²` : '', a.rooms ? `${a.rooms} quartos` : '', a.parking ? `${a.parking} vaga(s)` : ''].filter(Boolean).join(' · ')}</Muted>
        <AteOTrabalho address={a.address || ''} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <LikeBtn on={liked} label={liked ? 'Curtido' : 'Curtir'} onPress={toggleLike} />
        <Btn label={a.favorite ? 'Tirar favorito' : 'Favorito'} kind="ghost" size="sm" icon="star" onPress={toggleFav} />
        <Btn label="Editar simulação" size="sm" icon="pencil" onPress={() => sheets.open({ kind: 'apt', apt: a })} />
        {url ? <Btn label="Anúncio" kind="ghost" size="sm" icon="ext" onPress={() => Linking.openURL(url)} /> : null}
      </View>
      <Minis>
        <Mini label="Preço" value={money(s.price)} small={a.area ? `${money(s.price / Number(a.area))} por m²` : undefined} />
        <Mini label={`Entrada${s.fgts ? ' + FGTS' : ''}`} value={money(s.entrada + s.fgts)} small={`${pctTxt(s.entPct)} do valor${s.parcelada ? ` · ${s.ne}× de ${money(s.entradaMes)}` : ' · à vista'}`} />
        <Mini label="Financiado" value={money(s.P)} small={`${s.sistema} · ${s.n} meses · ${pctTxt(s.ia * 100)} a.a.`} />
        <Mini label="1ª parcela" value={money(s.firstFin)} kind="acc" small={s.sistema === 'SAC' ? `última: ${money(s.lastFin)}` : 'fixa até o fim'} />
      </Minis>
      {s.low20 ? (
        <Note kind="warn" icon="alert">A entrada está abaixo de 20% do valor. Os bancos costumam financiar até 80% do imóvel, então talvez precisem de uma entrada maior.</Note>
      ) : null}
      <Panel title="Quanto sai por mês" icon="calendar">
        <Legend series={SERIES()} />
        {s.years.length && s.peak > 0 ? (
          <StackedBars
            totalLabel="Média por mês"
            series={SERIES()}
            bars={s.years.map((y, k) => ({ label: k === 0 ? 'Ano 1' : String(y.y), title: `Ano ${y.y}`, subtitle: `meses ${y.from}–${y.to}`, parts: { ent: y.ent, fin: y.fin, fix: y.fix } }))}
          />
        ) : <Muted size={12.5}>Preencham preço, entrada e juros para ver o gráfico.</Muted>}
        <View style={{ gap: 10 }}>
          {s.timeline.map(t => (
            <View key={t.when} style={{ gap: 4 }}>
              <View style={{ alignSelf: 'flex-start', backgroundColor: soft(accent), borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 }}>
                <Txt w="semibold" size={12} color={accent}>{t.when}</Txt>
              </View>
              <Txt size={14.5}>{t.text}</Txt>
            </View>
          ))}
        </View>
      </Panel>
      <Panel title="Depois das chaves, por mês" icon="house">
        <Rows rows={[
          { label: 'Parcela do financiamento', value: money(s.P > 0 ? s.firstFin - s.seg : 0) },
          { label: 'Seguros e taxas do banco', value: money(s.P > 0 ? s.seg : 0) },
          { label: 'Condomínio', value: money(a.condo) },
          { label: 'IPTU', value: money(a.iptu) },
          { label: 'Total no 1º mês', value: money(s.monthlyKeys), total: true },
        ]} />
        {rd ? (
          <>
            <Muted size={12.5}>
              Parcela do banco = <Txt w="semibold" size={12.5} color={compCls === 'hi' ? C.hi : compCls === 'mid' ? C.mid : C.ok}>{pctTxt(comp * 100)}</Txt> da renda de {money(rd)}. Os bancos costumam aceitar até 30%.
            </Muted>
            <Meter ratio={comp / 0.4} cls={compCls} marker={0.75} />
          </>
        ) : <Muted size={12.5}>Informe a renda nos ajustes para ver o comprometimento.</Muted>}
      </Panel>
      <Panel title="Para fechar negócio" icon="wallet">
        <Rows rows={[
          ...(!s.parcelada && s.entrada ? [{ label: 'Entrada à vista', value: money(s.entrada) }] : []),
          ...(s.parcelada ? [{ label: 'Entrada parcelada', value: `${s.ne}× ${money(s.entradaMes)}` }] : []),
          ...(s.fgts ? [{ label: 'Do FGTS', value: money(s.fgts) }] : []),
          { label: 'ITBI', value: money(s.itbiV) },
          { label: 'Cartório e registro', value: money(s.cartV) },
          { label: 'Precisa ter na mão', value: money(s.cash), total: true },
        ]} />
        <Rows rows={[
          { label: 'Total de juros', value: money(s.juros) },
          { label: 'Total pago ao banco', value: money(s.totalBanco) },
          { label: 'Custo total do apê', value: money(s.totalCost) },
        ]} />
      </Panel>
      {a.notes ? <Panel title="Observações" icon="pencil"><Txt>{a.notes}</Txt></Panel> : null}
    </Screen>
  );
}

