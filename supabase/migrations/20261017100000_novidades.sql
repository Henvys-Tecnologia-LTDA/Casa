-- Novidades (ideias do Trello, Notion, Splitwise, Bring!, TripIt...):
-- conversa nos itens e tarefas (comentários) e reações no "O que mudou"; tarefas com passos, quadro
-- (fazendo) e repetição com rodízio; medidas ("cabe?") e garantia dos itens; anotações de medidas do
-- cômodo e inspirações; caderno da casa; contas fixas do mês (com lembrete); lista do mercado; roteiro
-- da viagem; e o endereço do trabalho de cada um (tempo até o trabalho de cada apê).

/* ---------- campos novos ---------- */

alter table public.tasks
  add column doing boolean not null default false,
  add column steps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 50),
  add column repeat text not null default '' check (repeat in ('', 'semana', 'quinzena', 'mes')),
  add column rotate boolean not null default false,
  add column last_done_at timestamptz,
  add column last_done_by uuid references auth.users(id) on delete set null;

alter table public.items
  add column width numeric(7, 1) not null default 0 check (width >= 0 and width < 100000),
  add column depth numeric(7, 1) not null default 0 check (depth >= 0 and depth < 100000),
  add column height numeric(7, 1) not null default 0 check (height >= 0 and height < 100000),
  add column space numeric(7, 1) not null default 0 check (space >= 0 and space < 100000),
  add column warranty_until date,
  add column manual text not null default '' check (char_length(manual) <= 1000);

alter table public.sections
  add column measures text not null default '' check (char_length(measures) <= 300);

alter table public.households
  add column work_a text not null default '' check (char_length(work_a) <= 200),
  add column work_b text not null default '' check (char_length(work_b) <= 200);
grant update (work_a, work_b) on public.households to authenticated;

/* ---------- tabelas novas ---------- */

-- Conversa curta em um item ou tarefa ("achei caro", "vi mais barato na Tok&Stok").
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  target_table text not null check (target_table in ('items', 'tasks')),
  target_id uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  by_user uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index comments_target_idx on public.comments(target_id, created_at);
create index comments_household_idx on public.comments(household_id, created_at desc);

-- Reação a uma linha do "O que mudou" (um evento de private.push_events). Uma por pessoa por evento.
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id bigint not null,
  emoji text not null check (emoji in ('❤️', '😂', '😮', '👏', '🙏')),
  by_user uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, by_user)
);
create index reactions_household_idx on public.reactions(household_id, created_at desc);

-- Mural de inspirações de cada cômodo: fotos, prints e links antes de virarem item.
create table public.inspirations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  image text not null default '' check (char_length(image) <= 500),
  link text not null default '' check (char_length(link) <= 1000),
  note text not null default '' check (char_length(note) <= 300),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inspirations_household_idx on public.inspirations(household_id);
create index inspirations_section_idx on public.inspirations(section_id);

-- Caderno da casa: wi-fi, contatos (síndico, frete, eletricista) e anotações.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null default 'nota' check (kind in ('nota', 'contato', 'wifi')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  phone text not null default '' check (char_length(phone) <= 40),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_household_idx on public.notes(household_id);

-- Contas fixas do mês (aluguel, luz, internet) e o pagamento de cada mês, com quem pagou (entra no acerto).
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  amount numeric(12, 2) not null default 0 check (amount >= 0 and amount < 100000000),
  due_day int not null default 10 check (due_day between 1 and 31),
  payer text not null default '' check (payer in ('', 'a', 'b', 'ambos')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bills_household_idx on public.bills(household_id);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  ym text not null check (ym ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount numeric(12, 2) not null check (amount >= 0 and amount < 100000000),
  payer text not null default '' check (payer in ('', 'a', 'b', 'ambos')),
  by_user uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bill_id, ym)
);
create index bill_payments_household_idx on public.bill_payments(household_id, ym);

-- Lista do mercado do dia a dia, separada das compras grandes.
create table public.groceries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 120),
  qty text not null default '' check (char_length(qty) <= 30),
  cat text not null default 'outros' check (cat in (
    'hortifruti', 'padaria', 'acougue', 'frios', 'mercearia', 'bebidas', 'limpeza', 'higiene', 'congelados', 'pet', 'outros')),
  done boolean not null default false,
  done_at timestamptz,
  by_user uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index groceries_household_idx on public.groceries(household_id);

