// Confere a lógica do acerto do casal, da agenda da mudança, dos marcos, do "O que mudou", dos
// gastos do mês, da planilha, do texto do WhatsApp e do widget do Android.
// Uso: npx tsx scripts/check-novidades.ts
import { frase, porDia, rotuloDia } from '../src/lib/atividade';
import { acerto, agenda, gastosPorMes } from '../src/lib/calc';
import { textoLista, textoTarefas } from '../src/lib/compartilhar';
import { marcos, novos } from '../src/lib/marcos';
import { csv, planilha } from '../src/lib/planilha';
import type { DataTables, TabKey } from '../src/lib/types';
import { linhasWidget, resumoWidget } from '../src/lib/widget';

let ok = 0, bad = 0;
const check = (cond: boolean, msg: string) => { if (cond) { ok++; console.log('  ok    ', msg); } else { bad++; console.log('  FALHOU', msg); } };

const base = { household_id: 'h', created_at: '2026-01-01T12:00:00Z', updated_at: '2026-01-01T12:00:00Z' };
const item = (id: string, sec: string, x: object = {}) => ({
  ...base, id, section_id: sec, name: id, price: 100, qty: 1, priority: 'media', phase: '', coop: false, notes: '', image: '', store: '', link: '',
  options: [], chosen: '', bought: false, gift: false, paid: null, payer: '', parcelas: 1, parc_start: '', bought_by: null, bought_at: null, estimado: false, ...x,
}) as any;
const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const task = (id: string, due: string | null, done = false) => ({ ...base, id, title: id, phase: '', who: '', due, notes: '', done, done_by: null, done_at: null }) as any;

console.log('Acerto do casal');
{
  const items = [
    item('sofa', 's', { bought: true, paid: 1000, payer: 'a' }),
    item('mesa', 's', { bought: true, paid: 400, payer: 'b' }),
    item('tapete', 's', { bought: true, paid: 200, payer: 'ambos' }),
    item('sem', 's', { bought: true, paid: 50, payer: '' }),
    item('falta', 's'),
  ];
  const r0 = acerto(items, []);
  check(r0.a === 1100 && r0.b === 500 && r0.none === 50 && r0.diff === 300, `sem acertos: B passa 300 para A (${JSON.stringify({ a: r0.a, b: r0.b, diff: r0.diff })})`);
  const r1 = acerto(items, [{ ...base, id: 'x', payer: 'b', amount: 300, note: '', by_user: null }]);
  check(Math.abs(r1.diff) < 0.001 && r1.deB === 300, 'depois de B passar 300: quites');
  const r2 = acerto(items, [{ ...base, id: 'x', payer: 'b', amount: 500, note: '', by_user: null }]);
  check(r2.diff === -200, 'se B passar a mais (500), agora A passa 200 para B');
  const r3 = acerto(items, [{ ...base, id: 'x', payer: 'a', amount: 100, note: '', by_user: null }]);
  check(r3.diff === 400, 'acerto de A para B aumenta o que B deve');
}

console.log('Agenda da mudança');
{
  const ag = agenda([task('atrasada', dia(-2)), task('ontem', dia(-1)), task('hoje', dia(0)), task('amanha', dia(1)), task('semana', dia(7)), task('depois', dia(8)), task('feita', dia(0), true), task('sem', null)]);
  check(ag.atrasadas.map(t => t.id).join() === 'atrasada,ontem', 'atrasadas (mais antiga primeiro)');
  check(ag.hoje.map(t => t.id).join() === 'hoje', 'hoje (sem as feitas)');
  check(ag.semana.map(t => t.id).join() === 'amanha,semana', 'próximos 7 dias (o 8º fica de fora)');
}

