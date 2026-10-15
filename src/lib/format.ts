// Formatação em português do Brasil sem depender do Intl do aparelho
// (o mesmo texto no Android, no iPhone e no navegador).

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const groupThousands = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function money(n: unknown): string {
  const v = Number(n) || 0;
  const cents = Math.round(Math.abs(v) * 100);
  const int = Math.floor(cents / 100);
  const dec = cents % 100;
  return `${v < 0 && cents ? '-' : ''}R$ ${groupThousands(String(int))},${String(dec).padStart(2, '0')}`;
}

function numPt(v: number, maxFrac: number): string {
  const f = Math.pow(10, maxFrac);
  const r = Math.round(v * f) / f;
  const [i, d] = String(Math.abs(r)).split('.');
  return (r < 0 ? '-' : '') + groupThousands(i) + (d ? ',' + d : '');
}

export function moneyK(n: unknown): string {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `R$ ${numPt(v / 1e6, 1)} mi`;
  if (Math.abs(v) >= 1e3) return `R$ ${numPt(v / 1e3, 1)} mil`;
  return `R$ ${Math.round(v)}`;
}

export const pctTxt = (v: number) => `${numPt(Math.round((Number(v) || 0) * 10) / 10, 1)}%`;
export const intFmt = (v: number) => String(Math.round(v));
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function parsePrice(v: unknown): number | null {
  let s = String(v ?? '').replace(/R\$|\s/gi, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function parsePct(v: unknown): number | null {
  const n = Number(String(v ?? '').replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const fmtInput = (n: unknown) => (Number(n) ? Number(n).toFixed(2).replace('.', ',') : '');
export const fmtNum = (n: unknown) => (n === '' || n == null || !Number.isFinite(Number(n)) ? '' : String(n).replace('.', ','));

export const norm = (s: unknown) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- meses e datas ---------- */

export function ymOf(t: number | string | Date | null | undefined): string {
  const d = new Date(t ?? Date.now());
  if (Number.isNaN(d.getTime())) return ymOf(Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const validYm = (s: unknown) => (/^\d{4}-\d{2}$/.test(String(s || '')) ? String(s) : '');
export function addM(ym: string, k: number): string {
  const [y, m] = ym.split('-').map(Number);
  return ymOf(new Date(y, m - 1 + k, 1));
}
export function diffM(a: string, b: string): number {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}
export function mLabel(ym: string, long?: boolean): string {
  const [y, m] = ym.split('-').map(Number);
  return long ? `${MONTHS_LONG[m - 1]} de ${y}` : MONTHS_SHORT[m - 1];
}
export function mTick(ym: string, first: boolean): string {
  const [y, m] = ym.split('-').map(Number);
  return mLabel(ym) + (first || m === 1 ? ` ${String(y).slice(2)}` : '');
}
export const nextYm = (t?: number | string | null) => addM(ymOf(t || Date.now()), 1);

export function dateBR(t: number | string | null | undefined): string {
  const d = new Date(t ?? 0);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} de ${MONTHS_SHORT[d.getMonth()]}`;
}

export const isDay = (d: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

export function dayLabel(d: string | null | undefined, withYear?: boolean): string {
  if (!d || !isDay(d)) return '';
  const [y, m, dd] = d.split('-').map(Number);
  return `${String(dd).padStart(2, '0')} de ${MONTHS_SHORT[m - 1]}${withYear ? ` de ${y}` : ''}`;
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d || !isDay(d)) return null;
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(y, m - 1, dd);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 864e5);
}

/* Campos de data digitados: "MM/AAAA" ⇄ "AAAA-MM" e "DD/MM/AAAA" ⇄ "AAAA-MM-DD". */
export function maskMonth(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
export function maskDay(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}
export function ymToInput(ym: string): string {
  const v = validYm(ym);
  return v ? `${v.slice(5, 7)}/${v.slice(0, 4)}` : '';
}
export function inputToYm(s: string): string {
  const m = /^(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return '';
  const mo = Number(m[1]);
  return mo >= 1 && mo <= 12 ? `${m[2]}-${m[1]}` : '';
}
export function dayToInput(d: string | null | undefined): string {
  return d && isDay(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '';
}
export function inputToDay(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return '';
  const [dd, mm, yy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(yy, mm - 1, dd);
  if (t.getFullYear() !== yy || t.getMonth() !== mm - 1 || t.getDate() !== dd) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/* ---------- links ---------- */

export function safeUrl(u: unknown): string {
  try {
    const x = new URL(String(u).trim());
    return /^https?:$/.test(x.protocol) ? x.href : '';
  } catch {
    return '';
  }
}
export function normLink(raw: unknown): string {
  const s = String(raw || '').trim();
  return s ? safeUrl(/^https?:\/\//i.test(s) ? s : 'https://' + s) : '';
}
export function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/* ---------- ids ---------- */

export function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
export const rid = () => Math.random().toString(36).slice(2, 10);
