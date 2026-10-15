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
}

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
}

export type TableName = keyof DataTables;
export type RowOf<T extends TableName> = DataTables[T][number];

export const TABLES: TableName[] = [
  'sections', 'items', 'tasks', 'apartments', 'trips',
  'trip_costs', 'trip_deposits', 'packing_items', 'goals', 'goal_deposits',
];
