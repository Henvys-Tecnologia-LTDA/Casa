// Gera o ícone, o adaptive icon do Android, a splash e o favicon a partir de assets/brand/marca.svg.
// O sharp não é dependência do app; instale só para rodar:
//   npm i --no-save sharp && node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
const marca = readFileSync(new URL('../assets/brand/marca.svg', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const out = name => fileURLToPath(new URL(`../assets/images/${name}`, import.meta.url));

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
  { name: 'icon.png', size: 1024, box: 0.72, tile: true, opaque: true },
  // Adaptive icon: o fundo vem de android.adaptiveIcon.backgroundColor; a marca fica dentro do
  // círculo seguro (66 de 108 dp), com folga para qualquer máscara do launcher.
  { name: 'android-icon-foreground.png', size: 1024, box: 0.54 },
  { name: 'android-icon-monochrome.png', size: 1024, box: 0.54, color: INK },
  // Splash: fundo vem do plugin expo-splash-screen; a imagem é exibida com imageWidth.
  { name: 'splash-icon.png', size: 1024, box: 1 },
  // Favicon: com fundo, para não sumir em aba escura; traço mais grosso para 16–48 px.
  { name: 'favicon.png', size: 48, box: 0.86, stroke: 2, tile: true, radius: 0.22 },
];

for (const a of ASSETS) {
  let img = sharp(svg(a.size, a), { density: 72 });
  if (a.opaque) img = img.flatten({ background: BG });
  await img.png({ compressionLevel: 9 }).toFile(out(a.name));
  console.log(`${a.name} ${a.size}x${a.size}`);
}
