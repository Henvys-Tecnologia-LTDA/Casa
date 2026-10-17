-- Acerto do casal (como o Splitwise): cada vez que um passa dinheiro para o outro para ficarem quites.
-- O saldo junta as compras com "quem pagou" das listas e desconta estes acertos (src/lib/calc.ts: acerto).

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  payer text not null check (payer in ('a', 'b')),
  amount numeric(12, 2) not null check (amount > 0 and amount < 100000000),
  note text not null default '' check (char_length(note) <= 200),
  by_user uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index settlements_household_idx on public.settlements(household_id, created_at desc);

alter table public.settlements enable row level security;
revoke all on public.settlements from anon;
grant select, insert, update, delete on public.settlements to authenticated;
create policy "so membros do casal" on public.settlements
  for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));

alter publication supabase_realtime add table public.settlements;
