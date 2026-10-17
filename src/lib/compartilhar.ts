import { byPrio, dueInfo, PHASE, PHASES, qtyOf, sub } from './calc';
import { money } from './format';
import type { Item, PackingItem, Section, Task } from './types';

// Textos para mandar no WhatsApp (como o "Enviar" do Google Keep): *negrito* e listas com •.

const ASSINATURA = '_Lista do Casa a Dois_';

function linhaItem(i: Item) {
  const q = qtyOf(i);
  const preco = sub(i) > 0 ? ` — ${money(sub(i))}` : '';
  return `• ${q > 1 ? `${q}× ` : ''}${i.name}${preco}${i.store ? ` · ${i.store}` : ''}`;
}

/** Um cômodo (ou seção): o que falta, com preço e loja, e o que já têm. */
export function textoSecao(sec: Section, items: Item[], lista: string): string {
  const falta = items.filter(i => !i.bought).sort(byPrio);
  const tem = items.filter(i => i.bought);
  const total = falta.reduce((s, i) => s + sub(i), 0);
  const out = [`*${sec.name}* (${lista})`];
  if (falta.length) {
    out.push(`Faltam ${falta.length === 1 ? '1 item' : `${falta.length} itens`}${total ? ` · ${money(total)}` : ''}`, ...falta.map(linhaItem));
  } else out.push('Tudo comprado!');
  if (tem.length) out.push('', `✔️ Já temos: ${tem.map(i => i.name).join(', ')}`);
  out.push('', ASSINATURA);
  return out.join('\n');
}

/** A lista inteira (Casa ou Console): só o que falta, cômodo por cômodo. */
export function textoLista(lista: string, secs: Section[], itemsOf: (secId: string) => Item[]): string {
  const blocos: string[] = [];
  let n = 0, total = 0;
  for (const s of secs) {
    const falta = itemsOf(s.id).filter(i => !i.bought).sort(byPrio);
    if (!falta.length) continue;
    n += falta.length;
    total += falta.reduce((t, i) => t + sub(i), 0);
    blocos.push(`*${s.name}*\n${falta.map(linhaItem).join('\n')}`);
  }
  if (!blocos.length) return `*${lista}*\nTudo comprado!\n\n${ASSINATURA}`;
  return [`*${lista}*: faltam ${n === 1 ? '1 item' : `${n} itens`}${total ? ` · ${money(total)}` : ''}`, '', blocos.join('\n\n'), '', ASSINATURA].join('\n');
}

/** As tarefas que faltam, por etapa, com o prazo. */
export function textoTarefas(titulo: string, tasks: Task[]): string {
  const abertas = tasks.filter(t => !t.done);
  if (!abertas.length) return `*${titulo}*\nTudo feito!\n\n${ASSINATURA}`;
  const grupos: [string, string][] = [...PHASES, ['', 'Sem etapa']];
  const blocos = grupos.map(([k, nome]) => {
    const ts = abertas.filter(t => (PHASE[t.phase] ? t.phase : '') === k);
    if (!ts.length) return '';
    return `*${nome}*\n${ts.map(t => { const d = dueInfo(t.due); return `• ${t.title}${d ? ` (${d.label})` : ''}`; }).join('\n')}`;
  }).filter(Boolean);
  return [`*${titulo}*: faltam ${abertas.length === 1 ? '1 tarefa' : `${abertas.length} tarefas`}`, '', blocos.join('\n\n'), '', ASSINATURA].join('\n');
}

/** A mala da viagem: o que falta pôr. */
export function textoMala(viagem: string, packing: PackingItem[]): string {
  const falta = packing.filter(p => !p.done);
  if (!falta.length) return `*Mala de ${viagem}*\nTudo na mala!\n\n${ASSINATURA}`;
  return [`*Mala de ${viagem}*: ${falta.length === 1 ? 'falta 1 coisa' : `faltam ${falta.length} coisas`}`, ...falta.map(p => `• ${p.text}`), '', ASSINATURA].join('\n');
}
