import { FULL, JPEG_Q, MAX_SIDE, turned, type Picked, type PhotoEdit } from './photoEdit';

// Navegador: desenha a foto já girada e cortada direto num canvas do tamanho final (no máximo
// 1200 px). Não passa por um canvas do tamanho da foto original: no iPhone, fotos de 24 MP ou mais
// passam do limite de canvas do Safari (16,7 MP) e sairiam em branco.

function load(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Não foi possível abrir esta foto.'));
    el.src = uri;
  });
}

export async function renderPhoto(img: Picked, edit?: PhotoEdit): Promise<Picked> {
  const el = await load(img.uri);
  const nw = el.naturalWidth || img.width, nh = el.naturalHeight || img.height;
  const rot = edit?.rotate ?? 0;
  const t = turned(nw, nh, rot);
  const c = edit?.crop ?? FULL;
  const cx = c.x * t.w, cy = c.y * t.h;
  const cw = Math.max(1, c.w * t.w), ch = Math.max(1, c.h * t.h);
  const s = Math.min(1, MAX_SIDE / Math.max(cw, ch));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cw * s));
  canvas.height = Math.max(1, Math.round(ch * s));
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Este navegador não conseguiu preparar a foto.');
  // Fundo branco: PNG com transparência não fica preto no JPEG.
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.scale(s, s);
  g.translate(-cx, -cy);
  g.translate(t.w / 2, t.h / 2);
  g.rotate((rot * Math.PI) / 180);
  g.drawImage(el, -nw / 2, -nh / 2, nw, nh);

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', JPEG_Q));
  if (!blob) throw new Error('Este navegador não conseguiu preparar a foto.');
  return { uri: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, ready: true };
}
