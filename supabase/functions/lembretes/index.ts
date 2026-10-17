// Avisos das 9h: o lembrete da Mudança ("Para hoje: …" e as atrasadas), as contas da casa a vencer e o "baixou de preço" dos itens
// com link (conferidos às 8h pela função ler-link). Quem chama é o cron do banco (private.kick_lembretes),
// com a mesma senha da função notify. Fica separado da notify para um erro aqui nunca derrubar os avisos
// normais; manda pelo Expo (app Android) e por web push (site instalado).
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false });
const SITE = 'https://casa-a-dois-pied.vercel.app';

type Device = { kind: 'expo' | 'web'; endpoint: string; keys: { p256dh: string; auth: string } | null };
type Rem = { household: string; tabLabel: string; hoje: string[]; atrasadas: string[]; devices: Device[] };
type Queda = { name: string; store: string; from: number; to: number; section: string };
type Alerta = { household: string; list: string; tabLabel: string; drops: Queda[]; devices: Device[] };
type Conta = { name: string; amount: number; dias: number };
type Contas = { household: string; tabLabel: string; contas: Conta[]; devices: Device[] };
type Msg = { title: string; body: string; url: string; household: string; devices: Device[] };

const q = (s: string) => `“${s}”`;
const money = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(Number(n) || 0));
function names(list: string[]) {
  const xs = list.filter(Boolean).map(q);
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length <= 3) return `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`;
  return `${xs.slice(0, 3).join(', ')} e mais ${xs.length - 3}`;
}

export function texto(r: Pick<Rem, 'hoje' | 'atrasadas'>) {
  const h = r.hoje.length, a = r.atrasadas.length;
  if (!a) return `Para hoje: ${names(r.hoje)}`;
  const atras = a === 1 ? `1 tarefa atrasada: ${names(r.atrasadas)}` : `${a} tarefas atrasadas: ${names(r.atrasadas)}`;
  return h ? `Para hoje: ${names(r.hoje)}. E ${atras.charAt(0).toLowerCase()}${atras.slice(1)}` : atras;
}

export function textoQueda(drops: Queda[]) {
  if (drops.length === 1) {
    const d = drops[0];
    return `${q(d.name)} baixou de ${money(d.from)} para ${money(d.to)}${d.store ? ` na ${d.store}` : ''}`;
  }
  const xs = drops.slice(0, 3).map(d => `${q(d.name)} (−${money(d.from - d.to)})`);
  return `${drops.length} itens baixaram de preço: ${xs.join(', ')}${drops.length > 3 ? ` e mais ${drops.length - 3}` : ''}`;
}

const quando = (dias: number) => (dias < 0 ? 'venceu ontem' : dias === 0 ? 'vence hoje' : `vence em ${dias} dias`);

export function textoContas(cs: Conta[]) {
  if (cs.length === 1) {
    const c = cs[0];
    return `${q(c.name)} ${quando(c.dias)}${Number(c.amount) ? ` (${money(c.amount)})` : ''}`;
  }
  const xs = cs.slice(0, 3).map(c => `${q(c.name)} ${quando(c.dias)}`);
  return `${cs.length} contas: ${xs.join(', ')}${cs.length > 3 ? ` e mais ${cs.length - 3}` : ''}`;
}

Deno.serve(async req => {
  const secret = req.headers.get('x-notify-secret') ?? '';
  const [ok] = secret
    ? await sql`select 1 from vault.decrypted_secrets where name = 'notify_secret' and decrypted_secret = ${secret}`
    : [];
  if (!ok) return new Response('forbidden', { status: 403 });

  const [{ list }] = await sql`select private.take_task_reminders() as list`;
  const [{ alerts }] = await sql`select private.take_price_alerts() as alerts`;
  const [{ bills }] = await sql`select private.take_bill_reminders() as bills`;
  const msgs: Msg[] = [
    ...(list as Rem[]).map(r => ({ title: `${r.tabLabel}: lembrete do dia`, body: texto(r), url: '/mudanca', household: r.household, devices: r.devices })),
    ...(alerts as Alerta[]).map(a => ({
      title: `${a.tabLabel}: baixou de preço`, body: textoQueda(a.drops),
      url: a.drops.length === 1 ? `/section/${a.drops[0].section}` : `/${a.list}`, household: a.household, devices: a.devices,
    })),
    ...(bills as Contas[]).map(c => ({ title: `${c.tabLabel}: contas da casa`, body: textoContas(c.contas), url: '/dinheiro', household: c.household, devices: c.devices })),
  ];
  if (!msgs.length) return Response.json({ avisos: 0 });

  // As chaves do web push são criadas pela função notify na primeira vez que ela roda.
  const [row] = await sql`select decrypted_secret as v from vault.decrypted_secrets where name = 'vapid_keys' limit 1`;
  const server = row
    ? await webpush.ApplicationServer.new({ contactInformation: SITE, vapidKeys: await webpush.importVapidKeys(JSON.parse(row.v)) })
    : null;

  const gone: string[] = [];
  const expo: Record<string, unknown>[] = [];
  let web = 0, failed = 0;
  for (const m of msgs) {
    const payload = { title: m.title, body: m.body, url: m.url };
    for (const d of m.devices) {
      if (d.kind === 'expo') {
        expo.push({ to: d.endpoint, title: m.title, body: m.body, data: { url: m.url, household: m.household }, sound: 'default', channelId: 'avisos', priority: 'high' });
      } else if (d.keys && server) {
        try {
          await server.subscribe({ endpoint: d.endpoint, keys: d.keys })
            .pushTextMessage(JSON.stringify({ ...payload, household: m.household }), { urgency: webpush.Urgency.Normal, ttl: 43200 });
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
  return Response.json({ lembretes: (list as Rem[]).length, precos: (alerts as Alerta[]).length, contas: (bills as Contas[]).length, expo: expo.length, web, failed, gone: gone.length });
});
