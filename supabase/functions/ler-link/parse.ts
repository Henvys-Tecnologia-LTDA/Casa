// Lê nome, foto, preço e loja do HTML de uma página de produto: meta tags (Open Graph, Twitter,
// itemprop) e dados estruturados (JSON-LD "Product"), que quase toda loja publica para o Google.
// Sem dependências: roda na função ler-link (servidor), no app (src/lib/link.ts, lendo direto do
// celular) e no Node (scripts/check-link.ts).

export interface LinkInfo { title: string; image: string; price: number | null; store: string; url: string }

const LOJAS: Record<string, string> = {
  'amazon.com.br': 'Amazon', 'magazineluiza.com.br': 'Magalu', 'mercadolivre.com.br': 'Mercado Livre', 'kabum.com.br': 'KaBuM!',
  'casasbahia.com.br': 'Casas Bahia', 'pontofrio.com.br': 'Ponto', 'extra.com.br': 'Extra', 'americanas.com.br': 'Americanas',
  'submarino.com.br': 'Submarino', 'shoptime.com.br': 'Shoptime', 'tokstok.com.br': 'Tok&Stok', 'leroymerlin.com.br': 'Leroy Merlin',
  'mobly.com.br': 'Mobly', 'madeiramadeira.com.br': 'MadeiraMadeira', 'westwing.com.br': 'Westwing', 'camicado.com.br': 'Camicado',
  'shopee.com.br': 'Shopee', 'carrefour.com.br': 'Carrefour', 'fastshop.com.br': 'Fast Shop', 'nintendo.com': 'Nintendo',
  'aliexpress.com': 'AliExpress', 'etna.com.br': 'Etna', 'havan.com.br': 'Havan', 'zara.com': 'Zara', 'cea.com.br': 'C&A',
};

/** Nome da loja: o conhecido (Magalu, Amazon…), senão o que o site declara, senão o domínio. */
export function storeOf(url: string, siteName = ''): string {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return siteName; }
  for (const [dom, nome] of Object.entries(LOJAS)) if (host === dom || host.endsWith(`.${dom}`)) return nome;
  if (siteName) return siteName;
  const base = host.replace(/\.(com|net|org)(\.br)?$|\.br$/, '').split('.').pop() || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ccedil: 'ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à' };
export function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

// "R$ 1.299,90", "1299.90", 1299.9 → 1299.9
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  let s = String(v ?? '').replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function metas(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (n: string) => tag.match(new RegExp(`\\b${n}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
    const key = attr('property') ?? attr('name') ?? attr('itemprop');
    const val = attr('content');
    if (!key || !val) continue;
    const k = (key[2] ?? key[3] ?? '').toLowerCase();
    if (k && !out.has(k)) out.set(k, decode(val[2] ?? val[3] ?? ''));
  }
  return out;
}

type Json = Record<string, unknown>;
function products(html: string): Json[] {
  const out: Json[] = [];
  const visit = (x: unknown) => {
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (!x || typeof x !== 'object') return;
    const o = x as Json;
    const t = o['@type'];
    if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) out.push(o);
    if (o['@graph']) visit(o['@graph']);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1].trim())); } catch { /* JSON quebrado: ignora */ }
  }
  return out;
}

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
function imageOf(v: unknown): string {
  const x = first(v);
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object') return String((x as Json).url ?? (x as Json).contentUrl ?? '');
  return '';
}
function priceOf(p: Json): number | null {
  for (const off of ([] as unknown[]).concat(p.offers ?? [])) {
    if (!off || typeof off !== 'object') continue;
    const o = off as Json;
    const cur = String(o.priceCurrency ?? 'BRL').toUpperCase();
    if (cur !== 'BRL') continue;
    const spec = first(o.priceSpecification) as Json | undefined;
    const v = num(o.price) ?? num(o.lowPrice) ?? (spec ? num(spec.price) : null);
    if (v) return v;
  }
  return null;
}

/** Página de bloqueio/captcha em vez do produto (comum na Amazon, no Magalu e em sites com Cloudflare). */
export const blocked = (i: LinkInfo) =>
  !i.price && /robot check|captcha|access denied|attention required|just a moment|are you a human|acesso negado|verifica[çc][ãa]o de seguran|n[ãa]o [ée] poss[ií]vel acessar/i.test(i.title);

/** Achou um produto de verdade: tem nome, não é bloqueio e veio pelo menos a foto ou o preço. */
export const useful = (i: LinkInfo) => !!i.title && !blocked(i) && (!!i.price || !!i.image);

// Tira o nome da loja que vem grudado no título ("… | Amazon.com.br").
const LOJA_NO_TITULO = /\s*[|–-]\s*(amazon\.com\.br|magazine luiza|magalu|kabum!?|mercado livre|americanas|casas bahia|submarino|shoptime)\s*$/i;
const cleanTitle = (t: string) => t.replace(/^amazon\.com\.br:\s*/i, '').replace(LOJA_NO_TITULO, '').trim();

// Endereço "limpo" do produto: o canônico da página, se for do mesmo site e fizer sentido; senão o
// próprio endereço, sem parâmetros de rastreio (ref, utm_…).
function cleanUrl(html: string, pageUrl: string): string {
  const tag = html.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i)?.[0] ?? '';
  const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  try {
    const page = new URL(pageUrl);
    if (href) {
      const c = new URL(decode(href), page);
      if (c.hostname.replace(/^www\./, '') === page.hostname.replace(/^www\./, '') && !/\/(false|undefined|null)\/?$/.test(c.pathname)) return c.toString();
    }
    for (const k of [...page.searchParams.keys()]) if (/^(ref|ref_|social_share|utm_.*|gclid|fbclid|pf_rd_.*|pd_rd_.*|psc|th)$/i.test(k)) page.searchParams.delete(k);
    return page.toString();
  } catch { return pageUrl; }
}

const abs = (u: string, base: string) => { try { return u ? new URL(u, base).toString() : ''; } catch { return ''; } };

export function parse(html: string, pageUrl: string): LinkInfo {
  const m = metas(html);
  const p = products(html)[0];
  const titleTag = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const title = cleanTitle(decode(String(p?.name ?? '')) || m.get('og:title') || m.get('twitter:title') || titleTag);
  // Amazon não usa meta tags: a foto grande fica em data-old-hires/"hiRes" e o preço em .a-offscreen.
  const amazonImg = html.match(/data-old-hires\s*=\s*"(https:[^"]+)"/i)?.[1] ?? html.match(/"hiRes"\s*:\s*"(https:[^"]+)"/)?.[1] ?? '';
  const image = abs(imageOf(p?.image) || m.get('og:image:secure_url') || m.get('og:image') || m.get('twitter:image') || m.get('image') || amazonImg, pageUrl);
  const metaCur = (m.get('product:price:currency') || m.get('og:price:currency') || 'BRL').toUpperCase();
  const metaPrice = metaCur === 'BRL' ? num(m.get('product:price:amount') ?? m.get('og:price:amount') ?? m.get('price') ?? '') : null;
  const offscreen = html.match(/class\s*=\s*"a-offscreen"\s*>\s*(R\$[^<]{1,30})</i)?.[1];
  const price = (p ? priceOf(p) : null) ?? metaPrice ?? (offscreen ? num(decode(offscreen)) : null);
  const url = cleanUrl(html, pageUrl);
  const store = storeOf(pageUrl, m.get('og:site_name') || '');
  return { title: title.slice(0, 200), image, price, store, url };
}
