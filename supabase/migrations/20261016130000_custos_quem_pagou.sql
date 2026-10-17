-- Quem pagou cada custo da viagem, para entrar no acerto do casal (como os grupos do Splitwise).
alter table public.trip_costs
  add column payer text not null default '' check (payer in ('', 'a', 'b', 'ambos'));
