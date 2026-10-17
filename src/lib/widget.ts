import { dueInfo } from './calc';
import type { DataTables, Item, Section, ShopList, TabKey } from './types';

// Widget da tela de início do Android (src/widget): um resumo pequeno guardado no aparelho. As datas
// ficam cruas para o "hoje", "amanhã" e "atrasada" saírem certos na hora de desenhar, mesmo dias depois.

export const WIDGET_KEY = 'casa.widget';

export interface ResumoWidget {
  hid: string;
  /** Tarefas abertas com prazo, da mais urgente para a menos; null quando a aba da mudança está escondida. */
  tarefas: { title: string; due: string }[] | null;
  tarefasLabel: string;
  /** Listas de compras visíveis e quantos itens faltam comprar em cada uma. */
  listas: { tab: ShopList; label: string; faltam: number }[];
  /** Quando os dados foram lidos (ISO). */
  em: string;
}

const MAX_TAREFAS = 12;
const LISTAS: ShopList[] = ['casa', 'switch'];

export function tarefasAbertas(tasks: Pick<DataTables['tasks'][number], 'title' | 'due' | 'done'>[]) {
  return tasks
    .filter((t): t is typeof t & { due: string } => !t.done && !!t.due)
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title))
    .slice(0, MAX_TAREFAS)
    .map(t => ({ title: t.title, due: t.due }));
}

export function faltamPorLista(sections: Pick<Section, 'id' | 'list'>[], items: Pick<Item, 'section_id' | 'bought'>[]) {
  const lista = new Map(sections.map(s => [s.id, s.list]));
  const n: Record<ShopList, number> = { casa: 0, switch: 0 };
  for (const i of items) {
    const l = lista.get(i.section_id);
    if (l && !i.bought) n[l]++;
  }
  return n;
}

export function resumoWidget(
  hid: string,
  t: Pick<DataTables, 'tasks' | 'items' | 'sections'>,
  tabs: { label: (k: TabKey) => string; hidden: (k: TabKey) => boolean },
  agora: Date = new Date(),
): ResumoWidget {
  const n = faltamPorLista(t.sections, t.items);
  return {
    hid,
    tarefas: tabs.hidden('mudanca') ? null : tarefasAbertas(t.tasks),
    tarefasLabel: tabs.label('mudanca'),
    listas: LISTAS.filter(l => !tabs.hidden(l)).map(l => ({ tab: l, label: tabs.label(l), faltam: n[l] })),
    em: agora.toISOString(),
  };
}

/** As linhas de tarefa que cabem no widget: vencidas, de hoje e dos próximos 7 dias. */
export function linhasWidget(r: ResumoWidget, max: number) {
  const out: { title: string; quando: string; atrasada: boolean }[] = [];
  for (const x of r.tarefas ?? []) {
    const info = dueInfo(x.due);
    if (!info || info.days > 7) continue;
    out.push({ title: x.title, quando: info.label, atrasada: info.days < 0 });
    if (out.length >= max) break;
  }
  return out;
}
