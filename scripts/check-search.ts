// Confere a busca geral (src/lib/search.ts) com dados de exemplo.
// Uso: npx tsx scripts/check-search.ts
import { buildIndex, countByGroup, pieces, search, type IndexCtx } from '../src/lib/search';
import type { DataTables, TabKey } from '../src/lib/types';

let ok = 0, bad = 0;
const check = (cond: boolean, msg: string) => { if (cond) { ok++; console.log('  ok    ', msg); } else { bad++; console.log('  FALHOU', msg); } };

const base = { household_id: 'h', created_at: '2026-01-01', updated_at: '2026-01-01' };
const item = (id: string, section_id: string, name: string, extra: object = {}) => ({
  ...base, id, section_id, name, price: 100, qty: 1, priority: 'media', phase: '', coop: false, notes: '', image: '', store: '', link: '',
  options: [], chosen: '', bought: false, gift: false, paid: null, payer: '', parcelas: 1, parc_start: '', bought_by: null, bought_at: null, estimado: false, ...extra,
});

const t = {
  sections: [
    { ...base, id: 's1', list: 'casa', name: 'Cozinha', icon: 'pot', sort_order: 0, budget: 0 },
    { ...base, id: 's2', list: 'casa', name: 'Sala', icon: 'sofa', sort_order: 1, budget: 0 },
    { ...base, id: 's3', list: 'switch', name: 'Jogos', icon: 'gamepad', sort_order: 0, budget: 0 },
  ],
  items: [
    item('i1', 's1', 'Geladeira Brastemp', { store: 'Magalu', price: 3500 }),
    item('i2', 's1', 'Café expresso', { notes: 'A Camila quer a de cápsula porque é mais prática no dia a dia, ver se tem promoção na Black Friday antes de comprar a máquina nova' }),
    item('i7', 's2', 'Sofá cama', {}),
    item('i3', 's2', 'Sofá retrátil', { store: 'Tok&Stok', bought: true }),
    item('i4', 's2', 'Tapete', { options: [{ id: 'o1', name: 'Tapete sisal', store: 'Camicado', price: 400, link: '', image: '', likes: [] }] }),
    item('i5', 's3', 'Mario Kart', {}),
    item('i6', 's1', 'Panela de café', { updated_at: '2026-03-01' }),
  ],
  tasks: [
    { ...base, id: 't1', title: 'Contratar frete', phase: 'antes', who: 'a', due: null, notes: 'Ligar para 3 empresas', done: false, done_by: null, done_at: null },
    { ...base, id: 't2', title: 'Trocar endereço no banco', phase: 'mes1', who: '', due: null, notes: '', done: true, done_by: null, done_at: null },
  ],
  apartments: [{ ...base, id: 'a1', name: 'Apê da Vila Mariana', address: 'Rua Domingos de Morais, 100', status: 'visitar', price: 450000, notes: '' }],
  trips: [{ ...base, id: 'v1', name: 'Lua de mel', destination: 'Lisboa', start_date: null, end_date: null, status: 'sonho', people: 2, notes: '', image: '', likes: [] }],
  trip_costs: [{ ...base, id: 'c1', trip_id: 'v1', descr: 'Passagens TAP', cat: 'passagens', amount: 7000, parcelas: 1, parc_start: '', paid: false }],
  trip_deposits: [],
  packing_items: [{ ...base, id: 'p1', trip_id: 'v1', text: 'Adaptador de tomada', done: false }],
  goals: [{ ...base, id: 'g1', name: 'Entrada do apê', target: 90000, deadline: '2027-06' }],
  goal_deposits: [],
} as unknown as DataTables;

const labels: Record<TabKey, string> = { casa: 'Casa', switch: 'Console', ape: 'Apê', mudanca: 'Mudança', viagem: 'Viagem', dinheiro: 'Dinheiro' };
const ctx = (hidden: TabKey[] = []): IndexCtx => ({
  tabs: ['casa', 'switch', 'ape', 'mudanca', 'viagem', 'dinheiro'],
  tabLabel: k => labels[k], tabIcon: () => 'box', tabHint: () => '', hidden: k => hidden.includes(k),
});
const idx = buildIndex(t, ctx());
const ids = (q: string, g?: Parameters<typeof search>[2]) => search(idx, q, g).map(h => h.entry.id);

console.log('Busca geral');
check(ids('geladeira')[0] === 'i1', 'acha pelo nome');
check(ids('cafe').includes('i2') && ids('CAFÉ').includes('i2'), 'ignora acento e maiúsculas');
{
  const h = search(idx, 'cafe').find(x => x.entry.id === 'i2')!;
  check(pieces(h.entry.title, h.titleRanges).filter(p => p.on).map(p => p.s).join() === 'Café', 'marca "Café" com acento no título');
}
check(ids('cafe')[0] === 'i2' && ids('cafe')[1] === 'i6', 'começo do nome vem antes de "no meio do nome"');
{
  const h = search(idx, 'sofa tok')[0];
  check(h?.entry.id === 'i3' && h.snippet?.label === 'Loja', 'várias palavras: nome + loja, mostra o campo "Loja"');
}
{
  const h = search(idx, 'promocao')[0];
  check(h?.entry.id === 'i2' && !!h.snippet && h.snippet.text.startsWith('…') && h.snippet.text.includes('promoção'), 'acha nas observações e recorta o trecho');
  const marked = h ? pieces(h.snippet!.text, h.snippet!.ranges).filter(p => p.on).map(p => p.s).join() : '';
  check(marked === 'promoção', `marca o trecho certo no recorte (${marked})`);
}
check(ids('sisal')[0] === 'i4', 'acha pelo nome de uma opção do item');
check(ids('frete', 'tarefas')[0] === 't1' && ids('frete', 'itens').length === 0, 'filtro por tipo');
check(ids('vila')[0] === 'a1' && ids('domingos')[0] === 'a1', 'apê pelo nome e pelo endereço');
check(ids('lisboa')[0] === 'v1', 'viagem pelo destino');
check(ids('tap').includes('c1') && ids('tomada')[0] === 'p1', 'custo e item da mala da viagem');
check(ids('tap')[0] === 'i4', '"tap": "Tapete" (começa com o termo) vem antes de "Passagens TAP"');
check(ids('entrada')[0] === 'g1', 'meta');
check(ids('viag')[0] === 'viagem', 'atalho "Ir para Viagem" pelo nome da aba');
check(ids('zzz').length === 0 && ids('   ').length === 0, 'nada achado / busca vazia');
check(ids('banco').includes('t2'), 'item feito continua aparecendo');
check(ids('sofa', 'itens').join() === 'i7,i3', 'no empate, o comprado vem depois do que falta comprar');
{
  const c = countByGroup(idx, 'cafe');
  check(c.tudo === 2 && c.itens === 2 && c.tarefas === 0, `contagem por tipo (${JSON.stringify(c)})`);
}
{
  const hidden = buildIndex(t, ctx(['switch', 'viagem']));
  check(!search(hidden, 'mario').length && !search(hidden, 'lisboa').length && !!search(hidden, 'geladeira').length, 'abas escondidas ficam fora da busca');
}

console.log(`\n${ok} ok, ${bad} falharam`);
if (bad) process.exit(1);
