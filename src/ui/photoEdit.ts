// Contas do editor de foto (cortar e girar), sem nada de tela: usadas pelo editor e na hora de
// gerar o arquivo. O recorte é guardado em frações (0 a 1) da foto já girada, então vale para
// qualquer tamanho: o da tela, o do arquivo original ou o reduzido.

export interface Picked {
  uri: string;
  width: number;
  height: number;
  /** Já girada, cortada e reduzida para o envio: vai direto para o Supabase. */
  ready?: boolean;
  /** A foto como veio da galeria ou da câmera e o ajuste feito nela, para ajustar de novo. */
  source?: Picked;
  edit?: PhotoEdit;
}

export type Rot = 0 | 90 | 180 | 270;
export type CropMode = 'livre' | 'quadrado';
export interface Crop { x: number; y: number; w: number; h: number }
export interface PhotoEdit { rotate: Rot; crop: Crop; mode: CropMode }

/** Lado maior da foto enviada e qualidade do JPEG. */
export const MAX_SIDE = 1200;
export const JPEG_Q = 0.82;

export const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const isFull = (c: Crop) => c.x < 0.001 && c.y < 0.001 && c.w > 0.999 && c.h > 0.999;
/** Nada mudou: nem giro nem corte. */
export const isPlain = (e: PhotoEdit) => e.rotate === 0 && isFull(e.crop);

/** Tamanho da foto depois de girar. */
export const turned = (w: number, h: number, rot: Rot) => (rot % 180 ? { w: h, h: w } : { w, h });

/** O maior quadrado que cabe no recorte, centrado nele. W e H: tamanho da foto girada. */
export function squareIn(c: Crop, W: number, H: number): Crop {
  const side = Math.min(c.w * W, c.h * H);
  const x = clamp((c.x + c.w / 2) * W - side / 2, 0, W - side);
  const y = clamp((c.y + c.h / 2) * H - side / 2, 0, H - side);
  return { x: x / W, y: y / H, w: side / W, h: side / H };
}

/** Gira o recorte junto com a foto (1 = 90° para a direita, -1 = para a esquerda): continua marcando o mesmo pedaço. */
export function turnCrop(c: Crop, dir: 1 | -1): Crop {
  return dir === 1
    ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w }
    : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };
}

export const turnRot = (r: Rot, dir: 1 | -1) => (((r + dir * 90) % 360 + 360) % 360) as Rot;

/** O recorte em pixels inteiros, sem passar da borda (o Android recusa até um pixel a mais). */
export function cropPx(c: Crop, W: number, H: number) {
  const originX = clamp(Math.floor(c.x * W), 0, W - 1);
  const originY = clamp(Math.floor(c.y * H), 0, H - 1);
  const width = clamp(Math.round(c.w * W), 1, W - originX);
  const height = clamp(Math.round(c.h * H), 1, H - originY);
  return { originX, originY, width, height };
}

/* ---------- arrastar o recorte na tela (em pixels da tela) ---------- */

export type Grip = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
export interface Box { x: number; y: number; w: number; h: number }

export const toPx = (c: Crop, W: number, H: number): Box => ({ x: c.x * W, y: c.y * H, w: c.w * W, h: c.h * H });
export const toFrac = (b: Box, W: number, H: number): Crop => ({ x: b.x / W, y: b.y / H, w: b.w / W, h: b.h / H });

/**
 * Novo recorte depois de arrastar `grip` por (dx, dy) a partir de `s`, dentro da foto W×H.
 * No quadrado, o canto oposto fica parado; numa borda, o lado oposto fica parado e o quadrado
 * cresce a partir do meio.
 */
export function dragBox(grip: Grip, s: Box, dx: number, dy: number, W: number, H: number, square: boolean, min: number): Box {
  if (grip === 'move') return { ...s, x: clamp(s.x + dx, 0, W - s.w), y: clamp(s.y + dy, 0, H - s.h) };
  const L = grip.includes('w'), R = grip.includes('e'), T = grip.includes('n'), B = grip.includes('s');
  if (!square) {
    const x1 = L ? clamp(s.x + dx, 0, s.x + s.w - min) : s.x;
    const x2 = R ? clamp(s.x + s.w + dx, s.x + min, W) : s.x + s.w;
    const y1 = T ? clamp(s.y + dy, 0, s.y + s.h - min) : s.y;
    const y2 = B ? clamp(s.y + s.h + dy, s.y + min, H) : s.y + s.h;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  const gx = R ? dx : L ? -dx : 0, gy = B ? dy : T ? -dy : 0;
  const ax = L ? s.x + s.w : s.x, ay = T ? s.y + s.h : s.y;
  const roomX = L ? ax : W - ax, roomY = T ? ay : H - ay;
  if ((L || R) && (T || B)) {
    const max = Math.min(roomX, roomY);
    const size = clamp(s.w + (gx + gy) / 2, Math.min(min, max), max);
    return { x: L ? ax - size : ax, y: T ? ay - size : ay, w: size, h: size };
  }
  if (L || R) {
    const max = Math.min(roomX, H);
    const size = clamp(s.w + gx, Math.min(min, max), max);
    return { x: L ? ax - size : ax, y: clamp(s.y + s.h / 2 - size / 2, 0, H - size), w: size, h: size };
  }
  const max = Math.min(roomY, W);
  const size = clamp(s.h + gy, Math.min(min, max), max);
  return { x: clamp(s.x + s.w / 2 - size / 2, 0, W - size), y: T ? ay - size : ay, w: size, h: size };
}
