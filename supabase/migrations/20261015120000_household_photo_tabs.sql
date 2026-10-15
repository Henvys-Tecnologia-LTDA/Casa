-- Foto de perfil do casal e abas editáveis (nome, ícone, esconder).
-- tabs: {"switch": {"label": "Console", "icon": "gamepad", "hidden": false}, ...}; o que faltar usa o padrão do app.

alter table public.households
  add column photo text not null default '',
  add column tabs jsonb not null default '{}'::jsonb check (jsonb_typeof(tabs) = 'object');

grant update (photo, tabs) on public.households to authenticated;
