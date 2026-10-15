-- Dados de planejamento de cada casal: Casa/Switch (seções e itens), Mudança (tarefas),
-- Apê (simulações), Viagem (custos, cofrinho, mala) e Dinheiro (metas e depósitos).
-- Toda tabela tem household_id e só membros do casal leem ou escrevem.
-- Filhos usam chave estrangeira composta (household_id, pai) para não apontar para outro casal.

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list text not null check (list in ('casa', 'switch')),
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default 'box',
  sort_order int not null default 0,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  section_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  price numeric(14,2) not null default 0 check (price >= 0),
  qty int not null default 1 check (qty >= 1),
  priority text not null default 'media' check (priority in ('alta', 'media', 'baixa')),
  phase text not null default '' check (phase in ('', 'antes', 'mes1', 'calma')),
  coop boolean not null default false,
  notes text not null default '',
  image text not null default '',
  store text not null default '',
  link text not null default '',
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  chosen text not null default '',
  bought boolean not null default false,
  gift boolean not null default false,
  paid numeric(14,2) check (paid is null or paid >= 0),
  payer text not null default '' check (payer in ('', 'a', 'b', 'ambos')),
  parcelas int not null default 1 check (parcelas between 1 and 48),
  parc_start text not null default '' check (parc_start = '' or parc_start ~ '^\d{4}-\d{2}$'),
  bought_by uuid references auth.users(id) on delete set null,
  bought_at timestamptz,
  estimado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, section_id) references public.sections(household_id, id) on delete cascade
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  phase text not null default '' check (phase in ('', 'antes', 'mes1', 'calma')),
  who text not null default '' check (who in ('', 'a', 'b', 'ambos')),
  due date,
  notes text not null default '',
  done boolean not null default false,
  done_by uuid references auth.users(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  address text not null default '',
  link text not null default '',
  status text not null default 'visitar' check (status in ('visitar', 'visitado', 'proposta', 'descartado')),
  price numeric(14,2) not null default 0 check (price >= 0),
  area numeric(10,2) not null default 0 check (area >= 0),
  rooms int not null default 0 check (rooms >= 0),
  parking int not null default 0 check (parking >= 0),
  entrada numeric(14,2) not null default 0 check (entrada >= 0),
  fgts numeric(14,2) not null default 0 check (fgts >= 0),
  entrada_tipo text not null default 'vista' check (entrada_tipo in ('vista', 'parcelada')),
  entrada_parcelas int not null default 24 check (entrada_parcelas between 1 and 240),
  inicio text not null default 'depois' check (inicio in ('depois', 'junto')),
  inicio_mes text not null default '' check (inicio_mes = '' or inicio_mes ~ '^\d{4}-\d{2}$'),
  taxa numeric(7,3) not null default 11.5 check (taxa >= 0),
  prazo int not null default 360 check (prazo between 1 and 480),
  seguro numeric(14,2) not null default 0 check (seguro >= 0),
  sistema text not null default 'SAC' check (sistema in ('SAC', 'PRICE')),
  condo numeric(14,2) not null default 0 check (condo >= 0),
  iptu numeric(14,2) not null default 0 check (iptu >= 0),
  itbi numeric(7,3) not null default 3 check (itbi >= 0),
  cartorio numeric(7,3) not null default 1.5 check (cartorio >= 0),
  notes text not null default '',
  image text not null default '',
  likes uuid[] not null default '{}',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  destination text not null default '',
  start_date date,
  end_date date,
  status text not null default 'planejando' check (status in ('sonho', 'planejando', 'confirmada', 'feita')),
  people int not null default 2 check (people between 1 and 50),
  notes text not null default '',
  image text not null default '',
  likes uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.trip_costs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null,
  descr text not null default '',
  cat text not null default 'outros' check (cat in ('passagens', 'hospedagem', 'passeios', 'alimentacao', 'transporte', 'seguro', 'compras', 'outros')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  parcelas int not null default 1 check (parcelas between 1 and 48),
  parc_start text not null default '' check (parc_start = '' or parc_start ~ '^\d{4}-\d{2}$'),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips(household_id, id) on delete cascade
);

create table public.trip_deposits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null,
  amount numeric(14,2) not null check (amount <> 0),
  by_user uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips(household_id, id) on delete cascade
);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null,
  text text not null check (char_length(text) between 1 and 200),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips(household_id, id) on delete cascade
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  target numeric(14,2) not null default 0 check (target >= 0),
  deadline text not null default '' check (deadline = '' or deadline ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.goal_deposits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  goal_id uuid not null,
  amount numeric(14,2) not null check (amount <> 0),
  who text not null default 'ambos' check (who in ('a', 'b', 'ambos')),
  by_user uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (household_id, goal_id) references public.goals(household_id, id) on delete cascade
);

-- Índices para as consultas por casal e para as chaves estrangeiras.
create index sections_household_idx on public.sections(household_id);
create index items_household_idx on public.items(household_id);
create index items_section_idx on public.items(household_id, section_id);
create index items_bought_by_idx on public.items(bought_by);
create index tasks_household_idx on public.tasks(household_id);
create index tasks_done_by_idx on public.tasks(done_by);
create index apartments_household_idx on public.apartments(household_id);
create index trips_household_idx on public.trips(household_id);
create index trip_costs_trip_idx on public.trip_costs(household_id, trip_id);
create index trip_costs_household_idx on public.trip_costs(household_id);
create index trip_deposits_trip_idx on public.trip_deposits(household_id, trip_id);
create index trip_deposits_household_idx on public.trip_deposits(household_id);
create index trip_deposits_by_idx on public.trip_deposits(by_user);
create index packing_items_trip_idx on public.packing_items(household_id, trip_id);
create index packing_items_household_idx on public.packing_items(household_id);
create index goals_household_idx on public.goals(household_id);
create index goal_deposits_goal_idx on public.goal_deposits(household_id, goal_id);
create index goal_deposits_household_idx on public.goal_deposits(household_id);
create index goal_deposits_by_idx on public.goal_deposits(by_user);

-- updated_at automático e RLS por membro do casal.
do $$
declare
  t text;
begin
  foreach t in array array['sections', 'items', 'tasks', 'apartments', 'trips', 'trip_costs', 'packing_items', 'goals'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', t || '_touch', t);
  end loop;

  foreach t in array array['sections', 'items', 'tasks', 'apartments', 'trips', 'trip_costs', 'trip_deposits', 'packing_items', 'goals', 'goal_deposits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id))',
      'so membros do casal', t
    );
  end loop;
end;
$$;

-- Tempo real: o app assina as mudanças filtradas pelo casal (o RLS também vale para o Realtime).
alter publication supabase_realtime add table
  public.households, public.household_members,
  public.sections, public.items, public.tasks, public.apartments,
  public.trips, public.trip_costs, public.trip_deposits, public.packing_items,
  public.goals, public.goal_deposits;
