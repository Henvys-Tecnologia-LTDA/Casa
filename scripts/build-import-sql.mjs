// Gera o SQL que copia os dados da página (exportados com ArtifactData para .migration-data/)
// para um casal novo "Camila e Luis". O casal é criado sem membros; Luis e Camila entram
// com o código de convite. Uso: node scripts/build-import-sql.mjs > .migration-data/import.sql
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = '.migration-data';
const read = coll => (existsSync(join(dir, coll)) ? readdirSync(join(dir, coll)).filter(f => f.endsWith('.json')).map(f => ({ id: f.replace(/\.json$/, ''), ...JSON.parse(readFileSync(join(dir, coll, f), 'utf8')) })) : []);
const q = v => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const ts = ms => (Number(ms) > 0 ? `to_timestamp(${Number(ms) / 1000})` : 'now()');
const day = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? q(s) : 'null');
const ym = s => (/^\d{4}-\d{2}$/.test(s || '') ? q(s) : "''");
const json = v => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const settings = existsSync(join(dir, 'settings', 'main.json')) ? JSON.parse(readFileSync(join(dir, 'settings', 'main.json'), 'utf8')) : {};
const names = settings.names || {};
const hid = randomUUID();
const out = [];
out.push('begin;');
out.push(`insert into public.households (id, name, invite_code, name_a, name_b, renda, budget_casa, budget_switch) values (${q(hid)}, 'Camila e Luis', private.new_invite_code(), ${q(names.a || 'Camila')}, ${q(names.b || 'Luis')}, ${Number(settings.renda) || 0}, ${Number(settings.budget?.casa) || 0}, ${Number(settings.budget?.switch) || 0});`);

const secMap = new Map();
for (const s of read('sections')) {
  const id = randomUUID();
  secMap.set(s.id, id);
  out.push(`insert into public.sections (id, household_id, list, name, icon, sort_order, budget) values (${q(id)}, ${q(hid)}, ${q(s.list === 'switch' ? 'switch' : 'casa')}, ${q(s.name)}, ${q(s.icon || 'box')}, ${Number(s.order) || 0}, ${Number(s.budget) || 0});`);
}

let skipped = 0;
for (const i of read('items')) {
  const sid = secMap.get(i.section);
  if (!sid) { skipped++; continue; }
  const opts = Array.isArray(i.options) ? i.options.filter(o => o && o.id).map(o => ({ id: String(o.id), name: o.name || '', store: o.store || '', price: Number(o.price) || 0, link: o.link || '', image: '', likes: [] })) : [];
  const paid = typeof i.paid === 'number' ? i.paid : null;
  out.push(`insert into public.items (id, household_id, section_id, name, price, qty, priority, phase, coop, notes, image, store, link, options, chosen, bought, gift, paid, payer, parcelas, parc_start, bought_at, estimado, created_at, updated_at) values (${q(randomUUID())}, ${q(hid)}, ${q(sid)}, ${q(i.name)}, ${Number(i.price) || 0}, ${Math.max(1, parseInt(i.qty, 10) || 1)}, ${q(['alta', 'media', 'baixa'].includes(i.priority) ? i.priority : 'media')}, ${q(['antes', 'mes1', 'calma'].includes(i.phase) ? i.phase : '')}, ${!!i.coop}, ${q(i.notes || '')}, '', ${q(i.store || '')}, ${q(i.link || '')}, ${json(opts)}, ${q(opts.some(o => o.id === i.chosen) ? i.chosen : '')}, ${!!i.bought}, ${!!i.gift}, ${paid === null ? 'null' : paid}, ${q(['a', 'b', 'ambos'].includes(i.payer) ? i.payer : '')}, ${Math.min(48, Math.max(1, parseInt(i.parcelas, 10) || 1))}, ${ym(i.parcStart)}, ${i.bought && i.boughtAt ? ts(i.boughtAt) : 'null'}, ${!!i.estimado}, ${ts(i.createdAt)}, ${ts(i.updatedAt || i.createdAt)});`);
}

for (const t of read('tasks')) {
  out.push(`insert into public.tasks (id, household_id, title, phase, who, due, notes, done, done_at, created_at, updated_at) values (${q(randomUUID())}, ${q(hid)}, ${q(t.title)}, ${q(['antes', 'mes1', 'calma'].includes(t.phase) ? t.phase : '')}, ${q(['a', 'b', 'ambos'].includes(t.who) ? t.who : '')}, ${day(t.due)}, ${q(t.notes || '')}, ${!!t.done}, ${t.done && t.doneAt ? ts(t.doneAt) : 'null'}, ${ts(t.createdAt)}, ${ts(t.updatedAt || t.createdAt)});`);
}

