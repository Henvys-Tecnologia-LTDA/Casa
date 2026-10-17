import { money } from './format';
import type { TabKey } from './types';

// "O que mudou": o histórico do casal (rpc household_activity, a partir dos eventos dos avisos).
// As frases são as mesmas dos avisos (supabase/functions/notify), em forma de linha do tempo.

export interface Atividade {
  id: number;
  actor: string;
  actor_name: string;
  /** Aba do app, ou "mercado" (a lista do mercado fica fora das abas). */
  tab: TabKey | 'mercado';
  kind: 'novo' | 'feito' | 'comentario' | 'reacao';
  tbl: string;
  row_id: string;
  label: string;
  link: string;
  extra: { amount?: number; status?: string; parent?: string; body?: string; emoji?: string };
  created_at: string;
}

const STATUS: Record<string, string> = { visitar: 'a visitar', visitado: 'visitado', proposta: 'proposta feita', descartado: 'descartado' };
const q = (s: string | undefined) => `“${s || 'sem nome'}”`;

/** O que a pessoa fez, sem o nome dela ("comprou “Geladeira”"). */
export function frase(e: Pick<Atividade, 'tbl' | 'kind' | 'label' | 'extra'>): string {
  const amount = Math.abs(Number(e.extra?.amount) || 0);
  const tirou = (Number(e.extra?.amount) || 0) < 0;
  switch (`${e.tbl}:${e.kind}`) {
    case 'items:novo': return `adicionou ${q(e.label)}`;
    case 'items:feito': return `comprou ${q(e.label)}`;
    case 'tasks:novo': return `adicionou a tarefa ${q(e.label)}`;
    case 'tasks:feito': return `concluiu ${q(e.label)}`;
    case 'apartments:novo': return `adicionou o apê ${q(e.label)}`;
    case 'apartments:feito': return `marcou ${q(e.label)} como ${STATUS[e.extra?.status ?? ''] ?? e.extra?.status ?? 'outro status'}`;
    case 'trips:novo': return `criou a viagem ${q(e.label)}`;
    case 'trip_costs:novo': return `adicionou o custo ${q(e.label)}${e.extra?.parent ? ` em ${q(e.extra.parent)}` : ''}`;
    case 'trip_deposits:feito': return tirou ? `tirou ${money(amount)} do cofrinho de ${q(e.label)}` : `guardou ${money(amount)} no cofrinho de ${q(e.label)}`;
    case 'goals:novo': return `criou a meta ${q(e.label)}`;
    case 'goal_deposits:feito': return tirou ? `tirou ${money(amount)} da meta ${q(e.label)}` : `guardou ${money(amount)} na meta ${q(e.label)}`;
    case 'comments:comentario': return `comentou em ${q(e.label)}${e.extra?.body ? `: ${q(e.extra.body)}` : ''}`;
    case 'bill_payments:feito': return `pagou a conta ${q(e.label)}${amount ? ` (${money(amount)})` : ''}`;
    case 'groceries:novo': return `pôs ${q(e.label)} na lista do mercado`;
  }
  return `mexeu em ${q(e.label)}`;
}

const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** "Hoje", "Ontem" ou "seg., 12 de out." (no fuso do aparelho). */
export function rotuloDia(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  if (dia(d) === dia(agora)) return 'Hoje';
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (dia(d) === dia(ontem)) return 'Ontem';
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export const hora = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Junta por dia, na ordem em que chegam (mais recentes primeiro). */
export function porDia<T extends { created_at: string }>(list: T[], agora = new Date()): { dia: string; itens: T[] }[] {
  const out: { dia: string; itens: T[] }[] = [];
  for (const e of list) {
    const rot = rotuloDia(e.created_at, agora);
    const last = out[out.length - 1];
    if (last && last.dia === rot) last.itens.push(e);
    else out.push({ dia: rot, itens: [e] });
  }
  return out;
}
