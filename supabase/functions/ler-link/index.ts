// "Colar link" no item: abre a página do produto e devolve nome, foto, preço e loja (parse.ts).
// Só para quem está logado no app, só endereços públicos http(s) e com limite de tempo e de tamanho.
// Também confere os preços do dia para o "baixou de preço" (modo vigiar, chamado pelo cron) e, no
// modo foto, baixa a foto de um produto para o editor de foto do navegador (que não pode ler fotos
// de lojas que não liberam CORS).
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';

import { blocked, parse, useful, type LinkInfo } from './parse.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const MAX_BYTES = 3_000_000; // a página de um produto na Amazon tem quase 2 MB

async function loggedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const apikey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  return res.ok;
}

// Nada de rede interna: localhost, IPs privados e nomes sem domínio ficam de fora.
function publicUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
  }
  if (h.includes(':')) return null; // IPv6 literal
  return u;
}

async function readText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c.subarray(0, Math.min(c.length, size - at)), at); at += c.length; }
  const charset = (res.headers.get('content-type') ?? '').match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8';
  try { return new TextDecoder(charset).decode(all); } catch { return new TextDecoder().decode(all); }
}

type Lido = { info: LinkInfo } | { error: string; status: number };

// Abre a página (seguindo até 5 redirecionamentos, todos públicos) e lê o produto.
async function ler(raw: string): Promise<Lido> {
  let url = publicUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!url) return { error: 'Esse não parece um link de loja. Cole o endereço completo do produto.', status: 400 };
  const signal = AbortSignal.timeout(12000);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'pt-BR,pt;q=0.9',
  };
  try {
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, { headers, redirect: 'manual', signal });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        await res.body?.cancel();
        const next = publicUrl(new URL(loc, url).toString());
        if (!next || hop === 5) return { error: 'Esse link redireciona demais. Tente o endereço direto do produto.', status: 422 };
        url = next;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return { error: `A loja não deixou abrir o link (erro ${res.status}). Preencha à mão.`, status: 422 };
      }
      const info = parse(await readText(res), url.toString());
      if (!info.title || blocked(info)) return { error: 'A loja não deixou ler esse link. Preencha à mão.', status: 422 };
      if (!useful(info)) return { error: 'Esse link não parece a página de um produto. Abra o produto na loja e copie o link de lá.', status: 422 };
      return { info };
    }
  } catch (e) {
    console.error('ler-link', String(e));
    return { error: 'O site da loja não respondeu. Tente de novo ou preencha à mão.', status: 502 };
  }
  return { error: 'Não deu para ler esse link.', status: 422 };
}

// Modo "foto": baixa a imagem (só imagem, até 15 MB, seguindo redirecionamentos públicos) e devolve
// os bytes como application/octet-stream, que o supabase-js entrega como Blob.
const MAX_FOTO = 15_000_000;
async function foto(raw: string): Promise<Response> {
  let url = publicUrl(raw);
  if (!url) return json({ error: 'Endereço de foto inválido.' }, 400);
  const signal = AbortSignal.timeout(12000);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
  };
  try {
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, { headers, redirect: 'manual', signal });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        await res.body?.cancel();
        const next = publicUrl(new URL(loc, url).toString());
        if (!next || hop === 5) break;
        url = next;
        continue;
      }
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!res.ok || !type.startsWith('image/') || Number(res.headers.get('content-length') || 0) > MAX_FOTO) {
        await res.body?.cancel();
        break;
      }
      const reader = res.body?.getReader();
      if (!reader) break;
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        size += value.length;
        if (size > MAX_FOTO) { reader.cancel().catch(() => {}); return json({ error: 'Essa foto é grande demais.' }, 413); }
        chunks.push(value);
      }
      const all = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) { all.set(c, at); at += c.length; }
      return new Response(all, { headers: { ...CORS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=600' } });
    }
  } catch (e) {
    console.error('ler-link foto', String(e));
    return json({ error: 'O site da loja não respondeu. Tente de novo.' }, 502);
  }
  return json({ error: 'Não deu para baixar essa foto.' }, 422);
}

// Modo "vigiar" (cron das 8h, com a senha da função notify): confere o preço dos itens do dia, um por
// vez e com pausa entre as lojas, e guarda; a função lembretes avisa as quedas às 9h.
let db: ReturnType<typeof postgres> | null = null;
const sql = () => (db ??= postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false }));

async function cronOk(req: Request) {
  const secret = req.headers.get('x-notify-secret') ?? '';
  if (!secret) return false;
  const [ok] = await sql()`select 1 from vault.decrypted_secrets where name = 'notify_secret' and decrypted_secret = ${secret}`;
  return !!ok;
}

async function vigiar() {
  const itens = await sql()`select id, link from private.take_price_checks(20)`;
  let ok = 0, falhou = 0;
  for (const [k, it] of itens.entries()) {
    if (k) await new Promise(r => setTimeout(r, 1500));
    const r = await ler(String(it.link));
    const price = 'info' in r && r.info.price ? r.info.price : null;
    await sql()`select private.save_price_check(${it.id}, ${price})`;
    if (price) ok++; else falhou++;
  }
  return Response.json({ conferidos: itens.length, ok, falhou });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (req.headers.has('x-notify-secret')) {
    if (!(await cronOk(req))) return new Response('forbidden', { status: 403 });
    return vigiar();
  }
  if (!(await loggedIn(req))) return json({ error: 'Entre na sua conta para ler links.' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.foto) return foto(String(body.foto).trim());
  const r = await ler(String(body?.url ?? '').trim());
  return 'info' in r ? json(r.info) : json({ error: r.error }, r.status);
});
