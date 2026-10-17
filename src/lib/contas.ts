import { ymOf } from './format';
import type { Bill, BillPayment } from './types';

// Contas fixas do mês (como no Organizze e no Splitwise): aluguel, luz, internet. Cada mês tem o seu
// pagamento, com quem pagou; os pagos entram no acerto do casal.

export const CONTAS_COMUNS = ['Aluguel', 'Condomínio', 'Luz', 'Água', 'Internet', 'Gás'];

/** Dia do vencimento no mês (31 em mês curto vira o último dia). */
export function vencimento(b: Pick<Bill, 'due_day'>, ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(Math.max(1, Number(b.due_day) || 1), ultimo));
}

/** Situação da conta no mês: paga, ou em quantos dias vence (negativo: atrasada). */
export function situacao(b: Pick<Bill, 'due_day'>, pago: Pick<BillPayment, 'amount' | 'payer'> | undefined, ym: string, agora: Date = new Date()) {
  if (pago) return { pago: true as const, dias: 0, label: 'paga', cls: 'ok' as const };
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dias = Math.round((vencimento(b, ym).getTime() - hoje.getTime()) / 864e5);
  const label = dias < -1 ? `atrasada há ${-dias} dias` : dias === -1 ? 'venceu ontem' : dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;
  return { pago: false as const, dias, label, cls: dias < 0 ? 'alta' as const : dias <= 3 ? 'media' as const : 'baixa' as const };
}

/** Contas ativas do mês com o pagamento de cada uma, das que vencem primeiro às últimas. */
export function contasDoMes(bills: Bill[], payments: BillPayment[], ym: string = ymOf(Date.now())) {
  const pagos = new Map(payments.filter(p => p.ym === ym).map(p => [p.bill_id, p]));
  const lista = bills
    .filter(b => b.active || pagos.has(b.id))
    .map(b => ({ b, pago: pagos.get(b.id) }))
    .sort((x, y) => (Number(x.b.due_day) || 0) - (Number(y.b.due_day) || 0) || x.b.name.localeCompare(y.b.name, 'pt-BR'));
  const total = lista.reduce((s, x) => s + (x.pago ? Number(x.pago.amount) || 0 : Number(x.b.amount) || 0), 0);
  const pago = lista.reduce((s, x) => s + (x.pago ? Number(x.pago.amount) || 0 : 0), 0);
  return { lista, total, pago };
}
