// Gera o ícone, o adaptive icon do Android, a splash, o favicon e os ícones de instalação da web
// (public/) a partir de assets/brand/marca.svg.
// O sharp não é dependência do app; instale só para rodar:
//   npm i --no-save sharp && node scripts/make-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('Falta o sharp. Rode: npm i --no-save sharp && node scripts/make-icons.mjs');
  process.exit(1);
}

const BG = '#FBF1EF';
const INK = '#2A2320';
const marca = readFileSync(new URL('../assets/brand/marca.svg', import.meta.url), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n');
const out = file => {
  const p = fileURLToPath(new URL(`../${file}`, import.meta.url));
  mkdirSync(dirname(p), { recursive: true });
  return p;
};

// A marca (traço incluso) ocupa ~85% da caixa 24x24 e cabe num círculo de 95% da meia caixa.
// box: lado da caixa em fração da imagem · color: pinta tudo de uma cor · stroke: traço mais grosso
// para tamanhos pequenos · tile: fundo cor de papel (radius em fração do lado).
function svg(size, { box, color, stroke, tile, radius = 0 }) {
  let m = marca;
  if (color) m = m.replace(/stroke="#[0-9A-Fa-f]{6}"/g, `stroke="${color}"`);
  if (stroke) m = m.replace(/stroke-width="[\d.]+"/, `stroke-width="${stroke}"`);
  const side = size * box, off = (size - side) / 2;
  m = m.replace('<svg ', `<svg x="${off}" y="${off}" width="${side}" height="${side}" `);
  const bg = tile ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${BG}"/>` : '';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg}${m}</svg>`);
}

const ASSETS = [
  // iOS e Android antigo: quadrado cheio, sem transparência (a loja da Apple recusa alfa).
  { file: 'assets/images/icon.png', size: 1024, box: 0.72, tile: true, opaque: true },
  // Adaptive icon: o fundo vem de android.adaptiveIcon.backgroundColor; a marca fica dentro do
  // círculo seguro (66 de 108 dp), com folga para qualquer máscara do launcher.
  { file: 'assets/images/android-icon-foreground.png', size: 1024, box: 0.54 },
  { file: 'assets/images/android-icon-monochrome.png', size: 1024, box: 0.54, color: INK },
  // Splash: fundo vem do plugin expo-splash-screen; a imagem é exibida com imageWidth.
  { file: 'assets/images/splash-icon.png', size: 1024, box: 1 },
  // Favicon: com fundo, para não sumir em aba escura; traço mais grosso para 16–48 px.
  { file: 'assets/images/favicon.png', size: 48, box: 0.86, stroke: 2, tile: true, radius: 0.22 },
  // Web instalada (public/manifest.json e public/index.html). O iPhone arredonda o ícone sozinho.
  { file: 'public/apple-touch-icon.png', size: 180, box: 0.72, tile: true, opaque: true },
  { file: 'public/icon-192.png', size: 192, box: 0.78, tile: true, radius: 0.22 },
  { file: 'public/icon-512.png', size: 512, box: 0.78, tile: true, radius: 0.22 },
  // Maskable: o launcher recorta como quiser; a marca fica dentro do círculo seguro de 80%.
  { file: 'public/icon-maskable-512.png', size: 512, box: 0.6, tile: true, opaque: true },
];

for (const a of ASSETS) {
  let img = sharp(svg(a.size, a), { density: 72 });
  if (a.opaque) img = img.flatten({ background: BG });
  await img.png({ compressionLevel: 9 }).toFile(out(a.file));
  console.log(`${a.file} ${a.size}x${a.size}`);
}

// A casinha que aparece no public/index.html enquanto o JS carrega.
writeFileSync(out('public/marca.svg'), marca);
console.log('public/marca.svg');