-- Roteiro da viagem: o que fazer em cada dia, com link ou foto da reserva.
create table public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date,
  hour text not null default '' check (hour = '' or hour ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  text text not null check (char_length(trim(text)) between 1 and 300),
  link text not null default '' check (char_length(link) <= 1000),
  image text not null default '' check (char_length(image) <= 500),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trip_plans_household_idx on public.trip_plans(household_id);
create index trip_plans_trip_idx on public.trip_plans(trip_id);

-- updated_at automático, RLS por membro do casal e tempo real.
do $$
declare
  t text;
begin
  foreach t in array array['inspirations', 'notes', 'bills', 'groceries', 'trip_plans'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', t || '_touch', t);
  end loop;
  foreach t in array array['inspirations', 'notes', 'bills', 'bill_payments', 'groceries', 'trip_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id))',
      'so membros do casal', t);
  end loop;
  foreach t in array array['comments', 'reactions', 'inspirations', 'notes', 'bills', 'bill_payments', 'groceries', 'trip_plans'] loop
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end;
$$;

-- Comentários e reações: o casal todo lê; cada um escreve e apaga só os seus.
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
revoke all on public.comments, public.reactions from anon;
grant select, insert, delete on public.comments to authenticated;
grant select, insert, update, delete on public.reactions to authenticated;
create policy "membros leem" on public.comments for select to authenticated using (private.is_member(household_id));
create policy "cada um escreve o seu" on public.comments for insert to authenticated
  with check (private.is_member(household_id) and by_user = (select auth.uid()));
create policy "cada um apaga o seu" on public.comments for delete to authenticated
  using (private.is_member(household_id) and by_user = (select auth.uid()));
create policy "membros leem" on public.reactions for select to authenticated using (private.is_member(household_id));
create policy "cada um reage" on public.reactions for insert to authenticated
  with check (private.is_member(household_id) and by_user = (select auth.uid()));
create policy "cada um muda a sua" on public.reactions for update to authenticated
  using (private.is_member(household_id) and by_user = (select auth.uid()))
  with check (private.is_member(household_id) and by_user = (select auth.uid()));
create policy "cada um tira a sua" on public.reactions for delete to authenticated
  using (private.is_member(household_id) and by_user = (select auth.uid()));

-- A reação precisa ser de um evento do mesmo casal.
create function private.check_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.push_events e where e.id = new.event_id and e.household_id = new.household_id) then
    raise exception 'Essa novidade não é deste casal.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function private.check_reaction() from public;
create trigger reactions_check before insert or update of event_id, household_id on public.reactions
  for each row execute function private.check_reaction();

-- Comentários saem junto com o item ou a tarefa.
create function private.drop_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.comments c where c.target_id = old.id;
  return null;
end;
$$;
revoke all on function private.drop_comments() from public;
create trigger items_drop_comments after delete on public.items for each row execute function private.drop_comments();
create trigger tasks_drop_comments after delete on public.tasks for each row execute function private.drop_comments();

/* ---------- avisos ---------- */

alter table private.push_events drop constraint push_events_kind_check;
alter table private.push_events add constraint push_events_kind_check check (kind in ('novo', 'feito', 'comentario', 'reacao'));

create or replace function private.push_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_tab text;
  v_kind text;
  v_label text;
  v_link text;
  v_extra jsonb := '{}'::jsonb;
  ev record;
begin
  if uid is null then
    return null;
  end if;
  case tg_table_name
    when 'items' then
      select s.list into v_tab from public.sections s where s.id = new.section_id;
      v_label := new.name;
      v_link := '/section/' || new.section_id;
      if tg_op = 'INSERT' then
        v_kind := 'novo';
      elsif new.bought and not old.bought then
        v_kind := 'feito';
      end if;
    when 'tasks' then
      v_tab := 'mudanca';
      v_label := new.title;
      v_link := '/mudanca';
      if tg_op = 'INSERT' then
        v_kind := 'novo';
      elsif (new.done and not old.done)
        or (new.last_done_at is not null and new.last_done_at is distinct from old.last_done_at) then
        v_kind := 'feito'; -- tarefa que se repete: feita nesta vez e já marcada para a próxima
      end if;
    when 'apartments' then
      v_tab := 'ape';
      v_label := new.name;
      v_link := '/apt/' || new.id;
      if tg_op = 'INSERT' then
        v_kind := 'novo';
      elsif new.status is distinct from old.status then
        v_kind := 'feito';
        v_extra := jsonb_build_object('status', new.status);
      end if;
    when 'trips' then
      v_tab := 'viagem';
      v_kind := 'novo';
      v_label := new.name;
      v_link := '/trip/' || new.id;
    when 'trip_costs' then
      v_tab := 'viagem';
      v_kind := 'novo';
      v_label := coalesce(nullif(trim(new.descr), ''), new.cat);
      v_link := '/trip/' || new.trip_id;
      v_extra := jsonb_build_object('parent', (select t.name from public.trips t where t.id = new.trip_id));
    when 'trip_deposits' then
      v_tab := 'viagem';
      v_kind := 'feito';
      v_label := (select t.name from public.trips t where t.id = new.trip_id);
      v_link := '/trip/' || new.trip_id;
      v_extra := jsonb_build_object('amount', new.amount);
    when 'goals' then
      v_tab := 'dinheiro';
      v_kind := 'novo';
      v_label := new.name;
      v_link := '/dinheiro';
    when 'goal_deposits' then
      v_tab := 'dinheiro';
      v_kind := 'feito';
      v_label := (select g.name from public.goals g where g.id = new.goal_id);
      v_link := '/dinheiro';
      v_extra := jsonb_build_object('amount', new.amount);
    when 'comments' then
      v_kind := 'comentario';
      v_extra := jsonb_build_object('body', left(trim(new.body), 140));
      if new.target_table = 'items' then
        select s.list, i.name, '/section/' || i.section_id into v_tab, v_label, v_link
        from public.items i join public.sections s on s.id = i.section_id where i.id = new.target_id;
      else
        select 'mudanca', t.title, '/mudanca' into v_tab, v_label, v_link from public.tasks t where t.id = new.target_id;
      end if;
    when 'reactions' then
      select e.tab, e.label, e.link, e.tbl, e.kind into ev
      from private.push_events e where e.id = new.event_id and e.household_id = new.household_id;
      if not found then
        return null;
      end if;
      v_tab := ev.tab;
      v_kind := 'reacao';
      v_label := ev.label;
      v_link := ev.link;
      v_extra := jsonb_build_object('emoji', new.emoji, 'tbl', ev.tbl, 'kind', ev.kind);
    when 'bill_payments' then
      v_tab := 'dinheiro';
      v_kind := 'feito';
      v_label := (select b.name from public.bills b where b.id = new.bill_id);
      v_link := '/dinheiro';
      v_extra := jsonb_build_object('amount', new.amount);
    when 'groceries' then
      v_tab := 'mercado';
      v_kind := 'novo';
      v_label := new.text;
      v_link := '/mercado';
    else
      return null;
  end case;
  if v_kind is null or v_tab is null then
    return null;
  end if;
  insert into private.push_events (household_id, actor, tab, kind, tbl, row_id, label, link, extra)
  values (new.household_id, uid, v_tab, v_kind, tg_table_name, new.id, left(coalesce(v_label, ''), 200), v_link, v_extra);
  return null;
end;
$$;

drop trigger tasks_push on public.tasks;
create trigger tasks_push after insert or update of done, last_done_at on public.tasks
  for each row execute function private.push_event();
create trigger comments_push after insert on public.comments for each row execute function private.push_event();
create trigger reactions_push after insert on public.reactions for each row execute function private.push_event();
create trigger bill_payments_push after insert on public.bill_payments for each row execute function private.push_event();
create trigger groceries_push after insert on public.groceries for each row execute function private.push_event();

-- Igual à anterior, mais: as tabelas novas; tarefa repetida conta como feita; a aba "Mercado";
-- e "*:<tipo>" em notify_off desliga um tipo em todas as abas (comentários, reações).
create or replace function private.take_push_batches()
returns jsonb
language plpgsql set search_path = '' as $$
declare
  result jsonb;
begin
  delete from private.push_events where sent_at < now() - interval '30 days';

  with due as (
    select * from private.push_due()
  ),
  taken as (
    update private.push_events e set sent_at = now()
    from due d
    where e.sent_at is null
      and e.household_id = d.household_id and e.actor = d.actor and e.tab = d.tab and e.kind = d.kind
    returning e.*
  ),
  alive as (
    select distinct on (t.household_id, t.actor, t.tab, t.kind, t.tbl, t.row_id) t.*
    from taken t
    where case t.tbl
      when 'items' then exists (select 1 from public.items x where x.id = t.row_id and (t.kind = 'novo' or x.bought))
      when 'tasks' then exists (
        select 1 from public.tasks x where x.id = t.row_id and (t.kind = 'novo' or x.done or x.last_done_at is not null))
      when 'apartments' then exists (
        select 1 from public.apartments x where x.id = t.row_id and (t.kind = 'novo' or x.status = t.extra ->> 'status'))
      when 'trips' then exists (select 1 from public.trips x where x.id = t.row_id)
      when 'trip_costs' then exists (select 1 from public.trip_costs x where x.id = t.row_id)
      when 'trip_deposits' then exists (select 1 from public.trip_deposits x where x.id = t.row_id)
      when 'goals' then exists (select 1 from public.goals x where x.id = t.row_id)
      when 'goal_deposits' then exists (select 1 from public.goal_deposits x where x.id = t.row_id)
      when 'comments' then exists (select 1 from public.comments x where x.id = t.row_id)
      when 'reactions' then exists (select 1 from public.reactions x where x.id = t.row_id)
      when 'bill_payments' then exists (select 1 from public.bill_payments x where x.id = t.row_id)
      when 'groceries' then exists (select 1 from public.groceries x where x.id = t.row_id)
      else false
    end
    order by t.household_id, t.actor, t.tab, t.kind, t.tbl, t.row_id, t.created_at desc
  ),
  grp as (
    select a.household_id, a.actor, a.tab, a.kind,
      jsonb_agg(jsonb_build_object('tbl', a.tbl, 'label', a.label, 'link', a.link, 'extra', a.extra) order by a.created_at) as events
    from alive a
    group by a.household_id, a.actor, a.tab, a.kind
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'household', g.household_id,
    'tab', g.tab,
    'tabLabel', coalesce(nullif(trim(h.tabs -> g.tab ->> 'label'), ''), case g.tab
      when 'casa' then 'Casa' when 'switch' then 'Console' when 'ape' then 'Apê'
      when 'mudanca' then 'Mudança' when 'viagem' then 'Viagem' when 'dinheiro' then 'Dinheiro'
      when 'mercado' then 'Mercado' end),
    'kind', g.kind,
    'actor', coalesce(nullif(split_part(trim(am.display_name), ' ', 1), ''), 'Seu par'),
    'events', g.events,
    'devices', devs.list
  )), '[]'::jsonb)
  into result
  from grp g
  join public.households h on h.id = g.household_id
  left join public.household_members am on am.household_id = g.household_id and am.user_id = g.actor
  cross join lateral (
    select jsonb_agg(jsonb_build_object('kind', d.kind, 'endpoint', d.endpoint, 'keys', d.keys)) as list
    from public.household_members m
    join private.push_devices d on d.user_id = m.user_id
    where m.household_id = g.household_id
      and m.user_id <> g.actor
      and not m.notify_paused
      and not ((g.tab || ':' || g.kind) = any (m.notify_off))
      and not (('*:' || g.kind) = any (m.notify_off))
  ) devs
  where devs.list is not null;

  return result;
