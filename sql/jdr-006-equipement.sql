-- jdr-006 : équipement — armes, armures, boucliers (puis objets magiques et objets divers)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
-- Une seule table pour tout l'équipement : data.kind dit de quoi il s'agit.
--   kind : 'arme' | 'armure' | 'bouclier' | 'magique' | 'objet'
--   Le détail des champs de data est décrit dans js/jdr-items.js (jdrBlankItem).
-- Droits : tout compte connecté lit ; seul l'éditeur crée / modifie / supprime (comme jdr.cards).

create table jdr.items (
  id          text primary key check (id ~ '^[a-z0-9_-]{2,64}$'),
  name        text not null check (char_length(name) between 1 and 80),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table jdr.items is 'JDR : équipement (armes, armures, boucliers, objets magiques, objets). data.kind = type d''objet ; voir js/jdr-items.js.';

create trigger items_touch before update on jdr.items
for each row execute function jdr.touch_updated_at();

alter table jdr.items enable row level security;
create policy items_select on jdr.items for select to authenticated using (true);
create policy items_insert on jdr.items for insert to authenticated with check (jdr.is_editor());
create policy items_update on jdr.items for update to authenticated using (jdr.is_editor()) with check (jdr.is_editor());
create policy items_delete on jdr.items for delete to authenticated using (jdr.is_editor());

grant select, insert, update, delete on jdr.items to authenticated;
