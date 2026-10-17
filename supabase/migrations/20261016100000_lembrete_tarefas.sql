-- Lembrete das 9h (Brasília) com as tarefas da mudança de hoje e as atrasadas. Vai para cada membro com
-- avisos ligados que não pausou tudo nem desligou "mudanca:lembrete" (Ajustes → Avisos), e só se a aba
-- Mudança não estiver escondida. Quem manda é a Edge Function "lembretes"; o agendamento fica em
-- 20261016150000_agendamentos.sql.

create function private.take_task_reminders()
returns jsonb
language sql stable set search_path = '' as $$
  with hoje as (
    select (now() at time zone 'America/Sao_Paulo')::date as d
  ),
  pend as (
    select t.household_id,
      coalesce(array_agg(t.title order by t.created_at) filter (where t.due = (select d from hoje)), '{}') as hoje,
      coalesce(array_agg(t.title order by t.due, t.created_at) filter (where t.due < (select d from hoje)), '{}') as atrasadas
    from public.tasks t
    where not t.done and t.due is not null and t.due <= (select d from hoje)
    group by t.household_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'household', p.household_id,
    'tabLabel', coalesce(nullif(trim(h.tabs -> 'mudanca' ->> 'label'), ''), 'Mudança'),
    'hoje', to_jsonb(p.hoje),
    'atrasadas', to_jsonb(p.atrasadas),
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
      and not ('mudanca:lembrete' = any (m.notify_off))
  ) devs
  where devs.list is not null
    and coalesce(h.tabs -> 'mudanca' ->> 'hidden', 'false') <> 'true';
$$;
revoke all on function private.take_task_reminders() from public;

-- Chamado pelo cron: só acorda a função quando há lembrete para mandar.
create function private.kick_lembretes()
returns void
language plpgsql set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret' limit 1);
begin
  if v_url is null or v_secret is null or private.take_task_reminders() = '[]'::jsonb then
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
revoke all on function private.kick_lembretes() from public;
