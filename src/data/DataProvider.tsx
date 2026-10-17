import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { favApt, secsOf } from '@/lib/calc';
import { uuid } from '@/lib/format';
import { friendlyError, supabase } from '@/lib/supabase';
import { resolveTabs } from '@/lib/tabs';
import {
  TABLES, type DataTables, type Household, type Member, type RowOf, type ShopList, type TableName, type TabKey, type Who,
} from '@/lib/types';
import { resumoWidget } from '@/lib/widget';
import { atualizarWidget } from '@/widget/atualizar';

import { isNetErr, loadCache, loadFila, saveCache, saveFila, type Op } from './offline';
import { useSession } from './session';

// Dados do casal aberto: carrega tudo do Supabase, aplica as mudanças em tempo real
// (Realtime, filtrado pelo casal) e faz as escritas com atualização otimista. Sem internet, abre com a
// cópia guardada no aparelho e põe as escritas numa fila que sobe quando a conexão volta (offline.ts).

type Status = 'connecting' | 'ok' | 'offline';

interface State {
  household: Household | null;
  members: Member[];
  t: DataTables;
  ready: boolean;
  status: Status;
  /** Mudanças feitas sem internet esperando para subir. */
  fila: number;
}

const emptyTables = (): DataTables => ({
  sections: [], items: [], tasks: [], apartments: [], trips: [],
  trip_costs: [], trip_deposits: [], packing_items: [], goals: [], goal_deposits: [], settlements: [],
});

// Valores padrão de cada tabela (os mesmos do banco), para a linha nova já aparecer completa.
const DEFAULTS: { [K in TableName]: Partial<RowOf<K>> } = {
  sections: { list: 'casa', icon: 'box', sort_order: 0, budget: 0 },
  items: {
    price: 0, qty: 1, priority: 'media', phase: '', coop: false, notes: '', image: '', store: '', link: '', options: [], chosen: '',
    bought: false, gift: false, paid: null, payer: '', parcelas: 1, parc_start: '', bought_by: null, bought_at: null, estimado: false,
  },
  tasks: { phase: '', who: '', due: null, notes: '', done: false, done_by: null, done_at: null },
  apartments: {
    address: '', link: '', status: 'visitar', price: 0, area: 0, rooms: 0, parking: 0, entrada: 0, fgts: 0, entrada_tipo: 'vista',
    entrada_parcelas: 24, inicio: 'depois', inicio_mes: '', taxa: 11.5, prazo: 360, seguro: 0, sistema: 'SAC', condo: 0, iptu: 0,
    itbi: 3, cartorio: 1.5, notes: '', image: '', likes: [], favorite: false,
  },
  trips: { destination: '', start_date: null, end_date: null, status: 'planejando', people: 2, notes: '', image: '', likes: [] },
  trip_costs: { descr: '', cat: 'outros', amount: 0, parcelas: 1, parc_start: '', paid: false, payer: '' },
  trip_deposits: { by_user: null },
  packing_items: { done: false },
  goals: { target: 0, deadline: '' },
  goal_deposits: { who: 'ambos', by_user: null },
  settlements: { note: '', by_user: null },
};
// O que o banco apaga junto (on delete cascade), para o desfazer recolocar.
const CHILDREN: Partial<Record<TableName, [TableName, string][]>> = {
  sections: [['items', 'section_id']],
  trips: [['trip_costs', 'trip_id'], ['trip_deposits', 'trip_id'], ['packing_items', 'trip_id']],
  goals: [['goal_deposits', 'goal_id']],
};
const NO_UPDATED_AT = new Set<TableName>(['trip_deposits', 'goal_deposits', 'settlements']);

// O Postgres manda "numeric" como número, mas por garantia convertemos textos numéricos.
const NUMERIC = new Set([
  'price', 'paid', 'budget', 'renda', 'budget_casa', 'budget_switch', 'amount', 'target', 'area', 'entrada', 'fgts',
  'taxa', 'seguro', 'condo', 'iptu', 'itbi', 'cartorio',
]);
function normalize<T>(row: T): T {
  const r: any = { ...(row as any) };
  for (const k of Object.keys(r)) if (NUMERIC.has(k) && typeof r[k] === 'string') r[k] = Number(r[k]);
  if ('options' in r && !Array.isArray(r.options)) r.options = [];
  if ('likes' in r && !Array.isArray(r.likes)) r.likes = [];
  if ('tabs' in r && (!r.tabs || typeof r.tabs !== 'object' || Array.isArray(r.tabs))) r.tabs = {};
  return r as T;
}