for (const a of read('apartments')) {
  out.push(`insert into public.apartments (id, household_id, name, address, link, status, price, area, rooms, parking, entrada, fgts, entrada_tipo, entrada_parcelas, inicio, inicio_mes, taxa, prazo, seguro, sistema, condo, iptu, itbi, cartorio, notes, image, favorite, created_at, updated_at) values (${q(randomUUID())}, ${q(hid)}, ${q(a.name || 'Sem nome')}, ${q(a.address || '')}, ${q(a.link || '')}, ${q(['visitar', 'visitado', 'proposta', 'descartado'].includes(a.status) ? a.status : 'visitar')}, ${Number(a.price) || 0}, ${Number(a.area) || 0}, ${parseInt(a.rooms, 10) || 0}, ${parseInt(a.parking, 10) || 0}, ${Number(a.entrada) || 0}, ${Number(a.fgts) || 0}, ${q(a.entradaTipo === 'parcelada' ? 'parcelada' : 'vista')}, ${Math.min(240, Math.max(1, parseInt(a.entradaParcelas, 10) || 24))}, ${q(a.inicio === 'junto' ? 'junto' : 'depois')}, ${ym(a.inicioMes)}, ${Number(a.taxa) || 0}, ${Math.min(480, Math.max(1, parseInt(a.prazo, 10) || 360))}, ${Number(a.seguro) || 0}, ${q(a.sistema === 'PRICE' ? 'PRICE' : 'SAC')}, ${Number(a.condo) || 0}, ${Number(a.iptu) || 0}, ${Number(a.itbi) || 0}, ${Number(a.cartorio) || 0}, ${q(a.notes || '')}, '', ${!!a.favorite}, ${ts(a.createdAt)}, ${ts(a.updatedAt || a.createdAt)});`);
}

const CATS = ['passagens', 'hospedagem', 'passeios', 'alimentacao', 'transporte', 'seguro', 'compras', 'outros'];
for (const t of read('trips')) {
  const tid = randomUUID();
  out.push(`insert into public.trips (id, household_id, name, destination, start_date, end_date, status, people, notes, image, created_at, updated_at) values (${q(tid)}, ${q(hid)}, ${q(t.name || 'Viagem')}, ${q(t.destination || '')}, ${day(t.start)}, ${day(t.end)}, ${q(['sonho', 'planejando', 'confirmada', 'feita'].includes(t.status) ? t.status : 'planejando')}, ${Math.max(1, parseInt(t.people, 10) || 2)}, ${q(t.notes || '')}, '', ${ts(t.createdAt)}, ${ts(t.updatedAt || t.createdAt)});`);
  for (const c of t.costs || []) {
    out.push(`insert into public.trip_costs (id, household_id, trip_id, descr, cat, amount, parcelas, parc_start, paid) values (${q(randomUUID())}, ${q(hid)}, ${q(tid)}, ${q(c.desc || '')}, ${q(CATS.includes(c.cat) ? c.cat : 'outros')}, ${Number(c.amount) || 0}, ${Math.min(48, Math.max(1, parseInt(c.parcelas, 10) || 1))}, ${ym(c.parcStart)}, ${!!c.paid});`);
  }
  for (const d of t.deposits || []) {
    if (!Number(d.amount)) continue;
    out.push(`insert into public.trip_deposits (id, household_id, trip_id, amount, created_at) values (${q(randomUUID())}, ${q(hid)}, ${q(tid)}, ${Number(d.amount)}, ${ts(d.at)});`);
  }
  for (const p of t.packing || []) {
    out.push(`insert into public.packing_items (id, household_id, trip_id, text, done) values (${q(randomUUID())}, ${q(hid)}, ${q(tid)}, ${q(p.text || '')}, ${!!p.done});`);
  }
}

for (const g of read('goals')) {
  const gid = randomUUID();
  out.push(`insert into public.goals (id, household_id, name, target, deadline, created_at, updated_at) values (${q(gid)}, ${q(hid)}, ${q(g.name || 'Meta')}, ${Number(g.target) || 0}, ${ym(g.deadline)}, ${ts(g.createdAt)}, ${ts(g.updatedAt || g.createdAt)});`);
  for (const d of g.deposits || []) {
    if (!Number(d.amount)) continue;
    out.push(`insert into public.goal_deposits (id, household_id, goal_id, amount, who, created_at) values (${q(randomUUID())}, ${q(hid)}, ${q(gid)}, ${Number(d.amount)}, ${q(['a', 'b'].includes(d.who) ? d.who : 'ambos')}, ${ts(d.at)});`);
  }
}

out.push(`select id, name, invite_code from public.households where id = ${q(hid)};`);
out.push('commit;');
if (skipped) out.unshift(`-- ${skipped} item(ns) sem cômodo foram ignorados`);
console.log(out.join('\n'));
