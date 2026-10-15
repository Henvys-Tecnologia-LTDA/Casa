-- Casais (households), membros e funções de convite.
-- Cada usuário só enxerga os casais dos quais é membro.

create schema if not exists private;
grant usage on schema private to authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique,
  name_a text not null default 'Pessoa 1' check (char_length(name_a) <= 40),
  name_b text not null default 'Pessoa 2' check (char_length(name_b) <= 40),
  renda numeric(14,2) not null default 0 check (renda >= 0),
  budget_casa numeric(14,2) not null default 0 check (budget_casa >= 0),
  budget_switch numeric(14,2) not null default 0 check (budget_switch >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index households_created_by_idx on public.households(created_by);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

-- Helpers de RLS ficam no schema private (não exposto pela API).
create function private.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

-- Versão para caminhos do Storage ("<household_id>/arquivo.jpg"), sem cast que possa falhar.
create function private.is_member_text(hid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id::text = hid and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_member_text(text) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_member_text(text) to authenticated;

create function private.new_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.households h where h.invite_code = code);
  end loop;
  return code;
end;
$$;
revoke all on function private.new_invite_code() from public;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger households_touch before update on public.households
  for each row execute function private.touch_updated_at();

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "membros veem o casal" on public.households
  for select to authenticated using (private.is_member(id));
create policy "membros editam o casal" on public.households
  for update to authenticated using (private.is_member(id)) with check (private.is_member(id));

create policy "membros veem os membros" on public.household_members
  for select to authenticated using (private.is_member(household_id));
create policy "cada um edita o próprio nome" on public.household_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cada um pode sair do casal" on public.household_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- Só colunas de ajustes podem ser alteradas diretamente; convite e dono, só pelas funções.
revoke insert, update, delete on public.households from anon, authenticated;
grant select on public.households to authenticated;
grant update (name, name_a, name_b, renda, budget_casa, budget_switch) on public.households to authenticated;

revoke insert, update on public.household_members from anon, authenticated;
grant select, delete on public.household_members to authenticated;
grant update (display_name) on public.household_members to authenticated;

-- RPCs: criar casal, entrar por código, gerar novo código.
create function public.create_household(p_name text, p_name_a text default '', p_name_b text default '', p_display_name text default '')
returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  h public.households;
begin
  if uid is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '28000';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Dê um nome ao casal.' using errcode = '22023';
  end if;
  if (select count(*) from public.households x where x.created_by = uid) >= 10 then
    raise exception 'Limite de casais criados atingido.' using errcode = '54000';
  end if;
  insert into public.households (name, invite_code, name_a, name_b, created_by)
  values (
    left(trim(p_name), 80),
    private.new_invite_code(),
    left(coalesce(nullif(trim(p_name_a), ''), 'Pessoa 1'), 40),
    left(coalesce(nullif(trim(p_name_b), ''), 'Pessoa 2'), 40),
    uid
  )
  returning * into h;
  insert into public.household_members (household_id, user_id, display_name)
  values (h.id, uid, left(coalesce(trim(p_display_name), ''), 60));
  return h;
end;
$$;

create function public.join_household(p_code text, p_display_name text default '')
returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  h public.households;
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '28000';
  end if;
  select * into h from public.households x where x.invite_code = clean;
  if not found then
    raise exception 'Código de convite não encontrado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.household_members m where m.household_id = h.id and m.user_id = uid)
     and (select count(*) from public.household_members m where m.household_id = h.id) >= 4 then
    raise exception 'Este casal já está completo.' using errcode = '54000';
  end if;
  insert into public.household_members (household_id, user_id, display_name)
  values (h.id, uid, left(coalesce(trim(p_display_name), ''), 60))
  on conflict (household_id, user_id) do nothing;
  return h;
end;
$$;

create function public.regenerate_invite(p_household uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  c text;
begin
  if not private.is_member(p_household) then
    raise exception 'Sem acesso a este casal.' using errcode = '42501';
  end if;
  update public.households set invite_code = private.new_invite_code()
  where id = p_household
  returning invite_code into c;
  return c;
end;
$$;

revoke all on function public.create_household(text, text, text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
revoke all on function public.regenerate_invite(uuid) from public, anon;
grant execute on function public.create_household(text, text, text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