console.log('Marcos');
{
  const t = {
    sections: [{ ...base, id: 's1', list: 'casa', name: 'Cozinha', icon: 'pot' }, { ...base, id: 's2', list: 'casa', name: 'Sala', icon: 'sofa' }, { ...base, id: 's3', list: 'casa', name: 'Vazio', icon: 'box' }],
    items: [
      item('a', 's1', { bought: true }), item('b', 's1', { bought: true }),
      item('c', 's2', { bought: true }), item('d', 's2'),
    ],
    tasks: [task('t1', null, true), task('t2', null, true), task('t3', null, true)],
    goals: [{ ...base, id: 'g1', name: 'Entrada', target: 1000, deadline: '' }],
    goal_deposits: [{ ...base, id: 'd1', goal_id: 'g1', amount: 600, who: 'a', by_user: null }, { ...base, id: 'd2', goal_id: 'g1', amount: 400, who: 'b', by_user: null }],
    trips: [{ ...base, id: 'v1', name: 'Lisboa', destination: '', start_date: null, end_date: null, status: 'sonho', people: 2, notes: '', image: '', likes: [] }],
    trip_costs: [{ ...base, id: 'c1', trip_id: 'v1', descr: 'Voo', cat: 'passagens', amount: 500, parcelas: 1, parc_start: '', paid: true }],
    trip_deposits: [{ ...base, id: 'td', trip_id: 'v1', amount: 100, by_user: null }],
    apartments: [], packing_items: [], settlements: [],
  } as unknown as DataTables;
  const ctx = (hidden: TabKey[] = []) => ({ tabLabel: (k: TabKey) => k, hidden: (k: TabKey) => hidden.includes(k) });
  const keys = marcos(t, ctx()).map(m => m.key).sort();
  check(keys.join() === 'meta:g1,mudanca,sec:s1,viagem:v1', `cômodo completo, meta batida, mudança feita, viagem paga (${keys.join()})`);
  check(!keys.includes('sec:s3') && !keys.includes('sec:s2'), 'cômodo vazio ou com item faltando não conta');
  check(marcos(t, ctx()).find(m => m.key === 'sec:s1')?.title === 'Cômodo completo: Cozinha!', 'título com a concordância certa');
  check(!marcos(t, ctx(['dinheiro', 'viagem'])).some(m => m.key.startsWith('meta') || m.key.startsWith('viagem')), 'abas escondidas não comemoram');
  const atual = marcos(t, ctx());
  check(novos(atual, null).length === 0, 'primeira vez no aparelho: nada de festa');
  check(novos(atual, ['sec:s1', 'mudanca', 'meta:g1']).map(m => m.key).join() === 'viagem:v1', 'só o marco novo');
}

console.log('O que mudou');
{
  check(frase({ tbl: 'items', kind: 'feito', label: 'Geladeira', extra: {} }) === 'comprou “Geladeira”', 'frase de compra');
  check(frase({ tbl: 'goal_deposits', kind: 'feito', label: 'Entrada', extra: { amount: -50 } }) === 'tirou R$ 50,00 da meta “Entrada”', 'frase de retirada da meta');
  check(frase({ tbl: 'apartments', kind: 'feito', label: 'Vila', extra: { status: 'proposta' } }) === 'marcou “Vila” como proposta feita', 'frase de status do apê');
  const agora = new Date(2026, 9, 16, 20, 0);
  check(rotuloDia(new Date(2026, 9, 16, 8).toISOString(), agora) === 'Hoje' && rotuloDia(new Date(2026, 9, 15, 23).toISOString(), agora) === 'Ontem', 'hoje e ontem');
  check(rotuloDia(new Date(2026, 9, 12, 10).toISOString(), agora) === 'seg., 12 de out.', 'dia da semana e mês');
  const g = porDia([{ created_at: new Date(2026, 9, 16, 9).toISOString() }, { created_at: new Date(2026, 9, 16, 8).toISOString() }, { created_at: new Date(2026, 9, 14, 8).toISOString() }], agora);
  check(g.length === 2 && g[0].itens.length === 2 && g[1].dia === 'qua., 14 de out.', 'agrupa por dia');
}

console.log('Acerto com viagens');
{
  const items = [item('sofa', 's', { bought: true, paid: 1000, payer: 'a' }), item('mesa', 's', { bought: true, paid: 400, payer: 'b' })];
  const cost = (id: string, amount: number, payer: string, paid = true) => ({ ...base, id, trip_id: 'v', descr: id, cat: 'outros', amount, parcelas: 1, parc_start: '', paid, payer }) as any;
  const r = acerto(items, [], [cost('voo', 300, 'b'), cost('hotel', 200, 'ambos'), cost('passeio', 999, 'a', false)]);
  check(r.a === 1100 && r.b === 800 && r.diff === 150, `custo pago por B entra, "os dois" divide, o não pago fica de fora (${JSON.stringify({ a: r.a, b: r.b, diff: r.diff })})`);
}

console.log('Gastos do mês');
{
  const agora = new Date(2026, 9, 16);
  const sections = [{ ...base, id: 's1', list: 'casa', name: 'Cozinha', icon: 'pot', sort_order: 0, budget: 0 }, { ...base, id: 's2', list: 'switch', name: 'Jogos', icon: 'game', sort_order: 0, budget: 0 }] as any;
  const g = gastosPorMes([
    item('a', 's1', { bought: true, paid: 300, bought_at: new Date(2026, 9, 2).toISOString() }),
    item('b', 's2', { bought: true, paid: 200, bought_at: new Date(2026, 9, 10).toISOString() }),
    item('c', 's1', { bought: true, paid: 50, bought_at: new Date(2026, 8, 20).toISOString() }),
    item('presente', 's1', { bought: true, gift: true, paid: 900, bought_at: new Date(2026, 9, 3).toISOString() }),
    item('velho', 's1', { bought: true, paid: 70, bought_at: new Date(2025, 0, 3).toISOString() }),
    item('falta', 's1'),
  ], sections, 6, agora);
  const out = g[g.length - 1], set = g[g.length - 2];
  check(g.length === 6 && out.ym === '2026-10', 'seis meses, terminando no mês atual');
  check(out.total === 500 && out.porLista.casa === 300 && out.porLista.switch === 200 && out.porSecao.s1 === 300, 'outubro: por lista e por cômodo (presente fora)');
  check(set.total === 50 && g.reduce((t, m) => t + m.total, 0) === 550, 'setembro certo; compra antiga fora da janela');
}

