// Cálculos copiados da página "Casa - Camila e Luis" (simulate, calendar, stats, metas, viagens),
// adaptados aos nomes de coluna do Supabase.
import {
  addM, daysUntil, diffM, money, nextYm, validYm, ymOf,
} from './format';
import type {
  Apartment, Goal, GoalDeposit, Item, ItemOption, PackingItem, Section, ShopList, Trip, TripCost, TripDeposit,
} from './types';

export const PARCELAS = 10;
export const WINDOW = 12;

export const SHOP: ShopList[] = ['casa', 'switch'];
export const TABS = {
  casa: { label: 'Casa', icon: 'house', unit: 'cômodo', units: 'cômodos', Units: 'Cômodos', novo: 'Novo cômodo', defIcon: 'box', done: 'completo', boughtLbl: 'Comprados' },
  switch: { label: 'Console', icon: 'gamepad', unit: 'seção', units: 'seções', Units: 'Seções', novo: 'Nova seção', defIcon: 'gamepad', done: 'completa', boughtLbl: 'Já temos' },
} as const;

export const SRC: [keyof CalendarMonth['src'], string][] = [['casa', 'Casa'], ['switch', 'Console'], ['ape', 'Apê'], ['viagem', 'Viagem']];
export const CATS: [string, string, string][] = [
  ['passagens', 'Passagens', 'plane'], ['hospedagem', 'Hospedagem', 'bed'], ['passeios', 'Passeios', 'camera'], ['alimentacao', 'Alimentação', 'pot'],
  ['transporte', 'Transporte local', 'truck'], ['seguro', 'Seguro viagem', 'shield'], ['compras', 'Compras', 'gift'], ['outros', 'Outros', 'box'],
];
export const CAT: Record<string, { t: string; ic: string }> = Object.fromEntries(CATS.map(([k, t, ic]) => [k, { t, ic }]));
export const TSTATUS: [Trip['status'], string][] = [['sonho', 'Sonho'], ['planejando', 'Planejando'], ['confirmada', 'Confirmada'], ['feita', 'Já fomos']];
export const TSTATUS_L: Record<string, string> = Object.fromEntries(TSTATUS);
export const PACK_BASIC = ['Documentos (RG ou passaporte)', 'Carregadores e cabos', 'Remédios', 'Escova e pasta de dente', 'Roupas para os dias', 'Pijama', 'Protetor solar', 'Óculos de sol', 'Adaptador de tomada', 'Cartões e um pouco de dinheiro'];
export const ICONS: [string, string][] = [
  ['sofa', 'Sala'], ['pot', 'Cozinha'], ['bed', 'Quarto'], ['bath', 'Banheiro'], ['washer', 'Lavanderia'], ['desk', 'Escritório'],
  ['plant', 'Varanda'], ['broom', 'Limpeza'], ['box', 'Geral'], ['gamepad', 'Jogos'], ['joycon', 'Acessórios'], ['ticket', 'Assinaturas'],
];
export const PRIO: Record<string, { label: string; rank: number }> = { alta: { label: 'Alta', rank: 0 }, media: { label: 'Média', rank: 1 }, baixa: { label: 'Baixa', rank: 2 } };
export const PHASES: [Exclude<Item['phase'], ''>, string][] = [['antes', 'Antes da mudança'], ['mes1', 'Primeiro mês'], ['calma', 'Com calma']];
export const PHASE: Record<string, string> = Object.fromEntries(PHASES);
export const STATUS: [Apartment['status'], string][] = [['visitar', 'Quero visitar'], ['visitado', 'Já visitamos'], ['proposta', 'Proposta feita'], ['descartado', 'Descartado']];
export const STATUS_L: Record<string, string> = Object.fromEntries(STATUS);

/* ---------- compras (Casa e Switch 2) ---------- */

export const qtyOf = (i: Pick<Item, 'qty'>) => Math.max(1, Math.floor(Number(i.qty)) || 1);
export const sub = (i: Pick<Item, 'qty' | 'price'>) => (Number(i.price) || 0) * qtyOf(i);
export const hasPaid = (i: Pick<Item, 'paid'>) => i.paid !== null && i.paid !== undefined && Number.isFinite(Number(i.paid));
export const spentOf = (i: Item) => (i.gift ? 0 : hasPaid(i) ? Number(i.paid) : sub(i));
export const optsOf = (i: Pick<Item, 'options'>): ItemOption[] =>
  Array.isArray(i.options) ? i.options.filter(o => o && typeof o === 'object' && o.id) : [];

