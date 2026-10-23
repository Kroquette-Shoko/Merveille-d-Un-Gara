-- jdr-007 : origines du personnage — peuples, classes, spécialisations, passés
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
-- Une seule table : data.kind dit de quoi il s'agit.
--   kind : 'peuple' | 'classe' | 'specialisation' | 'passe'
--   Le détail des champs de data est décrit dans js/jdr-origins.js (jdrBlankOrigin).
-- Droits : tout compte connecté lit ; seul l'éditeur crée / modifie / supprime (comme jdr.cards).

create table jdr.origins (
  id          text primary key check (id ~ '^[a-z0-9_-]{2,64}$'),
  name        text not null check (char_length(name) between 1 and 80),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table jdr.origins is 'JDR : peuples, classes, spécialisations et passés. data.kind = type ; voir js/jdr-origins.js.';

create trigger origins_touch before update on jdr.origins
for each row execute function jdr.touch_updated_at();

alter table jdr.origins enable row level security;
create policy origins_select on jdr.origins for select to authenticated using (true);
create policy origins_insert on jdr.origins for insert to authenticated with check (jdr.is_editor());
create policy origins_update on jdr.origins for update to authenticated using (jdr.is_editor()) with check (jdr.is_editor());
create policy origins_delete on jdr.origins for delete to authenticated using (jdr.is_editor());

grant select, insert, update, delete on jdr.origins to authenticated;
