// Envia os avisos do casal. Quem chama é o cron do banco (private.kick_push), a cada minuto em que há
// grupos prontos. Cada grupo (mesma pessoa, aba e tipo) vira um aviso só, mandado pelo Expo (app Android)
// ou por web push (site instalado no iPhone ou no computador). Aparelhos que não existem mais saem da lista.
// Na primeira execução cria as chaves VAPID do web push e guarda no Vault.
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false });
const SITE = 'https://casa-a-dois-pied.vercel.app';

type Device = { kind: 'expo' | 'web'; endpoint: string; keys: { p256dh: string; auth: string } | null };
type Ev = { tbl: string; label: string; link: string; extra: { amount?: number; status?: string; parent?: string } };
type Batch = {
  household: string; tab: string; tabLabel: string; kind: 'novo' | 'feito'; actor: string; events: Ev[]; devices: Device[];
};

Deno.serve(async req => {
  const secret = req.headers.get('x-notify-secret') ?? '';
  const [ok] = secret
    ? await sql`select 1 from vault.decrypted_secrets where name = 'notify_secret' and decrypted_secret = ${secret}`
    : [];
  if (!ok) return new Response('forbidden', { status: 403 });

  const server = await appServer();
  const [{ batches }] = await sql`select private.take_push_batches() as batches`;
  const gone: string[] = [];
  const expo: Record<string, unknown>[] = [];
  let web = 0;
  let failed = 0;

  for (const b of batches as Batch[]) {
    const msg = compose(b);
    for (const d of b.devices) {
      if (d.kind === 'expo') {
        expo.push({
          to: d.endpoint, title: msg.title, body: msg.body, data: { url: msg.url, household: b.household },
          sound: 'default', channelId: 'avisos', priority: 'high',
        });
      } else if (d.keys) {
        try {
          await server.subscribe({ endpoint: d.endpoint, keys: d.keys })
            .pushTextMessage(JSON.stringify({ ...msg, household: b.household }), { urgency: webpush.Urgency.High, ttl: 86400 });
          web++;
        } catch (e) {
          const status = e instanceof webpush.PushMessageError ? e.response.status : 0;
          if (status === 404 || status === 410) gone.push(d.endpoint);
          else { failed++; console.error('web push', status, String(e)); }
        }
      }
    }
  }

  for (let i = 0; i < expo.length; i += 100) {
    const chunk = expo.slice(i, i + 100);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => null);
      (json?.data ?? []).forEach((t: { status: string; message?: string; details?: { error?: string } }, k: number) => {
        if (t.status !== 'error') return;
        if (t.details?.error === 'DeviceNotRegistered') gone.push(String(chunk[k].to));
        else { failed++; console.error('expo', t.details?.error, t.message); }
      });
      if (!res.ok && !json?.data) { failed += chunk.length; console.error('expo', res.status, JSON.stringify(json)); }
    } catch (e) {
      failed += chunk.length;
      console.error('expo', String(e));
    }
  }

  if (gone.length) await sql`delete from private.push_devices where endpoint in ${sql(gone)}`;
  return Response.json({ batches: batches.length, expo: expo.length, web, failed, gone: gone.length });
});

async function appServer() {
  const [row] = await sql`select decrypted_secret as v from vault.decrypted_secrets where name = 'vapid_keys' limit 1`;
  let exported: webpush.ExportedVapidKeys;
  if (row) {
    exported = JSON.parse(row.v);
  } else {
    const keys = await webpush.generateVapidKeys({ extractable: true });
    exported = await webpush.exportVapidKeys(keys);
    const pub = await webpush.exportApplicationServerKey(keys);
    await sql`select vault.create_secret(${JSON.stringify(exported)}, 'vapid_keys', 'Chaves VAPID do web push')`;
    await sql`select vault.create_secret(${pub}, 'vapid_public', 'Chave pública VAPID (o app usa para se inscrever)')`;
  }
  const vapidKeys = await webpush.importVapidKeys(exported);
  return webpush.ApplicationServer.new({ contactInformation: SITE, vapidKeys });
}

const NOUN: Record<string, string> = {
  items: 'itens', tasks: 'tarefas', apartments: 'apês', trips: 'viagens', trip_costs: 'custos', goals: 'metas',
};
const STATUS: Record<string, string> = { visitar: 'a visitar', visitado: 'visitado', proposta: 'proposta', descartado: 'descartado' };
const money = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(n));
const q = (s: string | undefined) => `“${s || 'sem nome'}”`;

function names(list: string[]) {
  const xs = list.filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length <= 3) return `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`;
  return `${xs.slice(0, 3).join(', ')} e mais ${xs.length - 3}`;
}

function one(who: string, kind: string, e: Ev) {
  const amount = Number(e.extra.amount) || 0;
  switch (`${e.tbl}:${kind}`) {
    case 'items:novo': return `${who} adicionou ${q(e.label)}`;
    case 'items:feito': return `${who} comprou ${q(e.label)}`;
    case 'tasks:novo': return `${who} adicionou a tarefa ${q(e.label)}`;
    case 'tasks:feito': return `${who} concluiu ${q(e.label)}`;
    case 'apartments:novo': return `${who} adicionou o apê ${q(e.label)}`;
    case 'apartments:feito': return `${who} marcou ${q(e.label)} como ${STATUS[e.extra.status ?? ''] ?? e.extra.status}`;
    case 'trips:novo': return `${who} criou a viagem ${q(e.label)}`;
    case 'trip_costs:novo': return `${who} adicionou o custo ${q(e.label)}${e.extra.parent ? ` em ${q(e.extra.parent)}` : ''}`;
    case 'trip_deposits:feito':
      return amount < 0 ? `${who} tirou ${money(amount)} do cofrinho de ${q(e.label)}` : `${who} guardou ${money(amount)} no cofrinho de ${q(e.label)}`;
    case 'goals:novo': return `${who} criou a meta ${q(e.label)}`;
    case 'goal_deposits:feito':
      return amount < 0 ? `${who} tirou ${money(amount)} da meta ${q(e.label)}` : `${who} guardou ${money(amount)} na meta ${q(e.label)}`;
  }
  return `${who} mexeu em ${q(e.label)}`;
}

function compose(b: Batch) {
  const ev = b.events;
  const tbls = new Set(ev.map(e => e.tbl));
  const links = new Set(ev.map(e => e.link));
  const url = links.size === 1 ? ev[0].link : `/${b.tab}`;
  if (ev.length === 1) return { title: b.tabLabel, body: one(b.actor, b.kind, ev[0]), url };

  const same = tbls.size === 1 ? ev[0].tbl : '';
  let body: string;
  if (same.endsWith('_deposits')) {
    const total = ev.reduce((s, e) => s + (Number(e.extra.amount) || 0), 0);
    body = `${b.actor} fez ${ev.length} depósitos (${total < 0 ? 'menos ' : ''}${money(total)} no total)`;
  } else {
    const what = same ? NOUN[same] ?? 'coisas' : 'novidades';
    const verb = b.kind === 'novo' ? 'adicionou'
      : same === 'items' ? 'comprou' : same === 'tasks' ? 'concluiu' : same === 'apartments' ? 'atualizou' : 'mexeu em';
    body = `${b.actor} ${verb} ${ev.length} ${what}: ${names(ev.map(e => e.label))}`;
  }
  return { title: b.tabLabel, body, url };
}