export function effective(opts: ItemOption[], chosen: string): ItemOption | null {
  const ch = opts.find(o => o.id === chosen);
  if (ch) return ch;
  const priced = opts.filter(o => Number(o.price) > 0);
  return priced.length ? priced.reduce((m, o) => (Number(o.price) < Number(m.price) ? o : m)) : null;
}
export const thumbOf = (i: Item) => i.image || effective(optsOf(i), i.chosen)?.image || '';

export interface Stats { total: number; spent: number; left: number; count: number; nb: number; economy: number; projected: number }
export function stats(items: Item[]): Stats {
  let total = 0, spent = 0, estBought = 0, left = 0, nb = 0;
  for (const i of items) {
    const v = sub(i);
    total += v;
    if (i.bought) { nb++; estBought += v; spent += spentOf(i); } else left += v;
  }
  return { total, spent, left, count: items.length, nb, economy: estBought - spent, projected: spent + left };
}

export function budgetState(projected: number, budget: number) {
  if (!(budget > 0)) return null;
  const r = projected / budget;
  const cls: 'hi' | 'mid' | 'ok' = r > 1 ? 'hi' : r > 0.9 ? 'mid' : 'ok';
  return { r, cls, text: r > 1 ? `passa ${money(projected - budget)}` : `sobra ${money(budget - projected)}` };
}

export function balance(items: Item[]) {
  let a = 0, b = 0, none = 0;
  for (const i of items) {
    if (!i.bought) continue;
    const v = spentOf(i);
    if (i.payer === 'a') a += v;
    else if (i.payer === 'b') b += v;
    else if (i.payer === 'ambos') { a += v / 2; b += v / 2; } else none += v;
  }
  return { a, b, none, diff: (a - b) / 2 };
}

export const byPrio = (a: Item, b: Item) => (PRIO[a.priority]?.rank ?? 1) - (PRIO[b.priority]?.rank ?? 1) || sub(b) - sub(a);

export const secsOf = (sections: Section[], list: ShopList) => sections.filter(s => s.list === list)
  .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.name).localeCompare(String(b.name), 'pt-BR'));

/* ---------- apê: simulação SAC/Price ---------- */

export type SimInput = Pick<Apartment,
  'price' | 'entrada' | 'fgts' | 'prazo' | 'taxa' | 'seguro' | 'entrada_tipo' | 'entrada_parcelas' | 'inicio' | 'sistema' | 'condo' | 'iptu' | 'itbi' | 'cartorio'>;

export interface SimYear { y: number; from: number; to: number; ent: number; fin: number; fix: number }
export interface Sim {
  price: number; entrada: number; fgts: number; P: number; n: number; ia: number; seg: number; parcelada: boolean; ne: number;
  entradaMes: number; start: number; sistema: 'Price' | 'SAC'; firstFin: number; lastFin: number; juros: number; totalBanco: number;
  fixed: number; itbiV: number; cartV: number; custos: number; cash: number; monthlyKeys: number; peak: number;
  years: SimYear[]; months: [number, number, number][]; timeline: { when: string; text: string }[];
  entPct: number; low20: boolean; totalCost: number;
}