// Executa uma mudança da fila. Linha que já existe (subiu antes de a conexão cair) conta como feita.
async function runOp(op: Op) {
  const q = supabase.from(op.table);
  const { error } = op.k === 'insert' ? await q.insert(op.row as any)
    : op.k === 'update' ? await q.update(op.patch as any).eq('id', op.id)
      : await q.delete().eq('id', op.id);
  if (error && !(op.k === 'insert' && error.code === '23505')) throw error;
}

class Store {
  state: State = { household: null, members: [], t: emptyTables(), ready: false, status: 'connecting', fila: 0 };
  ops: Op[] = [];
  flushing = false;
  init: Promise<void> | null = null;
  setQueue(ops: Op[]) { this.ops = ops; }
  setFlushing(v: boolean) { this.flushing = v; }
  setInit(p: Promise<void>) { this.init = p; }
  private listeners = new Set<() => void>();
  pending = new Map<string, number>();
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  get = () => this.state;
  set(fn: (s: State) => State) {
    this.state = fn(this.state);
    this.listeners.forEach(l => l());
  }
  bump(id: string, d: number) {
    const n = (this.pending.get(id) || 0) + d;
    if (n <= 0) this.pending.delete(id); else this.pending.set(id, n);
  }
  isPending = (id: string) => (this.pending.get(id) || 0) > 0;
  find<T extends TableName>(table: T, id: string): RowOf<T> | undefined {
    return (this.state.t[table] as RowOf<T>[]).find(r => r.id === id);
  }
  upsert<T extends TableName>(table: T, row: RowOf<T>) {
    this.set(s => {
      const list = s.t[table] as RowOf<T>[];
      const i = list.findIndex(r => r.id === row.id);
      const next = i >= 0 ? list.map((r, k) => (k === i ? row : r)) : [...list, row];
      return { ...s, t: { ...s.t, [table]: next } };
    });
  }
  remove(table: TableName, id: string) {
    this.set(s => {
      const list = s.t[table] as { id: string }[];
      if (!list.some(r => r.id === id)) return s;
      return { ...s, t: { ...s.t, [table]: list.filter(r => r.id !== id) } };
    });
  }
}

