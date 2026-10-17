import type { Trip, TripPlan } from './types';

// Roteiro da viagem dia a dia (como o TripIt e o Wanderlog): o que fazer em cada dia, com horário,
// link e foto da reserva. Sem datas na viagem, tudo fica em "Sem dia".

const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const MAX_DIAS = 60;

const lerDia = (s: string | null | undefined) => {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Os dias da viagem: [{ iso: '2026-12-16', label: 'Dia 1 · qua., 16 de dez.' }]. */
export function diasDaViagem(t: Pick<Trip, 'start_date' | 'end_date'>): { iso: string; label: string; curto: string }[] {
  const ini = lerDia(t.start_date);
  if (!ini) return [];
  const fim = lerDia(t.end_date) ?? ini;
  const out: { iso: string; label: string; curto: string }[] = [];
  for (let d = new Date(ini), n = 1; d <= fim && n <= MAX_DIAS; d.setDate(d.getDate() + 1), n++) {
    const curto = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
    out.push({ iso: iso(d), label: `Dia ${n} · ${curto}`, curto });
  }
  return out;
}

/** Os planos por dia, na ordem da viagem e do horário; os sem dia (ou fora das datas) no fim. */
export function roteiroPorDia(t: Pick<Trip, 'start_date' | 'end_date'>, plans: TripPlan[]) {
  const dias = diasDaViagem(t);
  const ordem = (a: TripPlan, b: TripPlan) => (a.hour || '99:99').localeCompare(b.hour || '99:99') || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
  const usados = new Set<string>();
  const grupos = dias
    .map(d => {
      const itens = plans.filter(p => p.day === d.iso).sort(ordem);
      itens.forEach(p => usados.add(p.id));
      return { key: d.iso, label: d.label, itens };
    })
    .filter(g => g.itens.length);
  const resto = plans.filter(p => !usados.has(p.id)).sort(ordem);
  if (resto.length) grupos.push({ key: 'sem-dia', label: 'Sem dia', itens: resto });
  return grupos;
}

/** "9:30" → "09:30"; inválido → null; vazio → "". */
export function lerHora(raw: string): string | null {
  const s = raw.trim().replace(/h$/i, ':00').replace('h', ':');
  if (!s) return '';
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}
