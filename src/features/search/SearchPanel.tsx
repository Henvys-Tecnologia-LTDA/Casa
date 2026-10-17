import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActions, useData } from '@/data/DataProvider';
import { SHOP } from '@/lib/calc';
import { buildIndex, countByGroup, GROUPS, pieces, search, type Hit, type SearchEntry, type SearchGroup } from '@/lib/search';
import { TAB_HINT, TAB_ORDER } from '@/lib/tabs';
import type { ShopList, TabKey } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Chip, Label, Muted, tap, Txt } from '@/ui/kit';
import { backdropIn, backdropOut, dialogIn, dialogOut } from '@/ui/motion';
import { ACCENT, C, F, porTema, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';

// Painel da busca geral. Como no Miro: um campo só, resultados com o ícone do tipo e o trecho
// achado marcado, filtro por tipo com a contagem, "abertos recentemente" antes de digitar,
// teclado (↑ ↓ Enter Esc) e o toque leva direto até o objeto (abre a janela ou a tela dele).

const PER_GROUP = 5;
const RECENT_MAX = 6;
const keyOf = (e: Pick<SearchEntry, 'kind' | 'id'>) => `${e.kind}:${e.id}`;
const isMac = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

type Line =
  | { t: 'head'; key: string; label: string; count?: number; more?: SearchGroup }
  | { t: 'row'; key: string; n: number; hit: Hit | null; entry: SearchEntry };

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const d = useData();
  const { hid, insert } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 720;
  // Escolha pelo teclado (↑ ↓) só aparece no computador; no celular o destaque pareceria um toque preso.
  const keys = wide && Platform.OS === 'web';

  const [q, setQ] = useState('');
  const [group, setGroup] = useState<SearchGroup | 'tudo'>('tudo');
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const storeKey = `casa.busca.recentes.${hid}`;

  useEffect(() => {
    AsyncStorage.getItem(storeKey).then(v => { try { setRecent(JSON.parse(v || '[]')); } catch {} }).catch(() => {});
  }, [storeKey]);

  const index = useMemo(() => buildIndex(d.t, {
    tabs: TAB_ORDER,
    tabLabel: k => d.tabs[k].label,
    tabIcon: k => d.tabs[k].icon,
    tabHint: k => TAB_HINT[k],
    hidden: k => d.tabs[k].hidden,
  }), [d.t, d.tabs]);
  const byKey = useMemo(() => new Map(index.map(e => [keyOf(e), e])), [index]);

  const query = q.trim();
  const hits = useMemo(() => (query ? search(index, query, group) : []), [index, query, group]);
  const counts = useMemo(() => (query ? countByGroup(index, query) : null), [index, query]);

  // "Criar" no fim dos resultados, como a paleta do Miro e do Notion: o que foi digitado vira o nome.
  const creates = useMemo<SearchEntry[]>(() => {
    if (!query) return [];
    const t = query.slice(0, 120);
    const on = (k: TabKey) => !d.tabs[k].hidden;
    const mk = (id: string, tab: TabKey, title: string, sub: string): SearchEntry =>
      ({ kind: 'criar', id, tab, group: 'abas', icon: 'plus', title, sub, fields: [], done: false, updated: '' });
    const out: SearchEntry[] = [];
    for (const l of SHOP) if (on(l) && d.secs(l).length) out.push(mk(`item:${l}`, l, `Novo item “${t}”`, `em ${d.tabLabel(l)} · abre para completar`));
    if (on('mudanca')) out.push(mk('task', 'mudanca', `Nova tarefa “${t}”`, `em ${d.tabLabel('mudanca')} · cria na hora`));
    for (const l of SHOP) if (on(l)) out.push(mk(`section:${l}`, l, `${l === 'casa' ? 'Novo cômodo' : 'Nova seção'} “${t}”`, `em ${d.tabLabel(l)}`));
    if (on('viagem')) out.push(mk('trip', 'viagem', `Nova viagem “${t}”`, `em ${d.tabLabel('viagem')} · cria na hora`));
    if (on('ape')) out.push(mk('apt', 'ape', `Novo apê “${t}”`, `em ${d.tabLabel('ape')} · cria na hora`));
    if (on('dinheiro')) out.push(mk('goal', 'dinheiro', `Nova meta “${t}”`, `em ${d.tabLabel('dinheiro')} · abre para pôr o valor`));
    return out;
  }, [query, d]);

  // Linhas na ordem em que aparecem; os grupos seguem o melhor resultado de cada um.
  const lines = useMemo<Line[]>(() => {
    const out: Line[] = [];
    let n = 0;
    const row = (entry: SearchEntry, hit: Hit | null, sec: string) => out.push({ t: 'row', key: `${sec}:${keyOf(entry)}`, n: n++, hit, entry });
    if (!query) {
      const rec = recent.map(k => byKey.get(k)).filter((e): e is SearchEntry => !!e);
      if (rec.length) {
        out.push({ t: 'head', key: 'h:rec', label: 'Abertos recentemente' });
        rec.forEach(e => row(e, null, 'rec'));
      }
      out.push({ t: 'head', key: 'h:ir', label: 'Ir para' });
      index.filter(e => e.group === 'abas').forEach(e => row(e, null, 'ir'));
      return out;
    }
    if (group !== 'tudo') {
      hits.slice(0, 200).forEach(h => row(h.entry, h, 'g'));
      return out;
    }
    const order: SearchGroup[] = [];
    for (const h of hits) if (!order.includes(h.entry.group)) order.push(h.entry.group);
    for (const g of order) {
      const gh = hits.filter(h => h.entry.group === g);
      const label = GROUPS.find(x => x[0] === g)?.[1] || '';
      out.push({ t: 'head', key: `h:${g}`, label, count: gh.length, more: gh.length > PER_GROUP && g !== 'abas' ? g : undefined });
      gh.slice(0, PER_GROUP).forEach(h => row(h.entry, h, g));
    }
    if (creates.length) {
      out.push({ t: 'head', key: 'h:criar', label: 'Criar' });
      creates.forEach(e => row(e, null, 'criar'));
    }
    return out;
  }, [query, group, hits, recent, byKey, index, creates]);

  const rows = useMemo(() => lines.filter((l): l is Extract<Line, { t: 'row' }> => l.t === 'row'), [lines]);
  const changeQ = (v: string) => { setQ(v); setSel(0); };
  const changeGroup = (g: SearchGroup | 'tudo') => { setGroup(g); setSel(0); };

  // Grava já aqui (e não dentro do setRecent): o painel fecha logo em seguida.
  const remember = useCallback((e: SearchEntry) => {
    if (e.group === 'abas') return;
    const next = [keyOf(e), ...recent.filter(k => k !== keyOf(e))].slice(0, RECENT_MAX);
    setRecent(next);
    AsyncStorage.setItem(storeKey, JSON.stringify(next)).catch(() => {});
  }, [recent, storeKey]);

  const go = (e: SearchEntry) => {
    tap();
    remember(e);
    onClose();
    const trip = (id: string) => router.push({ pathname: '/trip/[id]', params: { id } });
    switch (e.kind) {
      case 'tab': router.navigate(`/${e.id}`); break;
      case 'ajustes': router.push('/ajustes'); break;
      case 'item': sheets.open({ kind: 'detail', id: e.id }); break;
      case 'section': router.push({ pathname: '/section/[id]', params: { id: e.id } }); break;
      case 'apt': router.push({ pathname: '/apt/[id]', params: { id: e.id } }); break;
      case 'trip': trip(e.id); break;
      case 'pack': trip(e.parent || ''); break;
      case 'cost': {
        const cost = d.t.trip_costs.find(x => x.id === e.id);
        trip(e.parent || '');
        if (cost) sheets.open({ kind: 'cost', tripId: cost.trip_id, cost });
        break;
      }
      case 'task': {
        const task = d.t.tasks.find(x => x.id === e.id);
        router.navigate('/mudanca');
        if (task) sheets.open({ kind: 'task', task });
        break;
      }
      case 'goal': {
        const goal = d.t.goals.find(x => x.id === e.id);
        router.navigate('/dinheiro');
        if (goal) sheets.open({ kind: 'goal', goal });
        break;
      }
      case 'atividade': router.push('/atividade'); break;
      case 'mercado': router.push('/mercado'); break;
      case 'caderno': router.push('/caderno'); break;
      case 'nota': {
        const note = d.t.notes.find(x => x.id === e.id);
        router.push('/caderno');
        if (note) sheets.open({ kind: 'note', note });
        break;
      }
      case 'conta': {
        const bill = d.t.bills.find(x => x.id === e.id);
        router.navigate('/dinheiro');
        if (bill) sheets.open({ kind: 'bill', bill });
        break;
      }
      case 'criar': create(e.id, query.slice(0, 120)); break;
    }
  };

  // Tarefa, viagem e apê só precisam do nome: já nascem prontos. Item, cômodo e meta abrem a janela
  // com o nome preenchido, para completar o resto.
  async function create(id: string, name: string) {
    const [what, l] = id.split(':') as [string, ShopList];
    try {
      switch (what) {
        case 'item': sheets.open({ kind: 'item', item: null, list: l, secId: d.secs(l)[0]?.id, name }); break;
        case 'section': router.navigate(`/${l}`); sheets.open({ kind: 'section', list: l, sec: null, name }); break;
        case 'goal': router.navigate('/dinheiro'); sheets.open({ kind: 'goal', goal: null, name }); break;
        case 'task':
          await insert('tasks', { title: name });
          router.navigate('/mudanca');
          toast('Tarefa criada', 'plus');
          break;
        case 'trip': {
          const r = await insert('trips', { name });
          router.push({ pathname: '/trip/[id]', params: { id: r.id } });
          toast('Viagem criada', 'plus');
          break;
        }
        case 'apt': {
          const r = await insert('apartments', { name });
          router.push({ pathname: '/apt/[id]', params: { id: r.id } });
          toast('Apê criado', 'plus');
          break;
        }
      }
    } catch (err: any) {
      toast(err?.message || 'Não foi possível criar.', 'x');
    }
  }

  // Teclado no navegador: setas escolhem, Esc fecha (o Enter vem do onSubmitEditing do campo).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const n = rows.length;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); onClose(); return; }
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      ev.preventDefault();
      if (n) setSel(cur => (cur + (ev.key === 'ArrowDown' ? 1 : -1) + n) % n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows.length, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  // No navegador o painel nasce escondido até a animação de entrada começar, e o autoFocus
  // num campo escondido não pega: foca de novo logo depois que ele aparece.
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = [80, 250].map(ms => setTimeout(() => input.current?.focus(), ms));
    return () => t.forEach(clearTimeout);
  }, []);

  // Mantém a linha escolhida pelo teclado à vista.
  const scroll = useRef<ScrollView>(null);
  const box = useRef({ y: 0, h: 0 });
  const rowPos = useRef(new Map<number, { y: number; h: number }>());
  useEffect(() => {
    const p = rowPos.current.get(sel);
    if (!p) return;
    const { y, h } = box.current;
    if (p.y < y) scroll.current?.scrollTo({ y: Math.max(0, p.y - 40), animated: false });
    else if (p.y + p.h > y + h) scroll.current?.scrollTo({ y: p.y + p.h - h + 8, animated: false });
  }, [sel]);

  const openSelected = () => {
    const r = rows[sel] || rows[0];
    if (r) go(r.entry);
  };

  const chips = counts ? (['tudo', ...GROUPS.map(g => g[0]).filter(g => g !== 'abas')] as (SearchGroup | 'tudo')[])
    .filter(g => g === 'tudo' || g === group || counts[g] > 0) : [];

  const panel = (
    <View style={{ flex: 1 }}>
      <View style={st().inputRow}>
        <Icon name="search" size={20} color={C.muted} />
        <TextInput
          ref={input}
          value={q}
          onChangeText={changeQ}
          autoFocus
          placeholder="Buscar itens, cômodos, tarefas, apês, viagens…"
          placeholderTextColor={C.placeholder}
          selectionColor={ACCENT.casa}
          returnKeyType="search"
          onSubmitEditing={openSelected}
          blurOnSubmit={false}
          accessibilityLabel="Buscar em tudo"
          style={st().input}
        />
        {q ? (
          <Pressable onPress={() => changeQ('')} hitSlop={8} accessibilityLabel="Limpar busca" style={{ padding: 4 }}>
            <Icon name="x" size={16} color={C.muted} />
          </Pressable>
        ) : null}
        {wide ? <Key>Esc</Key> : (
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fechar busca" style={{ paddingVertical: 6, paddingLeft: 4 }}>
            <Txt w="medium" size={15} color={C.coral}>Fechar</Txt>
          </Pressable>
        )}
      </View>

      {chips.length ? (
        <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
            {chips.map(g => (
              <Chip key={g} label={g === 'tudo' ? 'Tudo' : GROUPS.find(x => x[0] === g)![1]} count={counts![g]} on={group === g} onPress={() => changeGroup(g)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onLayout={e => { box.current.h = e.nativeEvent.layout.height; }}
        onScroll={e => { box.current.y = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ paddingVertical: 6, paddingBottom: wide ? 6 : insets.bottom + 24 }}>
        {query && !hits.length ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 24 }}>
            <Icon name="search" size={30} color={C.muted} />
            <Txt w="medium" size={16} center>Nada encontrado para “{query}”</Txt>
            <Muted size={13.5} style={{ textAlign: 'center' }}>
              {group !== 'tudo' && counts && counts.tudo ? 'Tem resultados em outros tipos.' : 'A busca olha nomes, lojas, observações, endereços e destinos.'}
            </Muted>
            {group !== 'tudo' && counts && counts.tudo ? <Chip label="Ver em tudo" count={counts.tudo} onPress={() => changeGroup('tudo')} /> : null}
          </View>
        ) : null}
        {query && hits.length && !wide ? <Muted size={12.5} style={{ paddingHorizontal: 16, paddingTop: 6 }}>{resultsTxt(hits.length)}</Muted> : null}
        {lines.map(l => (l.t === 'head' ? (
          <View key={l.key} style={st().head}>
            <Label>{l.count != null ? `${l.label} · ${l.count}` : l.label}</Label>
            {l.more ? (
              <Pressable onPress={() => changeGroup(l.more!)} hitSlop={8} accessibilityRole="button">
                <Txt w="medium" size={12.5} color={C.coral}>Ver todos</Txt>
              </Pressable>
            ) : l.key === 'h:rec' ? (
              <Pressable onPress={() => { setRecent([]); AsyncStorage.removeItem(storeKey).catch(() => {}); }} hitSlop={8} accessibilityRole="button">
                <Txt w="medium" size={12.5} color={C.muted}>Limpar</Txt>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View key={l.key} onLayout={e => { rowPos.current.set(l.n, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height }); }}>
            <ResultRow entry={l.entry} hit={l.hit} selected={keys && l.n === sel} onPress={() => go(l.entry)} onHover={() => setSel(l.n)} />
          </View>
        )))}
        {!query && Platform.OS === 'web' ? (
          <Muted size={12.5} style={{ paddingHorizontal: 16, paddingTop: 14 }}>Dica: {isMac ? '⌘' : 'Ctrl'} + K abre a busca de qualquer tela.</Muted>
        ) : null}
      </ScrollView>

      {wide ? (
        <View style={st().foot}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 1 }}>
            <Key>↑</Key><Key>↓</Key><Muted size={12}>escolher</Muted>
            <Key>Enter</Key><Muted size={12}>abrir</Muted>
            <Key>Esc</Key><Muted size={12}>fechar</Muted>
          </View>
          {query ? <Muted size={12}>{resultsTxt(hits.length)}</Muted> : null}
        </View>
      ) : null}
    </View>
  );

  if (!wide) {
    return (
      <Animated.View entering={dialogIn} exiting={dialogOut} style={[StyleSheet.absoluteFill, st().layer, { backgroundColor: C.surface, paddingTop: insets.top }]}>
        {panel}
      </Animated.View>
    );
  }
  return (
    <View style={[StyleSheet.absoluteFill, st().layer]} pointerEvents="box-none">
      <Animated.View entering={backdropIn} exiting={backdropOut} style={[StyleSheet.absoluteFill, { backgroundColor: C.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar busca" />
      </Animated.View>
      <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + Math.min(96, height * 0.1), alignItems: 'center' }} pointerEvents="box-none">
        <Animated.View entering={dialogIn} exiting={dialogOut} style={[st().card, { maxHeight: height * 0.74 }]}>
          {panel}
        </Animated.View>
      </View>
    </View>
  );
}

const resultsTxt = (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`);

function Key({ children }: { children: string }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderBottomWidth: 2, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: C.bg }}>
      <Txt w="medium" size={11} color={C.muted}>{children}</Txt>
    </View>
  );
}

function Marked({ text, ranges, size, color, w = 'regular', lines }: {
  text: string; ranges: [number, number][]; size: number; color: string; w?: 'regular' | 'medium'; lines?: number;
}) {
  return (
    <Txt w={w} size={size} color={color} lines={lines}>
      {pieces(text, ranges).map((p, k) => (p.on
        ? <Text key={k} style={{ fontFamily: F.semibold, color: C.ink, backgroundColor: C.midSoft }}>{p.s}</Text>
        : <Text key={k}>{p.s}</Text>))}
    </Txt>
  );
}

function ResultRow({ entry, hit, selected, onPress, onHover }: {
  entry: SearchEntry; hit: Hit | null; selected: boolean; onPress: () => void; onHover: () => void;
}) {
  const accent = entry.tab ? ACCENT[entry.tab] : C.ink;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHover}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}. ${entry.sub}`}
      style={({ pressed }) => [st().row, (selected || pressed) && { backgroundColor: soft(accent) }]}>
      <View style={[st().ico, { backgroundColor: entry.tab ? soft(accent) : C.sunken }]}>
        <Icon name={entry.icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Marked text={entry.title} ranges={hit?.titleRanges || []} size={15} color={entry.done ? C.muted : C.ink} w="medium" lines={1} />
        {entry.sub ? <Muted size={12.5} lines={1}>{entry.sub}</Muted> : null}
        {hit?.snippet ? (
          <Txt size={12.5} color={C.muted} lines={2}>
            <Text style={{ fontFamily: F.medium }}>{hit.snippet.label}: </Text>
            {pieces(hit.snippet.text, hit.snippet.ranges).map((p, k) => (p.on
              ? <Text key={k} style={{ fontFamily: F.semibold, color: C.ink, backgroundColor: C.midSoft }}>{p.s}</Text>
              : <Text key={k}>{p.s}</Text>))}
          </Txt>
        ) : null}
      </View>
      {selected ? <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" size={14} color={C.muted} /></View> : null}
    </Pressable>
  );
}

const st = porTema(() => StyleSheet.create({
  layer: { zIndex: 1050, elevation: 1050 },
  card: {
    width: '100%', maxWidth: 640, backgroundColor: C.surface, borderRadius: 12, overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 24,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  input: { flex: 1, minWidth: 0, fontFamily: F.regular, fontSize: 17, color: C.ink, paddingVertical: 15 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.card },
  ico: { width: 36, height: 36, borderRadius: R.icon, alignItems: 'center', justifyContent: 'center' },
  foot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg,
  },
}));
