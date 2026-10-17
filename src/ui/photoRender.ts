import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { cropPx, isFull, isPlain, JPEG_Q, MAX_SIDE, type Picked, type PhotoEdit } from './photoEdit';

// Celular: gera o JPEG que vai para o Supabase (girado, cortado e com no máximo 1200 px).
// O navegador tem a própria versão em photoRender.web.ts.

// Foto enorme é reduzida antes de girar, para não estourar a memória do celular.
const WORK_MAX = 4096;

type Ctx = ReturnType<typeof ImageManipulator.manipulate>;
function fit(ctx: Ctx, w: number, h: number, max: number) {
  if (w >= h && w > max) ctx.resize({ width: max, height: null });
  else if (h > w && h > max) ctx.resize({ width: null, height: max });
}

// Salva em JPEG e solta as imagens da memória na hora (sem esperar o coletor do JS).
async function save(ctx: Ctx): Promise<Picked> {
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_Q });
  ref.release();
  ctx.release();
  return { uri: out.uri, width: out.width, height: out.height, ready: true };
}

export async function renderPhoto(img: Picked, edit?: PhotoEdit): Promise<Picked> {
  if (!edit || isPlain(edit)) {
    const ctx = ImageManipulator.manipulate(img.uri);
    fit(ctx, img.width, img.height, MAX_SIDE);
    return save(ctx);
  }
  // Duas passadas: primeiro gira; o corte usa o tamanho real da foto já girada.
  const first = ImageManipulator.manipulate(img.uri);
  fit(first, img.width, img.height, WORK_MAX);
  if (edit.rotate) first.rotate(edit.rotate);
  const turnedRef = await first.renderAsync();
  const ctx = ImageManipulator.manipulate(turnedRef);
  let w = turnedRef.width, h = turnedRef.height;
  if (!isFull(edit.crop)) {
    const r = cropPx(edit.crop, w, h);
    ctx.crop(r);
    w = r.width; h = r.height;
  }
  fit(ctx, w, h, MAX_SIDE);
  const out = await save(ctx);
  turnedRef.release();
  first.release();
  return out;
}
