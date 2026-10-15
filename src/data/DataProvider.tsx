import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { favApt, secsOf } from '@/lib/calc';
import { uuid } from '@/lib/format';
import { friendlyError, supabase } from '@/lib/supabase';
import {
  TABLES, type DataTables, type Household, type Member, type RowOf, type ShopList, type TableName, type Who,
} from '@/lib/types';

import { useSession } from './session';

// Dados do casal aberto: carrega tudo do Supabase, aplica as mudanças em tempo real
// (Realtime, filtrado pelo casal) e faz as escritas com atualização otimista.

type Status = 'connecting' | 'ok' | 'offline';

interface State {
  household: Household | null;
  members: Member[];
  t: DataTables;
  ready: boolean;
  status: Status;
}

const emptyTables = (): DataTables => ({
  sections: [], items: [], tasks: [], apartments: [], trips: [],
  trip_costs: [], trip_deposits: [], packing_items: [], goals: [], goal_deposits: [],
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
  trip_costs: { descr: '', cat: 'outros', amount: 0, parcelas: 1, parc_start: '', paid: false },
  trip_deposits: { by_user: null },
  packing_items: { done: false },
  goals: { target: 0, deadline: '' },
  goal_deposits: { who: 'ambos', by_user: null },
};
const NO_UPDATED_AT = new Set<TableName>(['trip_deposits', 'goal_deposits']);

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
  return r as T;
}

class Store {
  state: State = { household: null, members: [], t: emptyTables(), ready: false, status: 'connecting' };
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
  updateHousehold: (patch: Partial<Pick<Household, 'name' | 'name_a' | 'name_b' | 'renda' | 'budget_casa' | 'budget_switch'>>) => Promise<void>;
  updateMyName: (name: string) => Promise<void>;
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
    store.set(s => ({ ...s, household: normalize(h.data as Household), members: (m.data || []) as Member[], t, ready: true }));
  }, [hid, store, refreshMemberships]);

  useEffect(() => {
    let cancelled = false;
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
        reload(); // pega o que mudou enquanto estava desconectado
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        store.set(s => ({ ...s, status: 'offline' }));
      }
    });
    reload();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') reload(); });
    return () => {
      cancelled = true;
      sub.remove();
      supabase.removeChannel(ch);
    };
  }, [hid, store, reload, loadMembers]);

  const insert = useCallback(async <T extends TableName>(table: T, row: Partial<RowOf<T>>): Promise<RowOf<T>> => {
    const now = new Date().toISOString();
    const full = {
      ...DEFAULTS[table], id: uuid(), household_id: hid, created_at: now,
      ...(NO_UPDATED_AT.has(table) ? {} : { updated_at: now }), ...row,
    } as RowOf<T>;
    store.upsert(table, full);
    store.bump(full.id, 1);
    try {
      const { data, error } = await supabase.from(table).insert(full as any).select().single();
      if (error) throw error;
      store.bump(full.id, -1);
      const saved = normalize(data as RowOf<T>);
      if (!store.isPending(full.id)) store.upsert(table, saved);
      return saved;
    } catch (e) {
      store.bump(full.id, -1);
      store.remove(table, full.id);
      throw new Error(friendlyError(e));
    }
  }, [hid, store]);

  const update = useCallback(async <T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) => {
    const prev = store.find(table, id);
    if (prev) store.upsert(table, { ...prev, ...patch } as RowOf<T>);
    store.bump(id, 1);
    try {
      const { data, error } = await supabase.from(table).update(patch as any).eq('id', id).select().maybeSingle();
      if (error) throw error;
      store.bump(id, -1);
      if (data && !store.isPending(id)) store.upsert(table, normalize(data as RowOf<T>));
    } catch (e) {
      store.bump(id, -1);
      if (prev && !store.isPending(id)) store.upsert(table, prev);
      throw new Error(friendlyError(e));
    }
  }, [store]);

  const remove = useCallback(async (table: TableName, id: string) => {
    const prev = store.find(table, id);
    store.remove(table, id);
    store.bump(id, 1);
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      if (prev) store.upsert(table, prev as any);
      throw new Error(friendlyError(e));
    } finally {
      store.bump(id, -1);
    }
  }, [store]);

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

  const regenerateInvite = useCallback(async () => {
    const { data, error } = await supabase.rpc('regenerate_invite', { p_household: hid });
    if (error) throw new Error(friendlyError(error));
    const code = String(data || '');
    store.set(s => (s.household ? { ...s, household: { ...s.household, invite_code: code } } : s));
    return code;
  }, [hid, store]);

  const value = useMemo<DataCtx>(() => ({
    store, hid, me, insert, update, remove, updateHousehold, updateMyName, regenerateInvite, reload,
  }), [store, hid, me, insert, update, remove, updateHousehold, updateMyName, regenerateInvite, reload]);

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
    return {
      ...state, me: c.me, nm, whoLabel, memberName, secs, secById, itemsOf, listItems, listOfItem,
      costsOf, depsOf, packOf, goalDeps, renda, listBudget, fav: favApt(t.apartments),
    };
  }, [state, c.me]);
}

export type Data = ReturnType<typeof useData>;