export function simulate(a: SimInput): Sim {
  const price = Math.max(0, Number(a.price) || 0);
  const entrada = Math.min(price, Math.max(0, Number(a.entrada) || 0));
  const fgts = Math.min(price - entrada, Math.max(0, Number(a.fgts) || 0));
  const P = Math.max(0, price - entrada - fgts);
  const n = Math.min(480, Math.max(1, parseInt(String(a.prazo), 10) || 360));
  const ia = Math.max(0, Number(a.taxa) || 0) / 100;
  const i = Math.pow(1 + ia, 1 / 12) - 1;
  const seg = Math.max(0, Number(a.seguro) || 0);
  const parcelada = a.entrada_tipo === 'parcelada' && entrada > 0;
  const ne = parcelada ? Math.min(240, Math.max(1, parseInt(String(a.entrada_parcelas), 10) || 1)) : 0;
  const entradaMes = parcelada ? entrada / ne : 0;
  const start = parcelada && a.inicio !== 'junto' ? ne : 0;
  const price_ = a.sistema === 'PRICE';
  const A = P / n;
  const pmt = price_ ? (i ? (P * i) / (1 - Math.pow(1 + i, -n)) : P / n) : 0;
  const finPay = (k: number) => (k < 0 || k >= n || P <= 0 ? 0 : price_ ? pmt : A + (P - k * A) * i);
  const first = finPay(0), last = finPay(n - 1);
  const juros = price_ ? pmt * n - P : (i * P * (n + 1)) / 2;
  const fixed = Math.max(0, Number(a.condo) || 0) + Math.max(0, Number(a.iptu) || 0);
  const itbiV = (price * Math.max(0, Number(a.itbi) || 0)) / 100;
  const cartV = (price * Math.max(0, Number(a.cartorio) || 0)) / 100;
  const custos = itbiV + cartV;
  const cash = (parcelada ? 0 : entrada) + custos;
  const firstFin = P > 0 ? first + seg : 0, lastFin = P > 0 ? last + seg : 0;
  const total = Math.max(start + n, ne);
  const months: [number, number, number][] = [];
  for (let m = 0; m < total; m++) {
    const k = m - start;
    const ent = parcelada && m < ne ? entradaMes : 0;
    const fin = k >= 0 && k < n && P > 0 ? finPay(k) + seg : 0;
    const fix = k >= 0 && k < n ? fixed : 0;
    months.push([ent, fin, fix]);
  }
  const years: SimYear[] = [];
  for (let y = 0; y * 12 < months.length; y++) {
    const sl = months.slice(y * 12, y * 12 + 12), L = sl.length;
    const s = sl.reduce((t, r) => [t[0] + r[0], t[1] + r[1], t[2] + r[2]], [0, 0, 0]);
    years.push({ y: y + 1, from: y * 12 + 1, to: y * 12 + L, ent: s[0] / L, fin: s[1] / L, fix: s[2] / L });
  }
  const peak = months.reduce((m, r) => Math.max(m, r[0] + r[1] + r[2]), 0);
  const tl: { when: string; text: string }[] = [];
  const finTxt = P > 0 ? (price_ ? `parcela fixa de ${money(firstFin)}` : `parcela de ${money(firstFin)} caindo até ${money(lastFin)}`) : 'sem financiamento';
  const fixTxt = fixed ? ` + ${money(fixed)} de condomínio e IPTU` : '';
  if (custos > 0 || (!parcelada && entrada > 0)) {
    tl.push({ when: 'Na compra', text: [!parcelada && entrada > 0 ? `entrada de ${money(entrada)}` : '', custos > 0 ? `${money(custos)} de ITBI e cartório` : ''].filter(Boolean).join(' + ') });
  }
  if (parcelada && start > 0) {
    tl.push({ when: `Meses 1–${ne}`, text: `entrada parcelada: ${money(entradaMes)} por mês` });
    if (P > 0 || fixed) tl.push({ when: `Meses ${ne + 1}–${ne + n}`, text: `financiamento: ${finTxt}${fixTxt}` });
  } else if (parcelada) {
    tl.push({ when: `Meses 1–${ne}`, text: `entrada ${money(entradaMes)} + financiamento ${money(firstFin)}${fixed ? ` + condomínio e IPTU ${money(fixed)}` : ''} = ${money(entradaMes + firstFin + fixed)} por mês` });
    if (n > ne) tl.push({ when: `Meses ${ne + 1}–${n}`, text: `só o financiamento: ${finTxt}${fixTxt}` });
  } else if (P > 0 || fixed) {
    tl.push({ when: `Meses 1–${n}`, text: `financiamento: ${finTxt}${fixTxt}` });
  }
  return {
    price, entrada, fgts, P, n, ia, seg, parcelada, ne, entradaMes, start, sistema: price_ ? 'Price' : 'SAC',
    firstFin, lastFin, juros: P > 0 ? juros : 0, totalBanco: P > 0 ? P + juros + seg * n : 0, fixed, itbiV, cartV, custos, cash,
    monthlyKeys: firstFin + fixed, peak, years, months, timeline: tl,
    entPct: price ? ((entrada + fgts) / price) * 100 : 0, low20: price > 0 && entrada + fgts < price * 0.2,
    totalCost: entrada + fgts + (P > 0 ? P + juros + seg * n : 0) + custos,
  };
}

