-- "O que mudou": o histórico do casal, a partir dos eventos que os avisos já anotam (private.push_events).
-- Só membros do casal leem, e só do próprio casal. O histórico passa a guardar 30 dias (antes, 7).

create index push_events_household_time_idx on private.push_events(household_id, created_at desc);

create function public.household_activity(p_household uuid, p_limit int default 120)
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
    where e.household_id = p_household and e.created_at > now() - interval '30 days'
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 120), 1), 300);
end;
$$;
revoke all on function public.household_activity(uuid, int) from public, anon;
grant execute on function public.household_activity(uuid, int) to authenticated;

-- Os eventos já enviados eram apagados depois de 7 dias; agora ficam 30 para o histórico.
-- Troca só o prazo na função que está no banco, sem reescrevê-la.
do $$
declare
  def text := pg_get_functiondef('private.take_push_batches()'::regprocedure);
begin
  if position('interval ''7 days''' in def) = 0 then
    raise exception 'private.take_push_batches mudou: ajuste o prazo do histórico à mão.';
  end if;
  execute replace(def, 'interval ''7 days''', 'interval ''30 days''');
end;
$$;
