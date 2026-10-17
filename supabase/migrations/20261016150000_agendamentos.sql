-- Liga os avisos agendados (horário de Brasília, sem horário de verão desde 2019):
-- 8h (11:00 UTC): a função ler-link confere os preços dos itens com link;
-- 9h (12:00 UTC): a função lembretes manda as tarefas de hoje/atrasadas e as quedas de preço.
select cron.schedule('precos-das-8h', '0 11 * * *', 'select private.kick_precos()');
select cron.schedule('lembrete-das-9h', '0 12 * * *', 'select private.kick_lembretes()');