export const aptsSorted = (apts: Apartment[]) => [...apts].sort((x, y) =>
  (y.favorite ? 1 : 0) - (x.favorite ? 1 : 0)
  || Number(x.status === 'descartado') - Number(y.status === 'descartado')
  || String(x.created_at).localeCompare(String(y.created_at)));

export const favApt = (apts: Apartment[]) =>
  apts.find(a => a.favorite && a.status !== 'descartado') || aptsSorted(apts).find(a => a.status !== 'descartado') || null;

/* ---------- viagens ---------- */

export interface TripCalc {
  costs: TripCost[]; deps: TripDeposit[]; packing: PackingItem[]; total: number; paid: number; saved: number; people: number;
  days: number | null; daysEnd: number | null; months: number; falta: number; nights: number; parcMes: number;
  perPerson: number; perMonth: number; pct: number;
}

export function tripCalc(t: Trip, costs: TripCost[], deps: TripDeposit[], packing: PackingItem[]): TripCalc {
  const total = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const paid = costs.filter(c => c.paid).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const saved = deps.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const people = Math.max(1, parseInt(String(t.people), 10) || 2);
  const days = daysUntil(t.start_date), daysEnd = daysUntil(t.end_date);
  const months = days != null && days > 0 ? Math.max(1, Math.ceil(days / 30.44)) : 0;
  const falta = Math.max(0, total - paid - saved);
  const nights = days != null && daysEnd != null ? Math.max(0, daysEnd - days) : 0;
  const parcMes = costs.filter(c => (Number(c.parcelas) || 1) > 1).reduce((s, c) => s + (Number(c.amount) || 0) / (Number(c.parcelas) || 1), 0);
  return {
    costs, deps, packing, total, paid, saved, people, days, daysEnd, months, falta, nights, parcMes,
    perPerson: total / people, perMonth: months ? falta / months : 0, pct: total ? Math.min(1, (paid + saved) / total) : 0,
  };
}

export function countdown(c: Pick<TripCalc, 'days' | 'daysEnd'>, status: Trip['status']): string {
  if (status === 'feita') return 'Já fomos';
  if (c.days == null) return 'Sem data';
  if (c.days > 1) return `Faltam ${c.days} dias`;
  if (c.days === 1) return 'É amanhã!';
  if (c.days === 0) return 'É hoje!';
  if (c.daysEnd != null && c.daysEnd >= 0) return 'Acontecendo agora';
  return 'Já passou';
}

export const tripsSorted = (trips: Trip[]) => [...trips].sort((a, b) =>
  Number(a.status === 'feita') - Number(b.status === 'feita')
  || (daysUntil(a.start_date) ?? 99999) - (daysUntil(b.start_date) ?? 99999)
  || String(a.created_at).localeCompare(String(b.created_at)));

export const nextTrip = (trips: Trip[]) =>
  tripsSorted(trips).find(t => t.status !== 'feita' && (daysUntil(t.end_date) ?? daysUntil(t.start_date) ?? 0) >= 0) || null;

/* ---------- dinheiro: calendário de parcelas e metas ---------- */

export interface CalendarMonth {
  ym: string; total: number; src: { casa: number; switch: number; ape: number; viagem: number };
  a: number; b: number; none: number; entries: { label: string; amount: number; src: keyof CalendarMonth['src'] }[];
}

