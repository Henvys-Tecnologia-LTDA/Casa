-- Avisos para o par (push): quando alguém adiciona ou conclui algo, os outros membros do casal recebem um aviso.
-- 1. Gatilhos anotam cada evento em private.push_events (quem fez, aba, "novo" ou "feito").
-- 2. Um cron por minuto chama a Edge Function "notify" quando há grupos prontos: eventos da mesma pessoa,
--    aba e tipo, depois de 1 minuto sem novidade (ou 5 minutos no máximo). Ela junta o grupo num aviso só
--    e manda pelo Expo (app Android) ou por web push (site instalado no iPhone ou no computador).
-- 3. Cada membro escolhe o que recebe em cada casal (household_members.notify_paused / notify_off).
-- Segredos no Vault: project_url e notify_secret (criados aqui); vapid_keys e vapid_public são criados
-- pela função notify na primeira vez que roda.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Preferências. Chaves em notify_off: "<aba>:novo" ou "<aba>:feito" (ex.: "casa:feito").
alter table public.household_members
  add column notify_paused boolean not null default false,
  add column notify_off text[] not null default '{}' check (cardinality(notify_off) <= 40);
grant update (notify_paused, notify_off) on public.household_members to authenticated;

-- Aparelhos que recebem avisos: token do Expo (Android) ou inscrição de web push.
create table private.push_devices (
  endpoint text primary key check (char_length(endpoint) between 1 and 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expo', 'web')),
  keys jsonb,
  updated_at timestamptz not null default now()
);
create index push_devices_user_idx on private.push_devices(user_id);

create table private.push_events (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor uuid not null,
  tab text not null,
  kind text not null check (kind in ('novo', 'feito')),
  tbl text not null,
  row_id uuid not null,
  label text not null default '',
  link text not null default '',
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index push_events_pending_idx on private.push_events(household_id, actor, tab, kind) where sent_at is null;
create index push_events_sent_idx on private.push_events(sent_at) where sent_at is not null;

revoke all on private.push_devices, private.push_events from public, anon, authenticated;

-- Gatilho: o que vira aviso. Só mudanças feitas por alguém logado (auth.uid()); importações não avisam.
create function private.push_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_tab text;
  v_kind text;
  v_label text;
  v_link text;
  v_extra jsonb := '{}'::jsonb;
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
      elsif new.done and not old.done then
        v_kind := 'feito';
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
revoke all on function private.push_event() from public;

create trigger items_push after insert or update of bought on public.items
  for each row execute function private.push_event();
create trigger tasks_push after insert or update of done on public.tasks
  for each row execute function private.push_event();
create trigger apartments_push after insert or update of status on public.apartments
  for each row execute function private.push_event();
create trigger trips_push after insert on public.trips
  for each row execute function private.push_event();
create trigger trip_costs_push after insert on public.trip_costs
  for each row execute function private.push_event();
create trigger trip_deposits_push after insert on public.trip_deposits
  for each row execute function private.push_event();
create trigger goals_push after insert on public.goals
  for each row execute function private.push_event();
create trigger goal_deposits_push after insert on public.goal_deposits
  for each row execute function private.push_event();

-- Cadastro do aparelho (chamado pelo app). Só endpoints dos serviços de push conhecidos, para a função
-- notify não ser usada para mandar requisições a qualquer endereço.
create function public.register_push_device(p_kind text, p_endpoint text, p_keys jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '28000';
  end if;
  if not (
    (p_kind = 'expo' and p_endpoint ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$')
    or (p_kind = 'web'
      and p_endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]*push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
      and char_length(p_endpoint) <= 1000
      and coalesce(p_keys ->> 'p256dh', '') ~ '^[A-Za-z0-9_-]{40,200}=*$'
      and coalesce(p_keys ->> 'auth', '') ~ '^[A-Za-z0-9_-]{10,100}=*$')
  ) then
    raise exception 'Aparelho inválido para avisos.' using errcode = '22023';
  end if;
  -- No máximo 10 aparelhos por pessoa: os mais antigos saem.
  delete from private.push_devices d
  where d.user_id = uid and d.endpoint <> p_endpoint
    and d.endpoint not in (
      select d2.endpoint from private.push_devices d2
      where d2.user_id = uid and d2.endpoint <> p_endpoint
      order by d2.updated_at desc limit 9
    );
  insert into private.push_devices (endpoint, user_id, kind, keys)
  values (
    p_endpoint, uid, p_kind,
    case when p_kind = 'web' then jsonb_build_object('p256dh', p_keys ->> 'p256dh', 'auth', p_keys ->> 'auth') end
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id, kind = excluded.kind, keys = excluded.keys, updated_at = now();
end;
$$;

create function public.unregister_push_device(p_endpoint text)
returns void
language sql security definer set search_path = '' as $$
  delete from private.push_devices where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

-- Chave pública VAPID para o navegador assinar o web push (é pública; a privada fica só no Vault).
create function public.push_public_key()
returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public' limit 1;
$$;

revoke all on function public.register_push_device(text, text, jsonb) from public, anon;
revoke all on function public.unregister_push_device(text) from public, anon;
revoke all on function public.push_public_key() from public, anon;
grant execute on function public.register_push_device(text, text, jsonb) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;
grant execute on function public.push_public_key() to authenticated;

-- Grupos prontos para sair: mesma pessoa, aba e tipo, sem novidade há 1 minuto
-- (ou com o primeiro evento há 5 minutos, para atividade contínua não segurar o aviso).
create function private.push_due()
returns table (household_id uuid, actor uuid, tab text, kind text)
language sql stable set search_path = '' as $$
  select e.household_id, e.actor, e.tab, e.kind
  from private.push_events e
  where e.sent_at is null
  group by e.household_id, e.actor, e.tab, e.kind
  having max(e.created_at) < now() - interval '1 minute'
      or min(e.created_at) < now() - interval '5 minutes';
$$;

-- Marca os grupos prontos como enviados e devolve o que a função notify precisa mandar:
-- [{household, tab, tabLabel, kind, actor, events: [{tbl, label, link, extra}], devices: [{kind, endpoint, keys}]}].
-- Some o que foi desfeito antes do aviso sair (item apagado, compra desmarcada...) e repetições da mesma linha.
create function private.take_push_batches()
returns jsonb
language plpgsql set search_path = '' as $$
declare
  result jsonb;
begin
  delete from private.push_events where sent_at < now() - interval '7 days';

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
      when 'tasks' then exists (select 1 from public.tasks x where x.id = t.row_id and (t.kind = 'novo' or x.done))
      when 'apartments' then exists (
        select 1 from public.apartments x where x.id = t.row_id and (t.kind = 'novo' or x.status = t.extra ->> 'status'))
      when 'trips' then exists (select 1 from public.trips x where x.id = t.row_id)
      when 'trip_costs' then exists (select 1 from public.trip_costs x where x.id = t.row_id)
      when 'trip_deposits' then exists (select 1 from public.trip_deposits x where x.id = t.row_id)
      when 'goals' then exists (select 1 from public.goals x where x.id = t.row_id)
      when 'goal_deposits' then exists (select 1 from public.goal_deposits x where x.id = t.row_id)
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
      when 'mudanca' then 'Mudança' when 'viagem' then 'Viagem' when 'dinheiro' then 'Dinheiro' end),
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
  ) devs
  where devs.list is not null;

  return result;
end;
$$;
revoke all on function private.take_push_batches() from public;

-- Chamado pelo cron a cada minuto: só acorda a função notify quando há grupo pronto.
create function private.kick_push()
returns void
language plpgsql set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret' limit 1);
begin
  if v_url is null or v_secret is null or not exists (select 1 from private.push_due()) then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/notify',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function private.kick_push() from public;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_secret', 'Senha do cron para chamar a função notify')
where not exists (select 1 from vault.secrets where name = 'notify_secret');
select vault.create_secret('https://xtyvinweiallepsxtpfu.supabase.co', 'project_url', 'URL do projeto, para o cron chamar Edge Functions')
where not exists (select 1 from vault.secrets where name = 'project_url');

select cron.schedule('avisos-do-casal', '* * * * *', 'select private.kick_push()');
