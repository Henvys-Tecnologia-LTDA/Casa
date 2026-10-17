import { goalCalc, SHOP, TABS, tripCalc } from './calc';
import { money, plural } from './format';
import type { DataTables, TabKey } from './types';

// Marcos que merecem comemoração: cômodo completo, lista inteira comprada, meta batida, mudança toda
// riscada e viagem paga. Cada aparelho guarda quais já comemorou (src/features/marcos/Marcos.tsx);
// quando aparece um marco novo, mesmo feito pelo outro, a tela comemora uma vez.

export interface Marco { key: string; tab: TabKey; icon: string; title: string; text: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function marcos(t: DataTables, ctx: { tabLabel: (k: TabKey) => string; hidden: (k: TabKey) => boolean }): Marco[] {
  const out: Marco[] = [];
  for (const l of SHOP) {
    if (ctx.hidden(l)) continue;
    const secs = t.sections.filter(s => s.list === l);
    const ids = new Set(secs.map(s => s.id));
    for (const s of secs) {
      const its = t.items.filter(i => i.section_id === s.id);
      if (its.length && its.every(i => i.bought)) {
        out.push({
          key: `sec:${s.id}`, tab: l, icon: s.icon || 'box', title: `${cap(TABS[l].unit)} ${TABS[l].done}: ${s.name}!`,
          text: its.length === 1 ? `O item de ${s.name} já está com vocês.` : `Os ${its.length} itens de ${s.name} já estão com vocês.`,
        });
      }
    }
    const all = t.items.filter(i => ids.has(i.section_id));
    if (secs.length > 1 && all.length >= 5 && all.every(i => i.bought)) {
      out.push({ key: `lista:${l}`, tab: l, icon: 'trophy', title: `${ctx.tabLabel(l)}: tudo comprado!`, text: `${plural(all.length, 'item', 'itens')} em ${plural(secs.length, TABS[l].unit, TABS[l].units)}.` });
    }
  }
  if (!ctx.hidden('mudanca') && t.tasks.length >= 3 && t.tasks.every(x => x.done)) {
    out.push({ key: 'mudanca', tab: 'mudanca', icon: 'truck', title: 'Checklist da mudança concluído!', text: `As ${t.tasks.length} tarefas estão feitas.` });
  }
  if (!ctx.hidden('dinheiro')) {
    for (const g of t.goals) {
      const c = goalCalc(g, t.goal_deposits.filter(x => x.goal_id === g.id));
      if (c.target > 0 && c.saved >= c.target) {
        out.push({ key: `meta:${g.id}`, tab: 'dinheiro', icon: 'flag', title: 'Meta batida!', text: `${g.name}: ${money(c.saved)} guardados.` });
      }
    }
  }
  if (!ctx.hidden('viagem')) {
    for (const v of t.trips) {
      const c = tripCalc(v, t.trip_costs.filter(x => x.trip_id === v.id), t.trip_deposits.filter(x => x.trip_id === v.id), []);
      if (c.total > 0 && c.paid + c.saved >= c.total) {
        out.push({ key: `viagem:${v.id}`, tab: 'viagem', icon: 'suitcase', title: `${v.name} está paga!`, text: `Os ${money(c.total)} da viagem estão cobertos.` });
      }
    }
  }
  return out;
}

/** Marcos novos desde a última vez (null = primeira vez neste aparelho: só guarda, sem festa). */
export function novos(atual: Marco[], visto: string[] | null): Marco[] {
  if (!visto) return [];
  const v = new Set(visto);
  return atual.filter(m => !v.has(m.key));
}