end;
$$;

-- "O que mudou" sem as reações (elas aparecem como emoji na própria linha).
create or replace function public.household_activity(p_household uuid, p_limit int default 120)
returns table (
  id bigint, actor uuid, actor_name text, tab text, kind text, tbl text, row_id uuid,
  label text, link text, extra jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_member(p_household) then
    raise exception 'Sem acesso a este casal.' using errcode = '42501';
  end if;
  return query
    select e.id, e.actor, coalesce(nullif(split_part(trim(m.display_name), ' ', 1), ''), 'Alguém'),
      e.tab, e.kind, e.tbl, e.row_id, e.label, e.link, e.extra, e.created_at
    from private.push_events e
    left join public.household_members m on m.household_id = e.household_id and m.user_id = e.actor
    where e.household_id = p_household and e.created_at > now() - interval '30 days' and e.kind <> 'reacao'
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 120), 1), 300);
end;
$$;

/* ---------- lembrete das contas (junto com o das 9h) ---------- */

-- Contas ativas ainda não pagas neste mês que vencem daqui a 2 dias, hoje ou venceram ontem.
-- Dia 31 em mês curto vira o último dia do mês.
create function private.take_bill_reminders()
returns jsonb
language sql stable set search_path = '' as $$
  with hoje as (
    select (now() at time zone 'America/Sao_Paulo')::date as d
  ),
  venc as (
    select b.household_id, b.name, b.amount,
      make_date(extract(year from h.d)::int, extract(month from h.d)::int,
        least(b.due_day, extract(day from (date_trunc('month', h.d) + interval '1 month - 1 day'))::int)) - h.d as dias
    from public.bills b cross join hoje h
    where b.active
      and not exists (select 1 from public.bill_payments p where p.bill_id = b.id and p.ym = to_char(h.d, 'YYYY-MM'))
  ),
  pend as (
    select v.household_id, jsonb_agg(jsonb_build_object('name', v.name, 'amount', v.amount, 'dias', v.dias) order by v.dias, v.name) as contas
    from venc v
    where v.dias in (2, 0, -1)
    group by v.household_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'household', p.household_id,
    'tabLabel', coalesce(nullif(trim(h.tabs -> 'dinheiro' ->> 'label'), ''), 'Dinheiro'),
    'contas', p.contas,
    'devices', devs.list
  )), '[]'::jsonb)
  from pend p
  join public.households h on h.id = p.household_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object('kind', d.kind, 'endpoint', d.endpoint, 'keys', d.keys)) as list
    from public.household_members m
    join private.push_devices d on d.user_id = m.user_id
    where m.household_id = p.household_id
      and not m.notify_paused
      and not ('dinheiro:conta' = any (m.notify_off))
  ) devs
  where devs.list is not null
    and coalesce(h.tabs -> 'dinheiro' ->> 'hidden', 'false') <> 'true';
$$;
revoke all on function private.take_bill_reminders() from public;

create or replace function private.kick_lembretes()
returns void
language plpgsql set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret' limit 1);
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  if private.take_task_reminders() = '[]'::jsonb and private.take_bill_reminders() = '[]'::jsonb and not exists (
    select 1 from private.price_checks c join public.items i on i.id = c.item_id where c.pending_from is not null and not i.bought
  ) then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/lembretes',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;
