-- jdr-009 : messages de la table — discussion du plateau ET journal des actions (deck, scènes…)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
--   kind : 'chat'   = message écrit par quelqu'un
--          'action' = action de jeu notée automatiquement (ex. « Thorgal défausse Esquiver »)
--          'system' = information du plateau (ex. « Le MJ affiche la scène Taverne »)
--   data : détails libres (carte concernée, couleur…)
-- Droits : le MJ et les joueurs de la campagne lisent ; chacun écrit en son nom ; seul le MJ efface.

create table jdr.messages (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references jdr.campaigns(id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 80),
  kind        text not null default 'chat' check (kind in ('chat','action','system')),
  text        text not null check (char_length(text) between 1 and 2000),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
comment on table jdr.messages is 'JDR : discussion de la table et journal des actions du plateau.';
create index messages_campaign on jdr.messages(campaign_id, created_at desc);

alter table jdr.messages enable row level security;
create policy messages_select on jdr.messages for select to authenticated
  using (jdr.is_gm(campaign_id) or jdr.is_member(campaign_id));
create policy messages_insert on jdr.messages for insert to authenticated
  with check (author_id = auth.uid() and (jdr.is_gm(campaign_id) or jdr.is_member(campaign_id)));
create policy messages_delete on jdr.messages for delete to authenticated using (jdr.is_gm(campaign_id));
grant select, insert, delete on jdr.messages to authenticated;

alter publication supabase_realtime add table jdr.messages;
