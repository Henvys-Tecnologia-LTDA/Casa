import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { faltamPorLista, tarefasAbertas, WIDGET_KEY, type ResumoWidget } from '@/lib/widget';

// O resumo que o widget desenha: o app grava a cada mudança; de hora em hora, com o app fechado,
// o widget relê do servidor o que o outro mudou (se não der, fica o último resumo).

export async function lerResumo(): Promise<ResumoWidget | null> {
  try {
    const v = await AsyncStorage.getItem(WIDGET_KEY);
    return v ? (JSON.parse(v) as ResumoWidget) : null;
  } catch { return null; }
}

export async function gravarResumo(r: ResumoWidget | null) {
  try {
    if (r) await AsyncStorage.setItem(WIDGET_KEY, JSON.stringify(r));
    else await AsyncStorage.removeItem(WIDGET_KEY);
  } catch {}
}

/** Relê tarefas e listas do servidor; sem sessão ou sem internet, devolve o resumo como estava. */
export async function resumoDoServidor(r: ResumoWidget): Promise<ResumoWidget> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return r;
    const [tk, sc, it, mk] = await Promise.all([
      supabase.from('tasks').select('title,due,done').eq('household_id', r.hid).eq('done', false).not('due', 'is', null),
      supabase.from('sections').select('id,list').eq('household_id', r.hid),
      supabase.from('items').select('section_id,bought').eq('household_id', r.hid).eq('bought', false),
      supabase.from('groceries').select('id', { count: 'exact', head: true }).eq('household_id', r.hid).eq('done', false),
    ]);
    if (tk.error || sc.error || it.error) return r;
    const n = faltamPorLista(sc.data ?? [], it.data ?? []);
    const novo: ResumoWidget = {
      ...r,
      tarefas: r.tarefas ? tarefasAbertas(tk.data ?? []) : null,
      listas: r.listas.map(l => ({ ...l, faltam: n[l.tab] })),
      mercado: mk.error ? r.mercado : mk.count ?? r.mercado,
      em: new Date().toISOString(),
    };
    await gravarResumo(novo);
    return novo;
  } catch { return r; }
}
