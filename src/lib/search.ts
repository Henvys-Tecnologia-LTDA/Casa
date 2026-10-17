import { CAT, PHASE, STATUS, TSTATUS_L } from './calc';
import { money, norm } from './format';
import type { DataTables, TabKey } from './types';

// Busca geral do casal, no jeito da busca do Miro: um campo só acha qualquer coisa (itens, cômodos,
// tarefas, apês, viagens, custos, mala e metas), filtra por tipo, mostra onde o termo apareceu e
// leva direto até o objeto. Sem React aqui, para dar para testar no Node (scripts/check-search.ts).

export type SearchKind = 'item' | 'section' | 'task' | 'apt' | 'trip' | 'cost' | 'pack' | 'goal' | 'tab' | 'ajustes' | 'atividade' | 'criar';
export type SearchGroup = 'abas' | 'itens' | 'comodos' | 'tarefas' | 'apes' | 'viagens' | 'metas';

export const GROUPS: [SearchGroup, string][] = [
  ['abas', 'Atalhos'], ['itens', 'Itens'], ['comodos', 'Cômodos e seções'], ['tarefas', 'Tarefas'],
  ['apes', 'Apês'], ['viagens', 'Viagens'], ['metas', 'Metas'],
];

/** Campo além do título onde o termo pode aparecer (loja, observações, endereço...). */
export interface SearchField { label: string; text: string }

export interface SearchEntry {
  kind: SearchKind;
  id: string;
  tab: TabKey | null;
  group: SearchGroup;
  icon: string;
  title: string;
  sub: string;
  fields: SearchField[];
  /** Comprado, feito, descartado ou viagem que já aconteceu: aparece depois dos outros. */
  done: boolean;
  updated: string;
  /** Viagem dona do custo ou do item da mala. */
  parent?: string;
}

type Range = [number, number];

export interface Hit {
  entry: SearchEntry;
  score: number;
  titleRanges: Range[];
  /** Campo onde o termo apareceu, já recortado em volta do trecho, quando não foi (só) no título. */
  snippet: { label: string; text: string; ranges: Range[] } | null;
}

export interface IndexCtx {
  tabLabel: (k: TabKey) => string;
  tabIcon: (k: TabKey) => string;
  tabHint: (k: TabKey) => string;
  hidden: (k: TabKey) => boolean;
  tabs: TabKey[];
}

const STATUS_L: Record<string, string> = Object.fromEntries(STATUS);
const join = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(' · ');
const fields = (...f: [string, unknown][]) => f.filter(([, v]) => String(v ?? '').trim()).map(([label, v]) => ({ label, text: String(v).trim() }));

