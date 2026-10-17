import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DataTables, Household, Member, TableName } from '@/lib/types';

// Sem internet (como o Google Docs offline): o app guarda uma cópia dos dados do casal no aparelho e
// uma fila do que foi mexido sem conexão. A fila sobe em ordem quando a internet volta.

export type Op =
  | { k: 'insert'; table: TableName; id: string; row: Record<string, unknown> }
  | { k: 'update'; table: TableName; id: string; patch: Record<string, unknown> }
  | { k: 'delete'; table: TableName; id: string };

export interface Cache { household: Household | null; members: Member[]; t: DataTables }

const cacheKey = (hid: string) => `casa.cache.${hid}`;
const filaKey = (hid: string) => `casa.fila.${hid}`;

/** Erro de rede (sem internet, servidor fora do ar), e não um "não pode" do banco. */
export function isNetErr(e: unknown): boolean {
  const x = e as { message?: string; code?: string; name?: string } | null;
  if (x?.code && /^[0-9A-Z]{5}$/.test(x.code)) return false; // erro do Postgres (RLS, validação…)
  return /failed to fetch|network request failed|networkerror|network error|fetch failed|load failed|timed? ?out|aborted/i.test(`${x?.name ?? ''} ${x?.message ?? ''}`);
}

export async function loadCache(hid: string): Promise<Cache | null> {
  try {
    const v = await AsyncStorage.getItem(cacheKey(hid));
    return v ? (JSON.parse(v) as Cache) : null;
  } catch { return null; }
}

export function saveCache(hid: string, c: Cache) {
  AsyncStorage.setItem(cacheKey(hid), JSON.stringify(c)).catch(() => {});
}

export async function loadFila(hid: string): Promise<Op[]> {
  try {
    const v = await AsyncStorage.getItem(filaKey(hid));
    const ops = v ? JSON.parse(v) : [];
    return Array.isArray(ops) ? ops : [];
  } catch { return []; }
}

export function saveFila(hid: string, ops: Op[]) {
  (ops.length ? AsyncStorage.setItem(filaKey(hid), JSON.stringify(ops)) : AsyncStorage.removeItem(filaKey(hid))).catch(() => {});
}

/** Ao sair da conta: a cópia e a fila não ficam no aparelho. */
export async function clearOffline() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(k => k.startsWith('casa.cache.') || k.startsWith('casa.fila.'));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {}
}
