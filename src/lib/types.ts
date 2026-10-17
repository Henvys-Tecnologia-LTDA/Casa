// Linhas das tabelas do Supabase, com os mesmos nomes de coluna do banco.

export type Who = '' | 'a' | 'b' | 'ambos';
export type ShopList = 'casa' | 'switch';
export type Phase = '' | 'antes' | 'mes1' | 'calma';
export type Priority = 'alta' | 'media' | 'baixa';

export type TabKey = 'casa' | 'switch' | 'ape' | 'mudanca' | 'viagem' | 'dinheiro';
export interface TabCfg { label?: string; icon?: string; hidden?: boolean }

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  photo: string;
  tabs: Partial<Record<TabKey, TabCfg>>;
  name_a: string;
  name_b: string;
  renda: number;
  budget_casa: number;
  budget_switch: number;
  /** Endereço do trabalho de cada um (tempo até o trabalho de cada apê). */
  work_a: string;
  work_b: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  household_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  notify_paused: boolean;
  notify_off: string[]; // "<aba>:novo" ou "<aba>:feito" que esta pessoa não quer receber
}

interface Base {
  id: string;
  household_id: string;
  created_at: string;
}

interface Timestamped extends Base {
  updated_at: string;
}

export interface Section extends Timestamped {
  list: ShopList;
  name: string;
  icon: string;
  sort_order: number;
  budget: number;
  /** Anotações de medidas do cômodo ("parede da TV: 2,10 m"). */
  measures: string;
}

export interface ItemOption {
  id: string;
  name: string;
  store: string;
  price: number;
  link: string;
  image: string;
  likes: string[];
}

export interface Item extends Timestamped {
  section_id: string;
  name: string;
  price: number;
  qty: number;
  priority: Priority;
  phase: Phase;
  coop: boolean;
  notes: string;
  image: string;
  store: string;
  link: string;
  options: ItemOption[];
  chosen: string;
  bought: boolean;
  gift: boolean;
  paid: number | null;
  payer: Who;
  parcelas: number;
  parc_start: string;
  bought_by: string | null;
  bought_at: string | null;
  estimado: boolean;
  /** Medidas do produto em cm (0 = não anotada). */
  width: number;
  depth: number;
  height: number;
  /** Largura do espaço onde vai ficar, em cm (para o "cabe?"). */
  space: number;
  warranty_until: string | null;
  /** Link do manual ou da nota fiscal. */
  manual: string;
}

export interface Task extends Timestamped {
  title: string;
  phase: Phase;
  who: Who;
  due: string | null;
  notes: string;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
  /** No quadro: em andamento. */
  doing: boolean;
  steps: TaskStep[];
  repeat: Repeat;
  /** Reveza quem faz a cada vez (entre as duas pessoas). */
  rotate: boolean;
  last_done_at: string | null;
  last_done_by: string | null;
}

export interface TaskStep { id: string; text: string; done: boolean }
export type Repeat = '' | 'semana' | 'quinzena' | 'mes';

export interface Apartment extends Timestamped {
  name: string;
  address: string;
  link: string;
  status: 'visitar' | 'visitado' | 'proposta' | 'descartado';
  price: number;
  area: number;
  rooms: number;
  parking: number;
  entrada: number;
  fgts: number;
  entrada_tipo: 'vista' | 'parcelada';
  entrada_parcelas: number;
  inicio: 'depois' | 'junto';
  inicio_mes: string;
  taxa: number;
  prazo: number;
  seguro: number;
  sistema: 'SAC' | 'PRICE';
  condo: number;
  iptu: number;
  itbi: number;
  cartorio: number;
  notes: string;
  image: string;
  likes: string[];
  favorite: boolean;
}

export interface Trip extends Timestamped {
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  status: 'sonho' | 'planejando' | 'confirmada' | 'feita';
  people: number;
  notes: string;
  image: string;
  likes: string[];
}

export interface TripCost extends Timestamped {
  trip_id: string;
  descr: string;
  cat: string;
  amount: number;
  parcelas: number;
  parc_start: string;
  paid: boolean;
  /** Quem pagou (entra no acerto do casal quando já está pago). */
  payer: Who;
}

export interface TripDeposit extends Base {
  trip_id: string;
  amount: number;
  by_user: string | null;
}

export interface PackingItem extends Timestamped {
  trip_id: string;
  text: string;
  done: boolean;
}

export interface Goal extends Timestamped {
  name: string;
  target: number;
  deadline: string;
}

export interface GoalDeposit extends Base {
  goal_id: string;
  amount: number;
  who: 'a' | 'b' | 'ambos';
  by_user: string | null;
}

export interface Settlement extends Base {
  /** Quem passou o dinheiro para o outro. */
  payer: 'a' | 'b';
  amount: number;
  note: string;
  by_user: string | null;
}

export interface Comment extends Base {
  target_table: 'items' | 'tasks';
  target_id: string;
  body: string;
  by_user: string | null;
}

export type Emoji = '❤️' | '😂' | '😮' | '👏' | '🙏';
export interface Reaction extends Base {
  /** Linha do "O que mudou" (private.push_events). */
  event_id: number;
  emoji: Emoji;
  by_user: string | null;
}

export interface Inspiration extends Timestamped {
  section_id: string;
  image: string;
  link: string;
  note: string;
  sort_order: number;
}

export type NoteKind = 'nota' | 'contato' | 'wifi';
export interface Note extends Timestamped {
  kind: NoteKind;
  title: string;
  body: string;
  phone: string;
  sort_order: number;
}

export interface Bill extends Timestamped {
  name: string;
  amount: number;
  /** Dia do vencimento (31 em mês curto vira o último dia). */
  due_day: number;
  /** Quem costuma pagar. */
  payer: Who;
  active: boolean;
}

export interface BillPayment extends Base {
  bill_id: string;
  /** Mês pago (AAAA-MM). */
  ym: string;
  amount: number;
  payer: Who;
  by_user: string | null;
}

export type GroceryCat = 'hortifruti' | 'padaria' | 'acougue' | 'frios' | 'mercearia' | 'bebidas' | 'limpeza' | 'higiene' | 'congelados' | 'pet' | 'outros';
export interface Grocery extends Timestamped {
  text: string;
  qty: string;
  cat: GroceryCat;
  done: boolean;
  done_at: string | null;
  by_user: string | null;
}

export interface TripPlan extends Timestamped {
  trip_id: string;
  /** Dia do roteiro (null = ainda sem dia). */
  day: string | null;
  /** Horário HH:MM (opcional). */
  hour: string;
  text: string;
  link: string;
  image: string;
  sort_order: number;
}

export interface DataTables {
  sections: Section[];
  items: Item[];
  tasks: Task[];
  apartments: Apartment[];
  trips: Trip[];
  trip_costs: TripCost[];
  trip_deposits: TripDeposit[];
  packing_items: PackingItem[];
  goals: Goal[];
  goal_deposits: GoalDeposit[];
  settlements: Settlement[];
  comments: Comment[];
  reactions: Reaction[];
  inspirations: Inspiration[];
  notes: Note[];
  bills: Bill[];
  bill_payments: BillPayment[];
  groceries: Grocery[];
  trip_plans: TripPlan[];
}

export type TableName = keyof DataTables;
export type RowOf<T extends TableName> = DataTables[T][number];

export const TABLES: TableName[] = [
  'sections', 'items', 'tasks', 'apartments', 'trips',
  'trip_costs', 'trip_deposits', 'packing_items', 'goals', 'goal_deposits', 'settlements',
  'comments', 'reactions', 'inspirations', 'notes', 'bills', 'bill_payments', 'groceries', 'trip_plans',
];