export function calendar(d: { items: Item[]; sections: Section[]; trips: Trip[]; costs: TripCost[]; fav: Apartment | null }): CalendarMonth[] {
  const now = ymOf(Date.now());
  const months: CalendarMonth[] = Array.from({ length: WINDOW }, (_, k) => ({
    ym: addM(now, k), total: 0, src: { casa: 0, switch: 0, ape: 0, viagem: 0 }, a: 0, b: 0, none: 0, entries: [],
  }));
  const push = (ym: string, amount: number, src: keyof CalendarMonth['src'], label: string, who: string) => {
    const k = diffM(now, ym);
    if (k < 0 || k >= WINDOW || !(amount > 0)) return;
    const M = months[k];
    M.total += amount; M.src[src] += amount;
    if (who === 'a') M.a += amount;
    else if (who === 'b') M.b += amount;
    else if (who === 'ambos') { M.a += amount / 2; M.b += amount / 2; } else M.none += amount;
    M.entries.push({ label, amount, src });
  };
  const listOf = new Map(d.sections.map(s => [s.id, s.list]));
  for (const i of d.items) {
    if (!i.bought || i.gift) continue;
    const n = Number(i.parcelas) || 1;
    if (n < 2) continue;
    const list = listOf.get(i.section_id);
    if (!list) continue;
    const start = validYm(i.parc_start) || nextYm(i.bought_at), per = spentOf(i) / n;
    for (let k = 0; k < n; k++) push(addM(start, k), per, list, `${i.name} · ${k + 1}/${n}`, i.payer || '');
  }
  const tripOf = new Map(d.trips.map(t => [t.id, t]));
  for (const c of d.costs) {
    const t = tripOf.get(c.trip_id);
    if (!t) continue;
    const n = Number(c.parcelas) || 1;
    if (n < 2) continue;
    const start = validYm(c.parc_start) || nextYm(t.created_at), per = (Number(c.amount) || 0) / n;
    for (let k = 0; k < n; k++) push(addM(start, k), per, 'viagem', `${c.descr || CAT[c.cat]?.t || 'Custo'} (${t.name || 'viagem'}) · ${k + 1}/${n}`, 'ambos');
  }
  const f = d.fav;
  if (f && validYm(f.inicio_mes)) {
    const s = simulate(f), st = f.inicio_mes;
    if (s.cash > 0) push(st, s.cash, 'ape', s.parcelada ? 'Apê: ITBI e cartório' : 'Apê: entrada à vista, ITBI e cartório', 'ambos');
    for (const M of months) {
      const m = diffM(st, M.ym);
      if (m < 0 || m >= s.months.length) continue;
      const [e, fi, fx] = s.months[m];
      if (e) push(M.ym, e, 'ape', `Entrada do apê · ${m + 1}/${s.ne}`, 'ambos');
      if (fi) push(M.ym, fi, 'ape', `Financiamento do apê · ${m - s.start + 1}/${s.n}`, 'ambos');
      if (fx) push(M.ym, fx, 'ape', 'Condomínio e IPTU', 'ambos');
    }
  }
  for (const M of months) M.entries.sort((x, y) => y.amount - x.amount);
  return months;
}

export function goalCalc(g: Goal, deps: GoalDeposit[]) {
  const saved = deps.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const target = Math.max(0, Number(g.target) || 0);
  const now = ymOf(Date.now()), dl = validYm(g.deadline);
  const months = dl ? Math.max(0, diffM(now, dl) + 1) : 0;
  const left = Math.max(0, target - saved);
  let a = 0, b = 0;
  for (const d of deps) {
    const v = Number(d.amount) || 0;
    if (d.who === 'a') a += v;
    else if (d.who === 'b') b += v;
    else { a += v / 2; b += v / 2; }
  }
  const thisMonth = deps.filter(d => ymOf(d.created_at) === now).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  return { deps, saved, target, dl, months, left, per: months ? left / months : 0, a, b, thisMonth, pct: target ? Math.min(1, Math.max(0, saved / target)) : 0 };
}

/* ---------- mudança: prazos ---------- */

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function dueInfo(due: string | null | undefined) {
  const days = daysUntil(due);
  if (days == null || !due) return null;
  const [, m, d] = due.split('-').map(Number);
  const label = days < -1 ? `atrasada há ${-days} dias` : days === -1 ? 'era para ontem' : days === 0 ? 'hoje' : days === 1 ? 'amanhã'
    : days <= 30 ? `em ${days} dias` : `${String(d).padStart(2, '0')} de ${MONTHS_SHORT[m - 1]}`;
  const cls: 'alta' | 'media' | 'baixa' = days < 0 ? 'alta' : days <= 3 ? 'media' : 'baixa';
  return { days, label, cls };
}
