-- jdr-004 : tableaux d'action de groupe des créatures (schéma jdr uniquement)
-- Un tableau = 6 résultats de dé (effet + effet bonus), préparé à part puis attribué aux créatures
-- (champ data.creature.group d'une carte de type « Créature »).
-- Droits : tout compte connecté lit ; seul l'éditeur crée / modifie / supprime.

create table jdr.creature_groups (
  id          text primary key check (id ~ '^[a-z0-9_-]{3,64}$'),
  name        text not null check (char_length(name) between 1 and 80),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table jdr.creature_groups is 'JDR : tableaux d''action de groupe. data = { rows: [{effect, bonus}] x6 }.';

create trigger creature_groups_touch before update on jdr.creature_groups
for each row execute function jdr.touch_updated_at();

alter table jdr.creature_groups enable row level security;
create policy creature_groups_select on jdr.creature_groups for select to authenticated using (true);
create policy creature_groups_insert on jdr.creature_groups for insert to authenticated with check (jdr.is_editor());
create policy creature_groups_update on jdr.creature_groups for update to authenticated using (jdr.is_editor()) with check (jdr.is_editor());
create policy creature_groups_delete on jdr.creature_groups for delete to authenticated using (jdr.is_editor());

grant select, insert, update, delete on jdr.creature_groups to authenticated;