console.log('Planilha');
{
  const t = { sections: [{ ...base, id: 's1', list: 'casa', name: 'Sala; estar', icon: 'sofa', sort_order: 0, budget: 0 }], items: [item('Sofá "grande"', 's1', { price: 1234.5, bought: true, paid: 1200, payer: 'a', bought_at: '2026-10-02T12:00:00Z' })] } as any;
  const ctx = { tabLabel: (k: TabKey) => (k === 'casa' ? 'Casa' : k), nm: (k: 'a' | 'b') => (k === 'a' ? 'Luís' : 'Camila'), whoLabel: (w: string) => (w === 'a' ? 'Luís' : w) };
  const rows = planilha('compras', t, ctx);
  check(rows.length === 2 && rows[1][0] === 'Casa' && rows[1][4] === '1234,5' && rows[1][9] === '1200' && rows[1][10] === 'Luís' && rows[1][12] === '02/10/2026', 'linha de compra com vírgula decimal e data brasileira');
  const txt = csv(rows);
  check(txt.startsWith('﻿') && txt.includes(';"Sala; estar";') && txt.includes('"Sofá ""grande"""') && txt.endsWith('\r\n'), 'CSV com BOM, aspas e ponto e vírgula escapados');
}

console.log('Mandar no WhatsApp');
{
  const secs = [{ ...base, id: 's1', list: 'casa', name: 'Cozinha', icon: 'pot', sort_order: 0, budget: 0 }, { ...base, id: 's2', list: 'casa', name: 'Sala', icon: 'sofa', sort_order: 1, budget: 0 }] as any;
  const its: Record<string, any[]> = { s1: [item('Panela', 's1'), item('Prato', 's1', { bought: true })], s2: [item('Sofá', 's2', { bought: true })] };
  const txt = textoLista('Casa', secs, id => its[id] ?? []);
  check(txt.startsWith('*Casa*: faltam 1 item') && txt.includes('*Cozinha*') && txt.includes('Panela') && !txt.includes('Prato') && !txt.includes('*Sala*'), 'só o que falta, por cômodo');
  check(textoLista('Casa', secs, () => []).includes('Tudo comprado!'), 'lista vazia');
  const tt = textoTarefas('Mudança', [task('Caixas', dia(0)), task('Feita', null, true)]);
  check(tt.includes('faltam 1 tarefa') && tt.includes('• Caixas (hoje)') && !tt.includes('Feita'), 'tarefas abertas com prazo');
}

console.log('Widget do Android');
{
  const t = {
    tasks: [task('depois', dia(9)), task('hoje', dia(0)), task('atrasada', dia(-2)), task('feita', dia(0), true), task('sem', null)],
    sections: [{ ...base, id: 's1', list: 'casa' }, { ...base, id: 's2', list: 'switch' }],
    items: [item('a', 's1'), item('b', 's1'), item('c', 's1', { bought: true }), item('d', 's2')],
  } as any;
  const tabs = (hidden: TabKey[] = []) => ({ label: (k: TabKey) => k.toUpperCase(), hidden: (k: TabKey) => hidden.includes(k) });
  const r = resumoWidget('h', t, tabs());
  check(r.tarefas?.map(x => x.title).join() === 'atrasada,hoje,depois', 'tarefas abertas com prazo, da mais urgente');
  check(r.listas.map(l => `${l.tab}:${l.faltam}`).join() === 'casa:2,switch:1', 'quantos faltam em cada lista');
  const l = linhasWidget(r, 5);
  check(l.length === 2 && l[0].atrasada && l[0].quando === 'atrasada há 2 dias' && l[1].quando === 'hoje', 'só os próximos 7 dias, com o rótulo do dia');
  check(linhasWidget(r, 1).length === 1, 'respeita quantas linhas cabem');
  const esc = resumoWidget('h', t, tabs(['mudanca', 'switch']));
  check(esc.tarefas === null && esc.listas.map(x => x.tab).join() === 'casa', 'abas escondidas ficam de fora');
}

console.log(`\n${ok} ok, ${bad} falharam`);
if (bad) process.exit(1);
