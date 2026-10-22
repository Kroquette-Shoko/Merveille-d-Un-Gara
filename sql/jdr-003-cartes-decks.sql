-- jdr-003 : cartes du JDR et deck des personnages (schéma jdr uniquement)
--
-- Qui peut faire quoi :
--   - Tout compte connecté peut LIRE les cartes (bibliothèque, construction de deck).
--   - Seul l'éditeur (compte Kroquette) peut créer, modifier ou supprimer des cartes.
--   - Le deck d'un personnage est stocké dans jdr.characters.deck : mêmes droits que la fiche
--     (le joueur le modifie, son MJ le lit).

-- Qui a le droit d'éditer les cartes (même compte que l'administrateur de Rimd'Orël)
create function jdr.is_editor() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() = 'f43e9cf5-730e-4ede-9b15-1f267d7d7780'::uuid
$$;

create table jdr.cards (
  id          text primary key check (id ~ '^[a-z0-9_-]{3,64}$'),
  name        text not null check (char_length(name) between 1 and 80),
  data        jsonb not null default '{}'::jsonb,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table jdr.cards is 'JDR : cartes. data = contenu complet de la carte (type, valeur, coûts, accès, capacités = déclencheurs + effets). Format décrit dans js/jdr-rules.js.';

create trigger cards_touch before update on jdr.cards
for each row execute function jdr.touch_updated_at();

-- Deck du personnage : liste [{ "card": "<id carte>", "qty": n }]
alter table jdr.characters add column deck jsonb not null default '[]'::jsonb;
comment on column jdr.characters.deck is 'JDR : deck du personnage, liste [{card, qty}]. Séparé de data pour que la fiche et le constructeur de deck ne s''écrasent pas.';

alter table jdr.cards enable row level security;
create policy cards_select on jdr.cards for select to authenticated using (true);
create policy cards_insert on jdr.cards for insert to authenticated with check (jdr.is_editor());
create policy cards_update on jdr.cards for update to authenticated using (jdr.is_editor()) with check (jdr.is_editor());
create policy cards_delete on jdr.cards for delete to authenticated using (jdr.is_editor());

grant select, insert, update, delete on jdr.cards to authenticated;
revoke execute on function jdr.is_editor() from public, anon;
grant execute on function jdr.is_editor() to authenticated;
