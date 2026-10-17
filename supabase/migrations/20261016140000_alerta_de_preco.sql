-- "Baixou de preço" (como o camelcamelcamel): uma vez por dia a função ler-link confere o preço dos
-- itens que faltam comprar e têm link; quando cai 3% ou mais (em relação ao último visto ou, na primeira
-- vez, ao preço anotado), a função lembretes avisa às 9h. Cada um desliga em Ajustes → Avisos
-- ("<lista>:preco"). Os agendamentos ficam em 20261016150000_agendamentos.sql.

create table private.price_checks (
  item_id uuid primary key references public.items(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  price numeric(12, 2),
  checked_at timestamptz not null default now(),
  pending_from numeric(12, 2)
);
create index price_checks_pending_idx on private.price_checks(household_id) where pending_from is not null;
revoke all on private.price_checks from public, anon, authenticated;

-- Itens para conferir hoje: faltam comprar, têm link e não foram vistos nas últimas 20 horas.
create function private.take_price_checks(p_limit int default 20)
returns table (id uuid, link text, price numeric)
language sql stable set search_path = '' as $$
  select i.id, i.link, i.price
  from public.items i
  left join private.price_checks c on c.item_id = i.id
  where not i.bought and i.link ~* '^https?://' and (c.checked_at is null or c.checked_at < now() - interval '20 hours')
  order by c.checked_at nulls first, i.created_at
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function private.take_price_checks(int) from public;

-- Guarda o preço visto (null = não deu para ler hoje) e marca a queda para o aviso das 9h.
create function private.save_price_check(p_item uuid, p_price numeric)
returns void
language sql set search_path = '' as $$
  insert into private.price_checks as c (item_id, household_id, price, checked_at, pending_from)
  select i.id, i.household_id, p_price, now(),
    case when p_price > 0 and i.price > 0 and p_price <= i.price * 0.97 then i.price end
  from public.items i where i.id = p_item
  on conflict (item_id) do update set
    pending_from = case
      when excluded.price > 0 and c.price > 0 and excluded.price <= c.price * 0.97 then coalesce(c.pending_from, c.price)
      when excluded.price > 0 and c.pending_from is not null and excluded.price >= c.pending_from then null
      else c.pending_from end,
    price = coalesce(excluded.price, c.price),
    checked_at = now();
$$;
revoke all on function private.save_price_check(uuid, numeric) from public;

-- Quedas prontas para avisar, por casal e lista, com os aparelhos de quem quer saber; já marca como avisadas.
create function private.take_price_alerts()
returns jsonb
language plpgsql set search_path = '' as $$
declare
  result jsonb;
begin
  -- Item que já foi comprado não precisa mais de aviso.
  update private.price_checks c set pending_from = null
  from public.items i where i.id = c.item_id and c.pending_from is not null and i.bought;

  -- O RETURNING do update já vê pending_from nulo: o preço antigo vem deste CTE.
  with old as (
    select c.item_id, c.pending_from
    from private.price_checks c join public.items i on i.id = c.item_id
    where c.pending_from is not null and not i.bought and c.price < c.pending_from
  ),
  taken as (
    update private.price_checks c set pending_from = null
    from old where c.item_id = old.item_id
    returning c.item_id, c.household_id, c.price, old.pending_from as old_price
  ),
  drops as (
    select t.household_id, s.list, i.name, i.store, t.old_price, t.price, i.section_id
    from taken t
    join public.items i on i.id = t.item_id
    join public.sections s on s.id = i.section_id
  ),
  grp as (
    select d.household_id, d.list,
      jsonb_agg(jsonb_build_object('name', d.name, 'store', d.store, 'from', d.old_price, 'to', d.price, 'section', d.section_id) order by d.old_price - d.price desc) as drops
    from drops d
    group by d.household_id, d.list
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'household', g.household_id,
    'list', g.list,
    'tabLabel', coalesce(nullif(trim(h.tabs -> g.list ->> 'label'), ''), case g.list when 'casa' then 'Casa' else 'Console' end),
    'drops', g.drops,
    'devices', devs.list
  )), '[]'::jsonb)
  into result
  from grp g
  join public.households h on h.id = g.household_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object('kind', d.kind, 'endpoint', d.endpoint, 'keys', d.keys)) as list
    from public.household_members m
    join private.push_devices d on d.user_id = m.user_id
    where m.household_id = g.household_id
      and not m.notify_paused
      and not ((g.list || ':preco') = any (m.notify_off))
  ) devs
  where devs.list is not null;
  return result;
end;
$$;
revoke all on function private.take_price_alerts() from public;

-- O último preço visto na loja, para a ficha do item ("Na loja hoje: …").
create function public.item_price_check(p_item uuid)
returns table (price numeric, checked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.price, c.checked_at
  from private.price_checks c
  where c.item_id = p_item and private.is_member(c.household_id) and c.price is not null;
$$;
revoke all on function public.item_price_check(uuid) from public, anon;
grant execute on function public.item_price_check(uuid) to authenticated;

-- O cron das 9h também acorda a função lembretes quando há queda de preço para avisar.
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
  if private.take_task_reminders() = '[]'::jsonb and not exists (
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

-- Chamado pelo cron das 8h: a função ler-link confere os preços do dia.
create function private.kick_precos()
returns void
language plpgsql set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret' limit 1);
begin
  if v_url is null or v_secret is null or not exists (select 1 from private.take_price_checks(1)) then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/ler-link',
    body := '{"mode":"vigiar"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 150000
  );
end;
$$;
revoke all on function private.kick_precos() from public;
