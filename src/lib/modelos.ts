import { PACK_BASIC } from './calc';
import type { GroceryCat, Phase } from './types';

// Modelos prontos (como os templates do Trello e do Miro): listas comuns para começar com um toque.
// Só aparecem quando a lista ainda está vazia (ou ao criar o cômodo), para não poluir a tela.

/** Itens comuns de cada cômodo, pelo ícone escolhido. */
export const ENXOVAL: Record<string, string[]> = {
  pot: ['Geladeira', 'Fogão ou cooktop', 'Micro-ondas', 'Jogo de panelas', 'Pratos, copos e talheres', 'Liquidificador', 'Escorredor de louça', 'Lixeira', 'Potes', 'Panos de prato'],
  sofa: ['Sofá', 'Rack ou painel', 'TV', 'Tapete', 'Cortina', 'Luminária', 'Mesa de centro'],
  bed: ['Cama', 'Colchão', 'Guarda-roupa', 'Criado-mudo', 'Jogo de cama', 'Travesseiros', 'Cortina blackout'],
  bath: ['Toalhas de banho e rosto', 'Tapete de banheiro', 'Lixeira', 'Porta-escovas', 'Cesto de roupa', 'Armário com espelho'],
  washer: ['Máquina de lavar', 'Varal', 'Balde e bacia', 'Tábua e ferro de passar', 'Cesto de roupa suja'],
  desk: ['Mesa', 'Cadeira', 'Luminária de mesa', 'Estante'],
  plant: ['Cadeiras', 'Mesinha', 'Vasos', 'Plantas'],
  broom: ['Aspirador de pó', 'Vassoura, rodo e pá', 'Balde', 'Panos e esponjas', 'Produtos de limpeza'],
};

/** Checklist de mudança comum, por etapa. */
export const CHECKLIST_MUDANCA: [string, Phase][] = [
  ['Orçar e agendar o frete da mudança', 'antes'],
  ['Contratar internet (a instalação pode levar dias)', 'antes'],
  ['Passar luz e água para o nome de vocês', 'antes'],
  ['Medir os cômodos para os móveis', 'antes'],
  ['Comprar caixas, fita e plástico-bolha', 'antes'],
  ['Separar o que vai ser doado ou vendido', 'antes'],
  ['Fazer uma limpeza geral antes de mudar', 'antes'],
  ['Trocar as fechaduras ou fazer cópias das chaves', 'mes1'],
  ['Atualizar o endereço no banco, nos apps e nos documentos', 'mes1'],
  ['Cadastrar a biometria ou a tag na portaria', 'mes1'],
  ['Conhecer o mercado, a farmácia e a padaria do bairro', 'mes1'],
  ['Instalar cortinas e luminárias', 'calma'],
  ['Pendurar quadros e prateleiras', 'calma'],
];

/** Malas prontas para a viagem. */
export const MALAS: Record<'basica' | 'praia' | 'frio', { label: string; itens: string[] }> = {
  basica: {
    label: 'Básica',
    itens: PACK_BASIC,
  },
  praia: {
    label: 'Praia',
    itens: ['Documentos', 'Carregadores', 'Biquíni e sunga', 'Protetor solar', 'Óculos de sol', 'Chapéu ou boné', 'Chinelo', 'Toalha de praia', 'Repelente', 'Saída de praia'],
  },
  frio: {
    label: 'Frio',
    itens: ['Documentos', 'Carregadores', 'Casaco pesado', 'Blusas de lã', 'Cachecol e gorro', 'Luvas', 'Meias grossas', 'Hidratante e protetor labial', 'Bota fechada'],
  },
};

/** Lista de mercado básica. */
export const MERCADO_BASICO: [string, GroceryCat][] = [
  ['Arroz', 'mercearia'], ['Feijão', 'mercearia'], ['Café', 'mercearia'], ['Açúcar', 'mercearia'], ['Óleo', 'mercearia'],
  ['Leite', 'frios'], ['Ovos', 'frios'], ['Pão', 'padaria'], ['Banana', 'hortifruti'], ['Tomate', 'hortifruti'],
  ['Papel higiênico', 'higiene'], ['Detergente', 'limpeza'],
];
