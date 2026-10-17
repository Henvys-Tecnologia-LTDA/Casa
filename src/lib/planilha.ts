import { CAT, goalCalc, PHASE, PRIO, qtyOf, spentOf, STATUS, sub, TSTATUS_L } from './calc';
import type { DataTables, TabKey } from './types';

// Planilhas em CSV para abrir no Excel ou no Google Planilhas: ponto e vírgula entre colunas e
// vírgula nos decimais (o padrão do Excel em português), com BOM para os acentos saírem certos.

export type Planilha = 'compras' | 'tarefas' | 'viagens' | 'apes' | 'dinheiro';

export interface Ctx {
  tabLabel: (k: TabKey) => string;
  nm: (k: 'a' | 'b') => string;
  whoLabel: (w: string) => string;
}

const cel = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? String(Math.round(n * 100) / 100).replace('.', ',') : '';
};
const data = (v: unknown) => {
  const s = String(v ?? '');
  const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return '';
  if (s.length > 10) { const d = new Date(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }
  return m[3] ? `${m[3]}/${m[2]}/${m[1]}` : `${m[2]}/${m[1]}`;
};
const simNao = (b: unknown) => (b ? 'sim' : 'não');

export function csv(rows: unknown[][]): string {
  return '﻿' + rows.map(r => r.map(cel).join(';')).join('\r\n') + '\r\n';
}

const STATUS_L: Record<string, string> = Object.fromEntries(STATUS);

export function planilha(tipo: Planilha, t: DataTables, ctx: Ctx): unknown[][] {
  switch (tipo) {
    case 'compras': {
      const secs = new Map(t.sections.map(s => [s.id, s]));
      const rows = t.items
        .map(i => ({ i, s: secs.get(i.section_id) }))
        .filter(x => x.s)
        .sort((a, b) => a.s!.list.localeCompare(b.s!.list) || (a.s!.sort_order - b.s!.sort_order) || a.i.name.localeCompare(b.i.name));
      return [
        ['Lista', 'Cômodo/seção', 'Item', 'Quantidade', 'Preço unitário', 'Subtotal', 'Prioridade', 'Etapa', 'Comprado', 'Valor pago', 'Quem pagou', 'Parcelas', 'Data da compra', 'Loja', 'Link', 'Observações'],
        ...rows.map(({ i, s }) => [
          ctx.tabLabel(s!.list), s!.name, i.name, qtyOf(i), num(i.price), num(sub(i)), PRIO[i.priority]?.label ?? '', PHASE[i.phase] ?? '',
          simNao(i.bought), i.bought ? (i.gift ? 'presente' : num(spentOf(i))) : '', ctx.whoLabel(i.payer), i.bought ? i.parcelas : '',
          data(i.bought_at), i.store, i.link, i.notes,
        ]),
      ];
    }
    case 'tarefas':
      return [
        ['Etapa', 'Tarefa', 'Quem', 'Prazo', 'Feita', 'Feita em', 'Observações'],
        ...[...t.tasks].sort((a, b) => a.phase.localeCompare(b.phase) || String(a.due ?? '').localeCompare(String(b.due ?? '')))
          .map(x => [PHASE[x.phase] ?? '', x.title, ctx.whoLabel(x.who), data(x.due), simNao(x.done), data(x.done_at), x.notes]),
      ];
    case 'viagens': {
      const trips = new Map(t.trips.map(v => [v.id, v]));
      return [
        ['Viagem', 'Destino', 'Situação', 'Ida', 'Volta', 'Custo', 'Categoria', 'Valor', 'Parcelas', 'Pago', 'Quem pagou'],
        ...t.trip_costs.filter(c => trips.has(c.trip_id)).map(c => {
          const v = trips.get(c.trip_id)!;
          return [v.name, v.destination, TSTATUS_L[v.status] ?? v.status, data(v.start_date), data(v.end_date), c.descr, CAT[c.cat]?.t ?? c.cat, num(c.amount), c.parcelas, simNao(c.paid), ctx.whoLabel((c as { payer?: string }).payer ?? '')];
        }),
      ];
    }
    case 'apes':
      return [
        ['Apê', 'Endereço', 'Situação', 'Preço', 'Área (m²)', 'Quartos', 'Vagas', 'Entrada', 'FGTS', 'Juros (% ao ano)', 'Prazo (meses)', 'Condomínio', 'IPTU', 'Favorito', 'Link', 'Observações'],
        ...t.apartments.map(a => [a.name, a.address, STATUS_L[a.status] ?? a.status, num(a.price), num(a.area), a.rooms, a.parking, num(a.entrada), num(a.fgts), num(a.taxa), a.prazo, num(a.condo), num(a.iptu), simNao(a.favorite), a.link, a.notes]),
      ];
    case 'dinheiro': {
      const goals = new Map(t.goals.map(g => [g.id, g]));
      const metas = t.goals.map(g => { const c = goalCalc(g, t.goal_deposits.filter(d => d.goal_id === g.id)); return ['Meta', '', g.name, num(c.target), num(c.saved), data(g.deadline), '']; });
      const deps = t.goal_deposits.filter(d => goals.has(d.goal_id)).map(d => ['Depósito na meta', data(d.created_at), goals.get(d.goal_id)!.name, num(d.amount), '', '', ctx.whoLabel(d.who)]);
      const acertos = t.settlements.map(s => ['Acerto do casal', data(s.created_at), s.note || `${ctx.nm(s.payer)} passou para ${ctx.nm(s.payer === 'a' ? 'b' : 'a')}`, num(s.amount), '', '', ctx.nm(s.payer)]);
      return [['Tipo', 'Data', 'Descrição', 'Valor', 'Guardado', 'Prazo', 'Quem'], ...metas, ...deps, ...acertos];
    }
  }
}
