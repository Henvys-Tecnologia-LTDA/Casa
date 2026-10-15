// Teste de ponta a ponta na API do Supabase com a chave publicável (a mesma do app):
// login, criar casal, entrar por código, isolamento entre casais (RLS), fotos e tempo real.
// Uso: node scripts/rls-test.mjs <senha das contas de teste>
import { createClient } from '@supabase/supabase-js';

const URL = 'https://xtyvinweiallepsxtpfu.supabase.co';
const KEY = 'sb_publishable_ZFwdzlmn2zU8f1BaR9HuoQ_BL0ufip6';
const PASS = process.argv[2];
if (!PASS) throw new Error('Passe a senha das contas de teste.');

const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const A = mk(), B = mk(), C = mk();
let ok = 0, bad = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ok  ', msg); } else { bad++; console.log('  FALHOU', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function login(c, email) {
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return data.user.id;
}

const ua = await login(A, 'teste.a@casa.test');
const ub = await login(B, 'teste.b@casa.test');
const uc = await login(C, 'teste.c@casa.test');
console.log('Login com e-mail e senha: 3 contas');

// Casal 1 (A cria, B entra por código) e casal 2 (C cria).
const h1 = await A.rpc('create_household', { p_name: 'Casal Teste', p_name_a: 'Ana', p_name_b: 'Beto', p_display_name: 'Ana' });
check(!h1.error && h1.data?.invite_code?.length === 8, `A cria casal (código ${h1.data?.invite_code ? '••••••••' : '?'})`);
const hid1 = h1.data.id, code1 = h1.data.invite_code;
const wrong = await B.rpc('join_household', { p_code: 'ZZZZZZZZ', p_display_name: 'Beto' });
check(!!wrong.error, 'código errado é recusado');
const j = await B.rpc('join_household', { p_code: code1.toLowerCase(), p_display_name: 'Beto' });
check(!j.error && j.data?.id === hid1, 'B entra no casal pelo código (aceita minúsculas)');
const h2 = await C.rpc('create_household', { p_name: 'Amigos Teste', p_name_a: 'Caio', p_name_b: 'Duda', p_display_name: 'Caio' });
check(!h2.error, 'C cria outro casal');
const hid2 = h2.data.id;

// Tempo real: A escuta o casal 1; C também tenta escutar o casal 1 (não deve receber nada).
const gotA = [], gotC = [];
const chA = A.channel('t-a').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `household_id=eq.${hid1}` }, p => gotA.push(p));
const chC = C.channel('t-c').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `household_id=eq.${hid1}` }, p => gotC.push(p));
await new Promise(res => { let n = 0; const done = s => { if (s === 'SUBSCRIBED' && ++n === 2) res(); }; chA.subscribe(done); chC.subscribe(done); setTimeout(res, 8000); });
await sleep(5000); // o servidor leva alguns segundos para ativar a assinatura depois do SUBSCRIBED

const t0 = Date.now();
const ins = await B.from('tasks').insert({ household_id: hid1, title: 'Tarefa criada pelo B', phase: 'antes' }).select().single();
check(!ins.error, 'B cria uma tarefa no casal 1');
for (let i = 0; i < 40 && !gotA.some(p => p.new?.id === ins.data?.id); i++) await sleep(250);
const evt = gotA.find(p => p.new?.id === ins.data?.id);
check(!!evt, `A recebe a tarefa do B em tempo real${evt ? ` (${Date.now() - t0} ms)` : ''}`);
const up = await A.from('tasks').update({ done: true, done_by: ua }).eq('id', ins.data.id).select().single();
check(!up.error && up.data.done === true, 'A marca a tarefa como feita');
for (let i = 0; i < 20 && !gotA.some(p => p.eventType === 'UPDATE'); i++) await sleep(250);
check(gotA.some(p => p.eventType === 'UPDATE' && p.new?.done === true), 'atualização chega em tempo real');
await sleep(1500);
check(gotC.length === 0, 'C (outro casal) não recebe nada do casal 1 pelo tempo real');

