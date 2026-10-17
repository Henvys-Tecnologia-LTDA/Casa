import type { Item } from './types';

// "Cabe ou não cabe?" (como as medidas do IKEA): medidas do produto e a largura do espaço onde ele
// vai ficar, em centímetros.

const cm = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

/** "220 × 90 × 85 cm" (largura × profundidade × altura), só com as medidas anotadas. */
export function medidasTxt(it: Pick<Item, 'width' | 'depth' | 'height'>): string {
  const xs = [Number(it.width) || 0, Number(it.depth) || 0, Number(it.height) || 0];
  if (!xs.some(Boolean)) return '';
  return `${xs.map(v => (v ? cm(v) : '?')).join(' × ')} cm`;
}

/** Se cabe na largura do espaço: null quando falta alguma das duas medidas. */
export function cabe(it: Pick<Item, 'width' | 'space'>): { ok: boolean; folga: number } | null {
  const w = Number(it.width) || 0, s = Number(it.space) || 0;
  if (!w || !s) return null;
  return { ok: w <= s, folga: Math.round((s - w) * 10) / 10 };
}

/** "Sobram 12 cm" / "Faltam 20 cm" / "Cabe certinho". */
export function cabeTxt(c: { ok: boolean; folga: number }): string {
  if (c.folga === 0) return 'Cabe certinho';
  return c.ok ? `Cabe: sobram ${cm(c.folga)} cm` : `Não cabe: faltam ${cm(-c.folga)} cm`;
}

/** Lê "220", "2,20 m", "220cm" ou "1.5m" e devolve centímetros (null se inválido; 0 se vazio). */
export function lerCm(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return 0;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(cm|m)?$/);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  const out = m[2] === 'm' ? v * 100 : v;
  return out > 0 && out < 100000 ? Math.round(out * 10) / 10 : null;
}

export const cmInput = (v: number | null | undefined) => (Number(v) ? cm(Number(v)) : '');