interface DataCtx {
  store: Store;
  hid: string;
  me: string;
  insert: <T extends TableName>(table: T, row: Partial<RowOf<T>>) => Promise<RowOf<T>>;
  update: <T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) => Promise<void>;
  remove: (table: TableName, id: string) => Promise<void>;
  /** Apaga e devolve como desfazer: recoloca a linha e o que saiu junto (itens do cômodo, custos da viagem…). */
  removeUndo: (table: TableName, id: string) => Promise<() => Promise<void>>;
  updateHousehold: (patch: Partial<Pick<Household, 'name' | 'name_a' | 'name_b' | 'renda' | 'budget_casa' | 'budget_switch' | 'photo' | 'tabs'>>) => Promise<void>;
  updateMyName: (name: string) => Promise<void>;
  updateMyNotify: (patch: Partial<Pick<Member, 'notify_paused' | 'notify_off'>>) => Promise<void>;
  regenerateInvite: () => Promise<string>;
  reload: () => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ hid, children }: { hid: string; children: ReactNode }) {
  const { session, refreshMemberships } = useSession();
  const me = session?.user.id ?? '';
  const [store] = useState(() => new Store());

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase.from('household_members').select('*').eq('household_id', hid);
    if (!error && data) store.set(s => ({ ...s, members: data as Member[] }));
  }, [hid, store]);

  const reload = useCallback(async () => {
    if (store.init) await store.init;
    const [h, m, ...rest] = await Promise.all([
      supabase.from('households').select('*').eq('id', hid).maybeSingle(),
      supabase.from('household_members').select('*').eq('household_id', hid),
      ...TABLES.map(t => supabase.from(t).select('*').eq('household_id', hid).order('created_at', { ascending: true })),
    ]);
    const failed = h.error || m.error || rest.some(r => r.error);
    if (failed) {
      store.set(s => ({ ...s, status: 'offline' }));
      return;
    }
    if (!h.data) {
      // Este usuário não é mais membro deste casal.
      refreshMemberships();
      return;
    }
    const t = emptyTables();
    TABLES.forEach((name, k) => {
      const rows = ((rest[k].data || []) as any[]).map(normalize);
      // Mantém a versão local de linhas com escrita em andamento.
      (t as any)[name] = rows.map(r => (store.isPending(r.id) ? store.find(name, r.id) ?? r : r));
      for (const local of store.state.t[name] as { id: string }[]) {
        if (store.isPending(local.id) && !rows.some(r => r.id === local.id)) (t as any)[name].push(local);
      }
    });
    // Leu do servidor sem nada na fila: se estava "sem conexão", já voltou.
    const voltou = (st: Status) => (st === 'offline' && !store.ops.length ? 'ok' : st);
    store.set(s => ({ ...s, household: normalize(h.data as Household), members: (m.data || []) as Member[], t, ready: true, status: voltou(s.status) }));
  }, [hid, store, refreshMemberships]);

  // Fila do que foi feito sem internet: guarda no aparelho e sobe em ordem quando der.
  const setOps = useCallback((ops: Op[]) => {
    store.setQueue(ops);
    saveFila(hid, ops);
    store.set(s => ({ ...s, fila: ops.length }));
  }, [hid, store]);
  const enqueue = useCallback((op: Op) => {
    setOps([...store.ops, op]);
    store.set(s => ({ ...s, status: 'offline' }));
  }, [store, setOps]);
  const flush = useCallback(async () => {
    if (store.flushing || !store.ops.length) return;
    store.setFlushing(true);
    let feitos = 0;
    try {
      while (store.ops.length) {
        const op = store.ops[0];
        try {
          await runOp(op);
        } catch (e) {
          if (isNetErr(e)) break; // ainda sem internet: tenta de novo depois
          console.warn('fila: mudança recusada pelo servidor, descartada', op.k, op.table, e);
        }
        store.bump(op.id, -1);
        setOps(store.ops.slice(1));
        feitos++;
      }
    } finally {
      store.setFlushing(false);
    }
    if (feitos) await reload();
  }, [store, setOps, reload]);

  useEffect(() => {
    let cancelled = false;
    // Antes do primeiro carregamento: a cópia guardada (abre mesmo sem internet) e a fila pendente.
    store.setInit((async () => {
      const [cache, ops] = await Promise.all([loadCache(hid), loadFila(hid)]);
      if (cancelled) return;
      store.setQueue(ops);
      for (const op of ops) store.bump(op.id, 1);
      store.set(s => (cache && !s.ready
        ? { ...s, household: cache.household, members: cache.members ?? [], t: { ...emptyTables(), ...cache.t }, ready: true, fila: ops.length }
        : { ...s, fila: ops.length }));
    })());
    const sync = () => { if (store.ops.length) flush(); else reload(); };
    const onRow = (table: TableName, row: any) => {
      if (!row?.id || row.household_id !== hid || store.isPending(row.id)) return;
      store.upsert(table, normalize(row));
    };
    const onDelete = (table: TableName, old: any) => {
      if (old?.id && !store.isPending(old.id)) store.remove(table, old.id);
    };
    const ch = supabase.channel(`casa:${hid}:${uuid().slice(0, 8)}`);
    for (const table of TABLES) {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `household_id=eq.${hid}` }, p => onRow(table, p.new));
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `household_id=eq.${hid}` }, p => onRow(table, p.new));
      // Exclusões não aceitam filtro no Realtime: chega só o id, e só removemos se a linha estiver aqui.
      ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, p => onDelete(table, p.old));
    }
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, p => {
      if (p.new && !store.isPending(hid)) store.set(s => ({ ...s, household: normalize(p.new as Household) }));
    });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${hid}` }, () => { loadMembers(); });
    ch.subscribe(status => {
      if (cancelled) return;
      if (status === 'SUBSCRIBED') {
        store.set(s => ({ ...s, status: 'ok' }));
        sync(); // sobe a fila e pega o que mudou enquanto estava desconectado
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        store.set(s => ({ ...s, status: 'offline' }));
      }
    });
    reload().then(() => flush());
    const sub = AppState.addEventListener('change', st => { if (st === 'active') sync(); });
    // Com fila parada, tenta de novo a cada 20 s; no navegador, também quando a conexão volta.
    const timer = setInterval(() => { if (store.ops.length) flush(); }, 20000);
    const online = () => sync();
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', online);
    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(timer);
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('online', online);
      supabase.removeChannel(ch);
    };
  }, [hid, store, reload, loadMembers, flush]);

  // Cópia no aparelho, salva pouco depois de cada mudança (e o resumo do widget do Android).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = store.subscribe(() => {
      if (!store.state.ready) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const s = store.state;
        saveCache(hid, { household: s.household, members: s.members, t: s.t });
        const tabs = resolveTabs(s.household);
        atualizarWidget(resumoWidget(hid, s.t, { label: k => tabs[k].label, hidden: k => !!tabs[k].hidden }));
      }, 1500);
    });
    return () => { unsub(); if (t) clearTimeout(t); };
  }, [hid, store]);

  const insert = useCallback(async <T extends TableName>(table: T, row: Partial<RowOf<T>>): Promise<RowOf<T>> => {
    const now = new Date().toISOString();
    const full = {
      ...DEFAULTS[table], id: uuid(), household_id: hid, created_at: now,
      ...(NO_UPDATED_AT.has(table) ? {} : { updated_at: now }), ...row,
    } as RowOf<T>;
    store.upsert(table, full);
    store.bump(full.id, 1);
    const queue = () => { enqueue({ k: 'insert', table, id: full.id, row: full as unknown as Record<string, unknown> }); return full; };
    if (store.ops.length) { queue(); flush(); return full; } // fila andando: entra atrás, para manter a ordem
    try {
      const { data, error } = await supabase.from(table).insert(full as any).select().single();
      if (error) throw error;
      store.bump(full.id, -1);
      const saved = normalize(data as RowOf<T>);
      if (!store.isPending(full.id)) store.upsert(table, saved);
      return saved;
    } catch (e) {
      if (isNetErr(e)) return queue();
      store.bump(full.id, -1);
      store.remove(table, full.id);
      throw new Error(friendlyError(e));
    }
  }, [hid, store, enqueue, flush]);

  const update = useCallback(async <T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) => {
    const prev = store.find(table, id);
    if (prev) store.upsert(table, { ...prev, ...patch } as RowOf<T>);
    store.bump(id, 1);
    const queue = () => enqueue({ k: 'update', table, id, patch: patch as Record<string, unknown> });
    if (store.ops.length) { queue(); flush(); return; }
    try {
      const { data, error } = await supabase.from(table).update(patch as any).eq('id', id).select().maybeSingle();
      if (error) throw error;
      store.bump(id, -1);
      if (data && !store.isPending(id)) store.upsert(table, normalize(data as RowOf<T>));
    } catch (e) {
      if (isNetErr(e)) { queue(); return; }
      store.bump(id, -1);
      if (prev && !store.isPending(id)) store.upsert(table, prev);
      throw new Error(friendlyError(e));
    }
  }, [store, enqueue, flush]);

  const remove = useCallback(async (table: TableName, id: string) => {
    const prev = store.find(table, id);
    store.remove(table, id);
    store.bump(id, 1);
    const queue = () => enqueue({ k: 'delete', table, id });
    if (store.ops.length) { queue(); flush(); return; }
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      store.bump(id, -1);
    } catch (e) {
      if (isNetErr(e)) { queue(); return; }
      store.bump(id, -1);
      if (prev) store.upsert(table, prev as any);
      throw new Error(friendlyError(e));
    }
  }, [store, enqueue, flush]);

  const removeUndo = useCallback<DataCtx['removeUndo']>(async (table, id) => {
    const row = store.find(table, id);
    const kids = (CHILDREN[table] ?? []).map(([t, fk]) => [t, (store.state.t[t] as any[]).filter(r => r[fk] === id)] as const);
    await remove(table, id);
    for (const [t, rows] of kids) for (const r of rows) store.remove(t, r.id);
    return async () => {
      if (row) await insert(table, row as any);
      for (const [t, rows] of kids) for (const r of rows) await insert(t, r);
    };
  }, [store, remove, insert]);

  const updateHousehold = useCallback<DataCtx['updateHousehold']>(async patch => {
    const prev = store.state.household;
    if (prev) store.set(s => ({ ...s, household: { ...prev, ...patch } }));
    store.bump(hid, 1);
    try {
      const { data, error } = await supabase.from('households').update(patch).eq('id', hid).select().maybeSingle();
      if (error) throw error;
      store.bump(hid, -1);
      if (data) store.set(s => ({ ...s, household: normalize(data as Household) }));
    } catch (e) {
      store.bump(hid, -1);
      if (prev) store.set(s => ({ ...s, household: prev }));
      throw new Error(friendlyError(e));
    }
  }, [hid, store]);

  const updateMyName = useCallback(async (name: string) => {
    const { error } = await supabase.from('household_members').update({ display_name: name.trim().slice(0, 60) })
      .eq('household_id', hid).eq('user_id', me);
    if (error) throw new Error(friendlyError(error));
    await loadMembers();
    refreshMemberships();
  }, [hid, me, loadMembers, refreshMemberships]);

  // Preferências de avisos de quem está usando o app, neste casal (otimista; o Realtime confirma).
  const updateMyNotify = useCallback<DataCtx['updateMyNotify']>(async patch => {
    const prev = store.state.members;
    store.set(s => ({ ...s, members: s.members.map(m => (m.user_id === me ? { ...m, ...patch } : m)) }));
    const { error } = await supabase.from('household_members').update(patch).eq('household_id', hid).eq('user_id', me);
    if (error) {
      store.set(s => ({ ...s, members: prev }));
      throw new Error(friendlyError(error));
    }
  }, [hid, me, store]);

  const regenerateInvite = useCallback(async () => {
    const { data, error } = await supabase.rpc('regenerate_invite', { p_household: hid });
    if (error) throw new Error(friendlyError(error));
    const code = String(data || '');
    store.set(s => (s.household ? { ...s, household: { ...s.household, invite_code: code } } : s));
    return code;
  }, [hid, store]);

  const value = useMemo<DataCtx>(() => ({
    store, hid, me, insert, update, remove, removeUndo, updateHousehold, updateMyName, updateMyNotify, regenerateInvite, reload,
  }), [store, hid, me, insert, update, remove, removeUndo, updateHousehold, updateMyName, updateMyNotify, regenerateInvite, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActions() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useActions fora do DataProvider');
  return c;
}

// Estado completo + atalhos usados nas telas.
export function useData() {
  const c = useActions();
  const state = useSyncExternalStore(c.store.subscribe, c.store.get, c.store.get);
  return useMemo(() => {
    const { t, household, members } = state;
    const nm = (k: 'a' | 'b') => (k === 'a' ? household?.name_a : household?.name_b)?.trim() || (k === 'a' ? 'Pessoa 1' : 'Pessoa 2');
    const whoLabel = (w: Who | string | null | undefined) => (w === 'a' ? nm('a') : w === 'b' ? nm('b') : w === 'ambos' ? 'Os dois' : '');
    const memberName = (uid: string | null | undefined) => {
      if (!uid) return '';
      if (uid === c.me) return 'você';
      const m = members.find(x => x.user_id === uid);
      return m?.display_name?.trim().split(/\s+/)[0] || 'alguém';
    };
    const secs = (list: ShopList) => secsOf(t.sections, list);
    const secById = (id: string | null | undefined) => t.sections.find(s => s.id === id);
    const itemsOf = (secId: string) => t.items.filter(i => i.section_id === secId);
    const listItems = (list: ShopList) => {
      const ids = new Set(secs(list).map(s => s.id));
      return t.items.filter(i => ids.has(i.section_id));
    };
    const listOfItem = (i: { section_id: string }) => secById(i.section_id)?.list;
    const costsOf = (tripId: string) => t.trip_costs.filter(x => x.trip_id === tripId);
    const depsOf = (tripId: string) => t.trip_deposits.filter(x => x.trip_id === tripId);
    const packOf = (tripId: string) => t.packing_items.filter(x => x.trip_id === tripId);
    const goalDeps = (goalId: string) => t.goal_deposits.filter(x => x.goal_id === goalId);
    const renda = Number(household?.renda) || 0;
    const listBudget = (list: ShopList) => Number(list === 'casa' ? household?.budget_casa : household?.budget_switch) || 0;
    const tabs = resolveTabs(household);
    const tabLabel = (k: TabKey) => tabs[k].label;
    return {
      ...state, me: c.me, nm, whoLabel, memberName, secs, secById, itemsOf, listItems, listOfItem,
      costsOf, depsOf, packOf, goalDeps, renda, listBudget, fav: favApt(t.apartments), tabs, tabLabel,
    };
  }, [state, c.me]);
}

export type Data = ReturnType<typeof useData>;