export function buildIndex(t: DataTables, ctx: IndexCtx): SearchEntry[] {
  const out: SearchEntry[] = [];
  const on = (k: TabKey) => !ctx.hidden(k);

  for (const k of ctx.tabs) {
    if (on(k)) out.push({ kind: 'tab', id: k, tab: k, group: 'abas', icon: ctx.tabIcon(k), title: `Ir para ${ctx.tabLabel(k)}`, sub: ctx.tabHint(k), fields: [], done: false, updated: '' });
  }
  out.push({ kind: 'atividade', id: 'atividade', tab: null, group: 'abas', icon: 'clock', title: 'O que mudou', sub: 'O que cada um fez nos últimos 30 dias', fields: [], done: false, updated: '' });
  out.push({ kind: 'ajustes', id: 'ajustes', tab: null, group: 'abas', icon: 'sliders', title: 'Ajustes do casal', sub: 'Foto, nomes, abas, tetos de gastos e avisos', fields: [], done: false, updated: '' });

  const secs = new Map(t.sections.map(s => [s.id, s]));
  const count = new Map<string, number>();
  for (const i of t.items) count.set(i.section_id, (count.get(i.section_id) || 0) + 1);

  for (const s of t.sections) {
    if (!on(s.list)) continue;
    const n = count.get(s.id) || 0;
    out.push({
      kind: 'section', id: s.id, tab: s.list, group: 'comodos', icon: s.icon || 'box', title: s.name,
      sub: join(ctx.tabLabel(s.list), n === 1 ? '1 item' : `${n} itens`), fields: [], done: false, updated: s.updated_at,
    });
  }

  for (const i of t.items) {
    const s = secs.get(i.section_id);
    if (!s || !on(s.list)) continue;
    const opts = (i.options || []).flatMap(o => fields(['Opção', o.name], ['Loja da opção', o.store]));
    out.push({
      kind: 'item', id: i.id, tab: s.list, group: 'itens', icon: s.icon || 'box', title: i.name,
      sub: join(`${ctx.tabLabel(s.list)} › ${s.name}`, Number(i.price) ? money((Number(i.price) || 0) * (Number(i.qty) || 1)) : '', i.bought && 'comprado'),
      fields: [...fields(['Loja', i.store], ['Obs.', i.notes]), ...opts], done: !!i.bought, updated: i.updated_at,
    });
  }

  if (on('mudanca')) {
    for (const x of t.tasks) {
      out.push({
        kind: 'task', id: x.id, tab: 'mudanca', group: 'tarefas', icon: 'check', title: x.title,
        sub: join(ctx.tabLabel('mudanca'), x.phase && PHASE[x.phase], x.done && 'feita'), fields: fields(['Obs.', x.notes]),
        done: !!x.done, updated: x.updated_at,
      });
    }
  }

  if (on('ape')) {
    for (const a of t.apartments) {
      out.push({
        kind: 'apt', id: a.id, tab: 'ape', group: 'apes', icon: 'building', title: a.name,
        sub: join(STATUS_L[a.status], Number(a.price) ? money(a.price) : ''), fields: fields(['Endereço', a.address], ['Obs.', a.notes]),
        done: a.status === 'descartado', updated: a.updated_at,
      });
    }
  }

  if (on('viagem')) {
    const trips = new Map(t.trips.map(x => [x.id, x]));
    for (const x of t.trips) {
      out.push({
        kind: 'trip', id: x.id, tab: 'viagem', group: 'viagens', icon: 'suitcase', title: x.name,
        sub: join(x.destination, TSTATUS_L[x.status]), fields: fields(['Destino', x.destination], ['Obs.', x.notes]),
        done: x.status === 'feita', updated: x.updated_at,
      });
    }
    for (const c of t.trip_costs) {
      const trip = trips.get(c.trip_id);
      if (!trip) continue;
      out.push({
        kind: 'cost', id: c.id, tab: 'viagem', group: 'viagens', icon: CAT[c.cat]?.ic || 'wallet', title: c.descr || CAT[c.cat]?.t || 'Custo',
        sub: join(`Custo de ${trip.name}`, money(c.amount), c.paid && 'pago'), fields: fields(['Categoria', CAT[c.cat]?.t]),
        done: false, updated: c.updated_at, parent: trip.id,
      });
    }
    for (const p of t.packing_items) {
      const trip = trips.get(p.trip_id);
      if (!trip) continue;
      out.push({
        kind: 'pack', id: p.id, tab: 'viagem', group: 'viagens', icon: 'suitcase', title: p.text,
        sub: join(`Mala de ${trip.name}`, p.done && 'na mala'), fields: [], done: !!p.done, updated: p.updated_at, parent: trip.id,
      });
    }
  }

  if (on('dinheiro')) {
    for (const g of t.goals) {
      out.push({
        kind: 'goal', id: g.id, tab: 'dinheiro', group: 'metas', icon: 'flag', title: g.name,
        sub: join(`Meta de ${money(g.target)}`, g.deadline && `até ${g.deadline.split('-').reverse().join('/')}`), fields: [],
        done: false, updated: g.updated_at,
      });
    }
  }
  return out;
}

/* ---------- busca ---------- */

// Texto sem acento e em minúsculas, com o índice de cada letra no texto original,
// para marcar o trecho certo mesmo quando a palavra tinha acento.
function normWithMap(s: string): { n: string; map: number[] } {
  let n = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of s) {
    for (const c of norm(ch)) {
      n += c;
      map.push(i);
    }
    i += ch.length;
  }
  map.push(s.length);
  return { n, map };
}

