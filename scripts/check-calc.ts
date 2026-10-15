// Confere que simulate() do app dá os mesmos números que a função original da página.
// Uso: npx tsx scripts/check-calc.ts <caminho do HTML da página>
import { readFileSync } from 'node:fs';

import { simulate } from '../src/lib/calc';

const htmlPath = process.argv[2];
if (!htmlPath) throw new Error('Passe o caminho do HTML da página.');
const html = readFileSync(htmlPath, 'utf8');
const start = html.indexOf('function simulate(a) {');
const end = html.indexOf('const aptsSorted', start);
const src = html.slice(start, end);
// money() da página usa Intl; para comparar só os números, o texto da linha do tempo fica de fora.
const original = new Function('money', `${src}; return simulate;`)((n: number) => String(n)) as (a: any) => any;

const cases = [
  { price: 450000, entrada: 90000, fgts: 0, prazo: 360, taxa: 11.5, seguro: 120, entradaTipo: 'parcelada', entradaParcelas: 24, inicio: 'depois', sistema: 'SAC', condo: 550, iptu: 120, itbi: 3, cartorio: 1.5 },
  { price: 450000, entrada: 90000, fgts: 20000, prazo: 360, taxa: 11.5, seguro: 120, entradaTipo: 'vista', entradaParcelas: 24, inicio: 'depois', sistema: 'PRICE', condo: 550, iptu: 120, itbi: 3, cartorio: 1.5 },
  { price: 320000, entrada: 64000, fgts: 0, prazo: 420, taxa: 9.99, seguro: 80, entradaTipo: 'parcelada', entradaParcelas: 36, inicio: 'junto', sistema: 'PRICE', condo: 400, iptu: 90, itbi: 2, cartorio: 1 },
  { price: 200000, entrada: 200000, fgts: 0, prazo: 360, taxa: 0, seguro: 0, entradaTipo: 'vista', entradaParcelas: 1, inicio: 'depois', sistema: 'SAC', condo: 0, iptu: 0, itbi: 3, cartorio: 1.5 },
  { price: 500000, entrada: 50000, fgts: 10000, prazo: 240, taxa: 0, seguro: 50, entradaTipo: 'parcelada', entradaParcelas: 12, inicio: 'depois', sistema: 'PRICE', condo: 700, iptu: 200, itbi: 3, cartorio: 2 },
];

const KEYS = ['price', 'entrada', 'fgts', 'P', 'n', 'ia', 'seg', 'parcelada', 'ne', 'entradaMes', 'start', 'sistema', 'firstFin', 'lastFin', 'juros',
  'totalBanco', 'fixed', 'itbiV', 'cartV', 'custos', 'cash', 'monthlyKeys', 'peak', 'entPct', 'low20', 'totalCost'];

let fails = 0;
for (const c of cases) {
  const o = original(c);
  const m: any = simulate({
    price: c.price, entrada: c.entrada, fgts: c.fgts, prazo: c.prazo, taxa: c.taxa, seguro: c.seguro, entrada_tipo: c.entradaTipo as any,
    entrada_parcelas: c.entradaParcelas, inicio: c.inicio as any, sistema: c.sistema as any, condo: c.condo, iptu: c.iptu, itbi: c.itbi, cartorio: c.cartorio,
  });
  for (const k of KEYS) {
    const a = o[k], b = m[k];
    const same = typeof a === 'number' ? Math.abs(a - b) < 1e-6 : a === b;
    if (!same) { fails++; console.log(`DIFERENTE ${k}: página=${a} app=${b}`, c); }
  }
  if (JSON.stringify(o.months) !== JSON.stringify(m.months) || JSON.stringify(o.years) !== JSON.stringify(m.years)) {
    fails++; console.log('DIFERENTE meses/anos', c);
  }
  console.log(`${c.sistema} ${c.entradaTipo}: 1ª parcela ${m.firstFin.toFixed(2)} · na mão ${m.cash.toFixed(2)} · juros ${m.juros.toFixed(2)}`);
}
console.log(fails ? `${fails} diferença(s)` : 'OK: simulate() do app = simulate() da página em todos os casos');
process.exit(fails ? 1 : 0);
