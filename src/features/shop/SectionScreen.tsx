import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { budgetState, byPrio, PARCELAS, PHASE, PHASES, stats, sub, TABS } from '@/lib/calc';
import { textoSecao } from '@/lib/compartilhar';
import { money, plural } from '@/lib/format';
import type { Item, ShopList } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { compartilhar } from '@/ui/share';
import { Btn, Chip, Empty, IconBtn, Meter, Mini, Minis, Muted, Serif, useAccent } from '@/ui/kit';
import { BackBar, Loading, Screen } from '@/ui/Screen';
import { R } from '@/ui/theme';

import { useSheets } from '../sheetsCtx';
import { ItemList } from './ItemRow';

type Filter = 'todos' | 'falta' | 'comprados' | 'coop';
type Sort = 'prioridade' | 'preco-desc' | 'preco-asc' | 'nome';
const SORTS: [Sort, string][] = [['prioridade', 'Prioridade'], ['preco-desc', 'Maior preço'], ['preco-asc', 'Menor preço'], ['nome', 'Nome (A–Z)']];

export function SectionScreen({ id }: { id: string }) {
  const d = useData();
  const sheets = useSheets();
  const [filter, setFilter] = useState<Filter>('todos');
  const [phaseF, setPhaseF] = useState('');
  const [sort, setSort] = useState<Sort>('prioridade');
  const s = d.secById(id);
  const list: ShopList = s?.list || 'casa';
  const T = TABS[list];

  if (!d.ready) return <Screen tab={list} inTabs={false}><BackBar label={T.Units} /><Loading /></Screen>;
  if (!s) {
    return (
      <Screen tab={list} inTabs={false}>
        <BackBar label={T.Units} />
        <Empty icon="box" title="Este cômodo não existe mais" text="Ele pode ter sido excluído no outro celular." />
      </Screen>
    );
  }

  const all = d.itemsOf(s.id), st = stats(all);
  const nLeft = all.filter(i => !i.bought).length, nCoop = all.filter(i => i.coop).length;
  let rows = all.filter(i => (filter === 'todos' ? true : filter === 'falta' ? !i.bought : filter === 'coop' ? i.coop : i.bought));
  if (list === 'casa' && phaseF) rows = rows.filter(i => i.phase === phaseF);
  const by: (a: Item, b: Item) => number = sort === 'preco-desc' ? (a, b) => sub(b) - sub(a) : sort === 'preco-asc' ? (a, b) => sub(a) - sub(b)
    : sort === 'nome' ? (a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR') : byPrio;
  rows = [...rows].sort((a, b) => (filter === 'todos' ? Number(a.bought) - Number(b.bought) : 0) || by(a, b));
  const bs = budgetState(st.projected, Number(s.budget) || 0);
  const segs: [Filter, string, number][] = [['todos', 'Todos', all.length], ['falta', 'Falta', nLeft], ['comprados', T.boughtLbl, all.length - nLeft]];
  if (list === 'switch') segs.push(['coop', 'A dois', nCoop]);

  return (
    <Screen tab={list} inTabs={false} onFab={() => sheets.open({ kind: 'item', item: null, secId: s.id, list })} fabLabel="Novo item">
      <BackBar label={T.Units} right={all.length ? <><View style={{ flex: 1 }} /><IconBtn icon="share" label="Mandar este cômodo no WhatsApp" onPress={() => compartilhar(textoSecao(s, all, d.tabLabel(list)))} /></> : undefined} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {d.secs(list).map(c => (
          <Chip key={c.id} label={c.name} icon={c.icon || 'box'} on={c.id === s.id} onPress={() => c.id !== s.id && router.replace({ pathname: '/section/[id]', params: { id: c.id } })} />
        ))}
      </ScrollView>
      <SecHead icon={s.icon || 'box'} title={s.name} sub={`${plural(st.count, 'item', 'itens')} · ${st.nb} ${st.nb === 1 ? 'comprado' : 'comprados'}`}
        right={<Btn label={`Editar ${T.unit}`} kind="ghost" size="sm" icon="pencil" onPress={() => sheets.open({ kind: 'section', list, sec: s })} />} />
      <Minis>
        <Mini label="Planejado" value={money(st.total)} />
        <Mini label="Gasto" value={money(st.spent)} kind="ok" small={st.economy > 0.5 ? `economizaram ${money(st.economy)}` : undefined} />
        <Mini label="Falta" value={money(st.left)} kind="acc" small={st.left > 0 ? `ou ${PARCELAS}× de ${money(st.left / PARCELAS)}` : undefined} />
        {bs ? (
          <Mini label={`Teto ${money(s.budget)}`} value={bs.text} kind={bs.cls === 'ok' ? 'ok' : bs.cls}>
            <Meter ratio={bs.r} cls={bs.cls} height={4} style={{ marginTop: 4 }} />
          </Mini>
        ) : null}
      </Minis>
      <View style={{ gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {segs.map(([k, t, n]) => <Chip key={k} label={t} count={n} on={filter === k} onPress={() => setFilter(k)} />)}
        </ScrollView>
        {list === 'casa' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            <Muted size={13.5}>Etapa</Muted>
            <Chip label="Todas" on={!phaseF} onPress={() => setPhaseF('')} />
            {PHASES.map(([k, t]) => <Chip key={k} label={t} on={phaseF === k} onPress={() => setPhaseF(k)} />)}
          </ScrollView>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
          <Muted size={13.5}>Ordenar</Muted>
          {SORTS.map(([k, t]) => <Chip key={k} label={t} on={sort === k} onPress={() => setSort(k)} />)}
        </ScrollView>
      </View>
      {!all.length ? (
        <Empty icon={s.icon || 'box'} title={`Nada em ${s.name} ainda`} text="Adicione o primeiro item: nome, preço, foto e onde comprar."
          action={<Btn label="Adicionar item" icon="plus" onPress={() => sheets.open({ kind: 'item', item: null, secId: s.id, list })} />} />
      ) : !rows.length ? (
        <Empty icon="check" title="Nenhum item neste filtro" text="Troque o filtro para ver os outros itens." />
      ) : <ItemList items={rows} />}
    </Screen>
  );
}

export function SecHead({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: ReactNode }) {
  const accent = useAccent();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: R.icon, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={28} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Serif size={34}>{title}</Serif>
          {sub ? <Muted>{sub}</Muted> : null}
        </View>
      </View>
      {right ? <View style={{ alignSelf: 'flex-start' }}>{right}</View> : null}
    </View>
  );
}

export function FocusScreen({ list, f }: { list: ShopList; f: string }) {
  const d = useData();
  const T = TABS[list];
  const title = PHASE[f] || (f === 'coop' ? 'Para jogar a dois' : 'Nossa coleção');
  const order = new Map(d.secs(list).map((s, k) => [s.id, k]));
  const pool = d.listItems(list).filter(i => (PHASE[f] ? i.phase === f : f === 'coop' ? i.coop : i.bought))
    .sort((a, b) => Number(a.bought) - Number(b.bought) || (order.get(a.section_id) ?? 0) - (order.get(b.section_id) ?? 0) || byPrio(a, b));
  const st = stats(pool);
  return (
    <Screen tab={list} inTabs={false}>
      <BackBar label={T.Units} />
      <SecHead icon={PHASE[f] ? 'flag' : f === 'coop' ? 'users' : 'trophy'} title={title} sub={`${plural(st.count, 'item', 'itens')} · ${st.nb} ${st.nb === 1 ? 'comprado' : 'comprados'}`} />
      <Minis>
        <Mini label="Planejado" value={money(st.total)} />
        <Mini label="Gasto" value={money(st.spent)} kind="ok" />
        <Mini label="Falta" value={money(st.left)} kind="acc" />
      </Minis>
      {!d.ready ? <Loading /> : pool.length ? <ItemList items={pool} showSection /> : (
        <Empty icon="flag" title="Nada aqui ainda" text={PHASE[f] ? 'Ao editar um item, escolham a etapa dele.' : 'Marque “Dá para jogar a dois” ao editar um jogo.'} />
      )}
    </Screen>
  );
}
