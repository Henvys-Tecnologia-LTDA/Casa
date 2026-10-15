import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { balance, budgetState, byPrio, optsOf, PARCELAS, PHASES, stats, sub, TABS } from '@/lib/calc';
import { money, norm, plural } from '@/lib/format';
import type { Item, Section, ShopList } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import {
  Btn, Card, Dot, DuoBar, Empty, Label, Meter, Muted, Panel, Serif, Summary, Txt, useAccent, ViewHead, type StatCell,
} from '@/ui/kit';
import { AppHeader, Loading, Screen } from '@/ui/Screen';
import { C, F, R, soft } from '@/ui/theme';

import { useSheets } from '../sheetsCtx';
import { ItemList } from './ItemRow';

export function ShopHome({ list }: { list: ShopList }) {
  const d = useData();
  const sheets = useSheets();
  const [q, setQ] = useState('');
  const T = TABS[list];
  const secs = d.secs(list);
  const items = d.listItems(list);

  const onFab = () => {
    if (secs.length) sheets.open({ kind: 'item', item: null, secId: secs[0].id, list });
    else sheets.open({ kind: 'section', list, sec: null });
  };

  return (
    <Screen tab={list} onFab={d.ready ? onFab : undefined} fabLabel="Novo item">
      <AppHeader />
      <ShopSummary list={list} />
      <SearchBar value={q} onChange={setQ} placeholder={`Buscar em ${T.label}…`} />
      {!d.ready ? <Loading /> : q.trim() ? <SearchResults list={list} q={q.trim()} /> : (
        <>
          <ViewHead title={T.Units} sub={secs.length ? `Toque em um ${T.unit} para abrir a lista.` : undefined} />
          {!secs.length ? (
            <Empty
              icon={T.icon}
              title={`A lista ${T.label} está vazia`}
              text={`Crie o primeiro ${T.unit} e comece a adicionar itens com foto, preço e loja.`}
              action={<Btn label={T.novo} icon="plus" onPress={() => sheets.open({ kind: 'section', list, sec: null })} />}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {secs.map(s => <RoomCard key={s.id} sec={s} items={d.itemsOf(s.id)} />)}
              <Pressable
                onPress={() => sheets.open({ kind: 'section', list, sec: null })}
                style={({ pressed }) => [roomBox, { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 130, backgroundColor: 'transparent', borderColor: pressed ? C.ink : C.line }]}>
                <Icon name="plus" color={C.muted} />
                <Txt w="semibold" color={C.muted}>{T.novo}</Txt>
              </Pressable>
            </View>
          )}
          {secs.length ? (
            <>
              <ViewHead title={list === 'casa' ? 'Por etapa' : 'Atalhos'} sub={list === 'casa' ? 'O que precisa estar pronto antes de entrar na casa.' : undefined} style={{ marginTop: 6 }} />
              <FocusCards list={list} items={items} />
              <DuoPanel items={items} />
              <HotList list={list} items={items} />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const roomBox = {
  width: '48.5%' as const, padding: 14, borderRadius: R.card, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, gap: 4,
};

function ShopSummary({ list }: { list: ShopList }) {
  const d = useData();
  if (!d.ready) return <Summary cells={['Planejado', 'Já gasto', 'Falta', 'Teto'].map(l => ({ label: l, value: '—' }))} />;
  const st = stats(d.listItems(list)), bud = d.listBudget(list), bs = budgetState(st.projected, bud);
  const eco = st.economy > 0.5 ? ` · economizaram ${money(st.economy)}` : st.economy < -0.5 ? ` · ${money(-st.economy)} acima do previsto` : '';
  const cells: StatCell[] = [
    { label: 'Planejado', value: money(st.total), sub: plural(st.count, 'item', 'itens') },
    { label: 'Já gasto', value: money(st.spent), kind: 'ok', sub: `${st.nb} de ${st.count} comprados${eco}` },
    { label: 'Falta comprar', value: money(st.left), kind: 'acc', sub: st.left > 0 ? `ou ${PARCELAS}× de ${money(st.left / PARCELAS)}` : 'Tudo comprado' },
    bs ? {
      label: 'Teto de gastos', value: money(bud),
      sub: <Txt size={12.5} color={bs.cls === 'hi' ? C.hi : bs.cls === 'mid' ? C.mid : C.ok}>{bs.r > 1 ? `O previsto ${bs.text} do teto` : `Pelo previsto, ${bs.text}`}</Txt>,
      extra: <Meter ratio={Math.min(1, bs.r)} cls={bs.cls} style={{ marginTop: 4 }} />,
    } : {
      label: 'Teto de gastos', value: '—',
      extra: <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Btn label="Definir teto" kind="ghost" size="xs" icon="wallet" onPress={() => router.push('/ajustes')} /></View>,
    },
  ];
  return <Summary cells={cells} />;
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const accent = useAccent();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: R.pill, paddingLeft: 14, paddingRight: 6 }}>
      <Icon name="search" size={18} color={C.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A39A90"
        selectionColor={accent}
        returnKeyType="search"
        style={{ flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink, paddingVertical: 11, paddingHorizontal: 10 }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Limpar busca" style={{ padding: 6 }}>
          <Icon name="x" size={16} color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchResults({ list, q }: { list: ShopList; q: string }) {
  const d = useData();
  const T = TABS[list];
  const nq = norm(q);
  const res = d.listItems(list)
    .filter(i => norm([i.name, i.notes, i.store, d.secById(i.section_id)?.name, ...optsOf(i).map(o => `${o.name} ${o.store}`)].join(' ')).includes(nq))
    .sort((a, b) => Number(a.bought) - Number(b.bought) || byPrio(a, b));
  return (
    <>
      <ViewHead title={`Resultados para “${q}”`} sub={`${plural(res.length, 'item', 'itens')} em ${T.label}`} />
      {res.length ? <ItemList items={res} showSection /> : (
        <Empty icon="search" title="Nada encontrado" text={`Nenhum item de ${T.label} tem “${q}” no nome, na loja ou nas observações.`} />
      )}
    </>
  );
}

function RoomCard({ sec, items }: { sec: Section; items: Item[] }) {
  const accent = useAccent();
  const st = stats(items);
  const full = st.count > 0 && st.nb === st.count;
  const bs = budgetState(st.projected, Number(sec.budget) || 0);
  return (
    <Pressable onPress={() => router.push({ pathname: '/section/[id]', params: { id: sec.id } })} style={({ pressed }) => [roomBox, pressed && { borderColor: C.ink }]}>
      <View style={{ width: 40, height: 40, borderRadius: R.icon, backgroundColor: soft(accent), alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Icon name={sec.icon || 'box'} size={22} color={accent} />
      </View>
      <Txt w="medium" size={16.5} lines={2}>{sec.name}</Txt>
      <Muted size={13}>{st.count ? `${plural(st.count, 'item', 'itens')} · ${st.nb} ${st.nb === 1 ? 'comprado' : 'comprados'}` : 'Sem itens ainda'}</Muted>
      <View style={{ marginTop: 8, gap: 2 }}>
        <Muted size={13}>{full ? 'Tudo comprado' : 'Falta'}</Muted>
        <Txt w="medium" size={16} color={full ? C.ok : C.ink}>{money(full ? st.spent : st.left)}</Txt>
      </View>
      <Meter ratio={st.total ? (st.total - st.left) / st.total : 0} height={5} style={{ marginTop: 8 }} />
      {bs ? (
        <View style={{ marginTop: 6 }}>
          <Muted size={12}>Teto {money(sec.budget)}</Muted>
          <Txt size={12} color={bs.cls === 'hi' ? C.hi : bs.cls === 'mid' ? C.mid : C.ok}>{bs.text}</Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

function FocusCards({ list, items }: { list: ShopList; items: Item[] }) {
  const accent = useAccent();
  const defs = list === 'casa'
    ? PHASES.map(([k, t], n) => ({ k, t, ic: 'flag', num: `0${n + 1}`, items: items.filter(i => i.phase === k) }))
    : [
      { k: 'coop', t: 'Para jogar a dois', ic: 'users', num: '', items: items.filter(i => i.coop) },
      { k: 'temos', t: 'Nossa coleção', ic: 'trophy', num: '', items: items.filter(i => i.bought) },
    ];
  return (
    <View style={{ gap: 10 }}>
      {defs.map(dd => {
        const st = stats(dd.items);
        const sub2 = dd.k === 'temos' ? `${plural(st.count, 'item', 'itens')} que vocês já têm`
          : st.count ? `${st.count - st.nb} de ${st.count} faltando · ${money(st.left)}` : 'Nenhum item ainda';
        return (
          <Card key={dd.k} pad={14} onPress={() => router.push({ pathname: '/focus', params: { list, f: dd.k } })} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {dd.num ? <Serif size={28} color={accent} style={{ minWidth: 34, lineHeight: 26 }}>{dd.num}</Serif> : <Icon name={dd.ic} color={accent} />}
              <Txt w="medium" size={16}>{dd.t}</Txt>
            </View>
            <Muted size={13}>{sub2}</Muted>
            {dd.k === 'temos' ? null : <Meter ratio={st.count ? st.nb / st.count : 0} height={5} />}
          </Card>
        );
      })}
    </View>
  );
}

export function DuoPanel({ items }: { items: Item[] }) {
  const d = useData();
  if (!items.some(i => i.bought)) return null;
  const b = balance(items), tot = b.a + b.b;
  const msg = tot <= 0 ? 'Ao registrar uma compra, marquem quem pagou para ver o acerto entre vocês.'
    : Math.abs(b.diff) < 1 ? 'Vocês estão empatados. Ninguém deve nada a ninguém.' : null;
  return (
    <Panel title="Quem pagou" icon="wallet">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[['a', d.nm('a'), b.a], ['b', d.nm('b'), b.b], ['', 'Sem marcar', b.none]].map(([k, label, v]) => (
          <View key={String(label)} style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {k ? <Dot kind={k as 'a' | 'b'} /> : null}
              <Label>{String(label)}</Label>
            </View>
            <Txt w="medium" size={16}>{money(v)}</Txt>
          </View>
        ))}
      </View>
      <DuoBar a={b.a} b={b.b} />
      {msg ? <Txt size={14}>{msg}</Txt> : (
        <Txt size={14}>
          Para ficar igual, <Txt w="semibold" size={14}>{b.diff > 0 ? d.nm('b') : d.nm('a')}</Txt> passa{' '}
          <Txt w="semibold" size={14}>{money(Math.abs(b.diff))}</Txt> para <Txt w="semibold" size={14}>{b.diff > 0 ? d.nm('a') : d.nm('b')}</Txt>.
        </Txt>
      )}
    </Panel>
  );
}

function HotList({ list, items }: { list: ShopList; items: Item[] }) {
  const hot = items.filter(i => !i.bought && i.priority === 'alta').sort(byPrio);
  if (!hot.length) return null;
  const sum = hot.reduce((t, i) => t + sub(i), 0);
  return (
    <>
      <ViewHead title="Prioridade alta" sub={`${plural(hot.length, 'item', 'itens')} ainda sem comprar · ${money(sum)}`} style={{ marginTop: 6 }} />
      <ItemList items={hot.slice(0, 8)} showSection />
      {hot.length > 8 ? <Muted size={13.5}>Mais {hot.length - 8} com prioridade alta dentro dos {TABS[list].units}.</Muted> : null}
    </>
  );
}
