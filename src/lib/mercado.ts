import { norm } from './format';
import type { Grocery, GroceryCat } from './types';

// Lista do mercado (como o Bring! e o AnyList): o item vai sozinho para a seção do mercado pelo nome,
// e "2 kg arroz" ou "leite x2" separa a quantidade.

export const SECOES_MERCADO: [GroceryCat, string][] = [
  ['hortifruti', 'Hortifrúti'], ['padaria', 'Padaria'], ['acougue', 'Açougue e peixaria'], ['frios', 'Frios e laticínios'],
  ['mercearia', 'Mercearia'], ['congelados', 'Congelados'], ['bebidas', 'Bebidas'], ['limpeza', 'Limpeza'],
  ['higiene', 'Higiene'], ['pet', 'Pet'], ['outros', 'Outros'],
];
export const SECAO_L: Record<GroceryCat, string> = Object.fromEntries(SECOES_MERCADO) as Record<GroceryCat, string>;

// Mais específico primeiro ("peito de peru" antes de "peito", "água sanitária" antes de "água").
const REGRAS: [GroceryCat, string[]][] = [
  ['limpeza', ['agua sanitaria', 'saco de lixo', 'sabao', 'detergente', 'amaciante', 'desinfetante', 'esponja', 'multiuso', 'alcool', 'limpador', 'limpa vidro', 'vassoura', 'pano de chao', 'lustra']],
  ['congelados', ['pao de queijo', 'sorvete', 'congelado', 'congelada', 'lasanha', 'pizza', 'hamburguer', 'nuggets', 'polpa', 'batata palito']],
  ['frios', ['peito de peru', 'creme de leite', 'leite condensado', 'requeijao', 'mussarela', 'mucarela', 'presunto', 'queijo', 'iogurte', 'manteiga', 'margarina', 'leite', 'ovo', 'nata']],
  ['higiene', ['papel higienico', 'pasta de dente', 'creme dental', 'fio dental', 'sabonete', 'shampoo', 'xampu', 'condicionador', 'escova de dente', 'desodorante', 'absorvente', 'cotonete', 'lamina', 'protetor solar']],
  ['pet', ['racao', 'areia de gato', 'areia sanitaria', 'petisco']],
  ['bebidas', ['refrigerante', 'cerveja', 'vinho', 'suco', 'agua', 'coca', 'guarana', 'cha', 'energetico']],
  ['acougue', ['carne', 'frango', 'peixe', 'linguica', 'bacon', 'picanha', 'patinho', 'alcatra', 'moida', 'salsicha', 'camarao', 'file', 'costela', 'peito', 'coxa', 'sobrecoxa', 'tilapia', 'salmao']],
  ['padaria', ['pao', 'paes', 'bisnaguinha', 'bolo', 'torrada', 'croissant']],
  ['hortifruti', [
    'banana', 'maca', 'tomate', 'alface', 'cebola', 'alho', 'batata', 'cenoura', 'limao', 'limoes', 'laranja', 'fruta', 'verdura', 'legume', 'mamao',
    'uva', 'abacate', 'pepino', 'couve', 'brocolis', 'morango', 'melancia', 'melao', 'abobrinha', 'abobora', 'pimentao', 'salsinha',
    'cebolinha', 'coentro', 'rucula', 'manga', 'abacaxi', 'kiwi', 'beterraba', 'mandioca', 'aipim', 'gengibre', 'espinafre',
  ]],
  ['mercearia', [
    'arroz', 'feijao', 'macarrao', 'cafe', 'acucar', 'sal', 'oleo', 'azeite', 'farinha', 'molho', 'extrato', 'biscoito', 'bolacha', 'aveia',
    'granola', 'achocolatado', 'sardinha', 'atum', 'milho', 'ervilha', 'tempero', 'vinagre', 'maionese', 'ketchup', 'mostarda', 'fuba',
    'lentilha', 'grao de bico', 'pipoca', 'chocolate', 'mel', 'geleia', 'cereal', 'tapioca',
  ]],
];

/** A seção do mercado pelo nome do item (Outros quando não reconhece). */
export function secaoDe(texto: string): GroceryCat {
  // Palavra inteira (ou no plural): "maçã" não pega "macarrão".
  const t = ` ${norm(texto).replace(/[^a-z0-9 ]/g, ' ')} `;
  for (const [cat, palavras] of REGRAS) {
    if (palavras.some(p => t.includes(` ${p} `) || t.includes(` ${p}s `) || t.includes(` ${p}es `))) return cat;
  }
  return 'outros';
}

const maiuscula = (s: string) => s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1);

/** "2 kg arroz" → { qty: "2 kg", text: "Arroz" }; "leite x2" → { qty: "2", text: "Leite" }. */
export function lerItem(raw: string): { text: string; qty: string } {
  const r = ler(raw);
  return { ...r, text: maiuscula(r.text) };
}

function ler(raw: string): { text: string; qty: string } {
  const s = raw.trim().replace(/\s+/g, ' ');
  const antes = s.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un|und|pct|pacotes?|cx|caixas?|dz|duzias?|latas?|garrafas?)?\s+(.+)$/i);
  if (antes) return { qty: [antes[1], antes[2]].filter(Boolean).join(' '), text: antes[3] };
  const depois = s.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
  if (depois) return { qty: depois[2], text: depois[1] };
  return { qty: '', text: s };
}

/** Os que faltam, por seção na ordem do mercado. */
export function porSecao(list: Grocery[]) {
  const faltam = list.filter(g => !g.done);
  return SECOES_MERCADO
    .map(([cat, label]) => ({ cat, label, itens: faltam.filter(g => (SECAO_L[g.cat] ? g.cat : 'outros') === cat).sort((a, b) => a.text.localeCompare(b.text, 'pt-BR')) }))
    .filter(s => s.itens.length);
}

/** Texto para mandar no WhatsApp. */
export function textoMercado(list: Grocery[]): string {
  const secs = porSecao(list);
  const n = secs.reduce((s, x) => s + x.itens.length, 0);
  if (!n) return '*Mercado*\nNada faltando!\n\n_Lista do Casa a Dois_';
  const blocos = secs.map(s => `*${s.label}*\n${s.itens.map(g => `• ${g.text}${g.qty ? ` (${g.qty})` : ''}`).join('\n')}`);
  return [`*Mercado*: ${n === 1 ? '1 item' : `${n} itens`}`, '', blocos.join('\n\n'), '', '_Lista do Casa a Dois_'].join('\n');
}
