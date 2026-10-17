import type { Repeat, Task, Who } from './types';

// Tarefas como no Trello e no Todoist: passos dentro da tarefa, quadro com "A fazer / Fazendo / Feito"
// e tarefas da casa que se repetem, revezando quem faz.

export const REPEAT_L: Record<Exclude<Repeat, ''>, string> = { semana: 'Toda semana', quinzena: 'A cada 15 dias', mes: 'Todo mês' };

export type Coluna = 'fazer' | 'fazendo' | 'feito';
export const COLUNAS: [Coluna, string][] = [['fazer', 'A fazer'], ['fazendo', 'Fazendo'], ['feito', 'Feito']];
export const colunaDe = (t: Pick<Task, 'done' | 'doing'>): Coluna => (t.done ? 'feito' : t.doing ? 'fazendo' : 'fazer');

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dia0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function soma(d: Date, repeat: Exclude<Repeat, ''>): Date {
  if (repeat === 'mes') {
    // Mesmo dia no mês seguinte; dia 31 em mês curto vira o último dia.
    const alvo = d.getDate();
    const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const ultimo = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    return new Date(n.getFullYear(), n.getMonth(), Math.min(alvo, ultimo));
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (repeat === 'semana' ? 7 : 14));
}

/** Próximo prazo depois de fazer: a partir do prazo atual, pulando o que já passou (fica sempre depois de hoje). */
export function proximoPrazo(due: string | null, repeat: Exclude<Repeat, ''>, agora: Date = new Date()): string {
  const hoje = dia0(agora);
  const m = due?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : hoje;
  let guarda = 0;
  do { d = soma(d, repeat); } while (d <= hoje && ++guarda < 400);
  return iso(d);
}

/** Revezar: quem faz passa para o outro (só quando é uma pessoa só). */
export const proximoQuem = (who: Who, rotate: boolean): Who => (rotate && who === 'a' ? 'b' : rotate && who === 'b' ? 'a' : who);

/** O que muda quando uma tarefa que se repete é feita: fica aberta, com o próximo prazo e passos zerados. */
export function concluirRepetida(t: Pick<Task, 'due' | 'repeat' | 'who' | 'rotate' | 'steps'>, me: string, agora: Date = new Date()): Partial<Task> {
  if (!t.repeat) return {};
  return {
    due: proximoPrazo(t.due, t.repeat, agora),
    who: proximoQuem(t.who, t.rotate),
    steps: (t.steps || []).map(s => ({ ...s, done: false })),
    doing: false,
    done: false,
    done_by: null,
    done_at: null,
    last_done_at: agora.toISOString(),
    last_done_by: me,
  };
}

/** "2/5" dos passos (vazio sem passos). */
export function passosTxt(t: Pick<Task, 'steps'>): string {
  const s = t.steps || [];
  return s.length ? `${s.filter(x => x.done).length}/${s.length}` : '';
}