// Isolamento (RLS).
const cRead = await C.from('tasks').select('*').eq('household_id', hid1);
check(!cRead.error && cRead.data.length === 0, 'C não lê tarefas do casal 1');
const cAll = await C.from('households').select('id,name');
check(!cAll.error && cAll.data.some(h => h.id === hid2) && !cAll.data.some(h => h.id === hid1 || h.id === 'f4c7f81b-afee-4438-b402-f2929bf27c7d'), 'C só enxerga os próprios casais na lista de casais');
const cIns = await C.from('tasks').insert({ household_id: hid1, title: 'invasão' });
check(!!cIns.error, 'C não consegue criar tarefa no casal 1');
const cUpd = await C.from('tasks').update({ title: 'hackeado' }).eq('id', ins.data.id).select();
check(!cUpd.error && cUpd.data.length === 0, 'C não consegue alterar tarefa do casal 1');
const cDel = await C.from('tasks').delete().eq('id', ins.data.id).select();
check(!cDel.error && cDel.data.length === 0, 'C não consegue apagar tarefa do casal 1');
const cMem = await C.from('household_members').select('*').eq('household_id', hid1);
check(!cMem.error && cMem.data.length === 0, 'C não vê os membros do casal 1');
const cReal = await C.from('sections').select('id').eq('household_id', 'f4c7f81b-afee-4438-b402-f2929bf27c7d');
check(!cReal.error && cReal.data.length === 0, 'C não vê os dados importados do casal Camila e Luis');
const aReal = await A.from('items').select('id').eq('household_id', 'f4c7f81b-afee-4438-b402-f2929bf27c7d');
check(!aReal.error && aReal.data.length === 0, 'A também não vê o casal Camila e Luis');
const cCode = await C.rpc('regenerate_invite', { p_household: hid1 });
check(!!cCode.error, 'C não consegue trocar o código de convite do casal 1');
const aInvite = await A.from('households').update({ invite_code: 'AAAAAAAA' }).eq('id', hid1);
check(!!aInvite.error, 'nem membro altera o código direto (só pela função)');

// Chave estrangeira composta: item do casal 2 não pode apontar para seção do casal 1.
const sec1 = await A.from('sections').insert({ household_id: hid1, list: 'casa', name: 'Sala teste' }).select().single();
const cross = await C.from('items').insert({ household_id: hid2, section_id: sec1.data.id, name: 'item cruzado' });
check(!!cross.error, 'C não consegue ligar item do casal 2 a um cômodo do casal 1');

// Fotos: pasta do casal.
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const upA = await A.storage.from('photos').upload(`${hid1}/teste.png`, png, { contentType: 'image/png', upsert: true });
check(!upA.error, 'A envia foto na pasta do casal 1');
const signB = await B.storage.from('photos').createSignedUrl(`${hid1}/teste.png`, 60);
check(!signB.error && !!signB.data?.signedUrl, 'B (mesmo casal) abre a foto');
const signC = await C.storage.from('photos').createSignedUrl(`${hid1}/teste.png`, 60);
check(!!signC.error, 'C (outro casal) não abre a foto');
const upC = await C.storage.from('photos').upload(`${hid1}/intruso.png`, png, { contentType: 'image/png' });
check(!!upC.error, 'C não envia foto na pasta do casal 1');
const anon = mk();
const signAnon = await anon.storage.from('photos').createSignedUrl(`${hid1}/teste.png`, 60);
check(!!signAnon.error, 'sem login não abre a foto');
const anonRead = await anon.from('tasks').select('*');
check(!anonRead.error ? anonRead.data.length === 0 : true, 'sem login não lê nenhum dado');
await A.storage.from('photos').remove([`${hid1}/teste.png`]);

await A.removeChannel(chA); await C.removeChannel(chC);
console.log(`\n${ok} ok, ${bad} falha(s)`);
console.log(JSON.stringify({ hid1, hid2 }));
process.exit(bad ? 1 : 0);