function rangesOf(text: string, terms: string[]): Range[] {
  const { n, map } = normWithMap(text);
  const r: Range[] = [];
  for (const term of terms) {
    for (let at = n.indexOf(term); at >= 0; at = n.indexOf(term, at + term.length)) r.push([map[at], map[at + term.length]]);
  }
  r.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const x of r) {
    const last = merged[merged.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else merged.push([x[0], x[1]]);
  }
  return merged;
}

const wordStart = (hay: string, term: string) => hay.startsWith(term) || hay.includes(` ${term}`) || hay.includes(`-${term}`);

// Recorta um texto longo (observações) em volta do primeiro trecho achado.
function cut(text: string, ranges: Range[], before = 24, max = 90) {
  if (text.length <= max || !ranges.length) return { text, ranges };
  const start = Math.max(0, ranges[0][0] - before);
  const end = Math.min(text.length, start + max);
  const pre = start > 0 ? '…' : '';
  const shift = pre.length - start;
  return {
    text: pre + text.slice(start, end).trimEnd() + (end < text.length ? '…' : ''),
    ranges: ranges.filter(([a]) => a < end).map(([a, b]): Range => [a + shift, Math.min(b, end) + shift]),
  };
}

export function search(entries: SearchEntry[], query: string, group: SearchGroup | 'tudo' = 'tudo'): Hit[] {
  const q = norm(query).trim().replace(/\s+/g, ' ');
  const terms = [...new Set(q.split(' ').filter(Boolean))];
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const e of entries) {
    if (group !== 'tudo' && e.group !== group) continue;
    const title = norm(e.title);
    const fs = e.fields.map(f => ({ f, n: norm(f.text) }));
    // Todas as palavras precisam aparecer em algum lugar (título ou outro campo).
    if (!terms.every(term => title.includes(term) || fs.some(x => x.n.includes(term)))) continue;

    let score = 0;
    for (const term of terms) {
      if (title.startsWith(term)) score += 30;
      else if (wordStart(title, term)) score += 20;
      else if (title.includes(term)) score += 10;
      else score += 3;
    }
    if (terms.length > 1 && title.includes(q)) score += 15;
    if (title === q) score += 25;
    if (e.kind === 'tab' || e.kind === 'ajustes') score -= 4;

    const outside = terms.filter(term => !title.includes(term));
    const shown = fs.find(x => (outside.length ? outside : terms).some(term => x.n.includes(term)));
    const snippet = shown && (outside.length || !terms.every(term => title.includes(term)))
      ? { label: shown.f.label, ...cut(shown.f.text, rangesOf(shown.f.text, terms)) }
      : null;
    hits.push({ entry: e, score, titleRanges: rangesOf(e.title, terms), snippet });
  }
  return hits.sort((a, b) =>
    b.score - a.score
    || Number(a.entry.done) - Number(b.entry.done)
    || b.entry.updated.localeCompare(a.entry.updated)
    || a.entry.title.localeCompare(b.entry.title));
}

/** Quantos resultados cada tipo tem (para os filtros). */
export function countByGroup(entries: SearchEntry[], query: string): Record<SearchGroup | 'tudo', number> {
  const all = search(entries, query);
  const c = { tudo: all.length } as Record<SearchGroup | 'tudo', number>;
  for (const [g] of GROUPS) c[g] = 0;
  for (const h of all) c[h.entry.group]++;
  return c;
}

/** Corta o texto em pedaços marcados e não marcados, para desenhar o destaque. */
export function pieces(text: string, ranges: Range[]): { s: string; on: boolean }[] {
  const out: { s: string; on: boolean }[] = [];
  let at = 0;
  for (const [a, b] of ranges) {
    if (a > at) out.push({ s: text.slice(at, a), on: false });
    out.push({ s: text.slice(a, b), on: true });
    at = b;
  }
  if (at < text.length) out.push({ s: text.slice(at), on: false });
  return out;
}
