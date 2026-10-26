-- jdr-008 : plateau de jeu — scènes, éléments posés sur le plateau (3 couches), images
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
--
-- Une campagne a plusieurs SCÈNES (une carte de donjon, une ville…) ; campaigns.active_scene = celle affichée aux joueurs.
-- Chaque scène contient des ÉLÉMENTS (jdr.board_items) rangés sur 3 couches :
--   'map'    : la carte (images de fond)            → vue par tous, modifiée par le MJ
--   'tokens' : les pions                            → vus par tous ; le MJ déplace tout, un joueur ses propres pions
--   'gm'     : couche cachée du MJ (notes, pièges…) → JAMAIS envoyée aux joueurs (bloqué par le serveur, RLS)
-- data (jsonb) d'un élément : { name, img, x, y, w, h, rot, round (pion rond), locked, z }
--   x, y, w, h en pixels « monde » ; l'échelle de la scène (data.scale = pixels par mètre) donne les distances.
--
-- Images / sons : bucket « jdr-plateau » (lecture publique par adresse ; envoi / suppression par le MJ
-- de la campagne, dans le dossier <id de la campagne>/…).

create table jdr.scenes (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references jdr.campaigns(id) on delete cascade,
  name        text not null default 'Scène' check (char_length(name) between 1 and 80),
  data        jsonb not null default '{}'::jsonb,   -- { scale: pixels par mètre, bg: couleur de fond }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table jdr.scenes is 'JDR : scènes du plateau d''une campagne (carte + pions). data.scale = pixels par mètre.';
create index scenes_campaign on jdr.scenes(campaign_id);
create trigger scenes_touch before update on jdr.scenes for each row execute function jdr.touch_updated_at();

alter table jdr.campaigns add column active_scene uuid references jdr.scenes(id) on delete set null;
comment on column jdr.campaigns.active_scene is 'JDR : scène du plateau affichée aux joueurs.';

create table jdr.board_items (
  id           uuid primary key default gen_random_uuid(),
  scene_id     uuid not null references jdr.scenes(id) on delete cascade,
  campaign_id  uuid not null references jdr.campaigns(id) on delete cascade,  -- recopié depuis la scène (trigger)
  layer        text not null default 'tokens' check (layer in ('map','tokens','gm')),
  owner_id     uuid references auth.users(id) on delete set null,            -- joueur qui contrôle ce pion
  character_id uuid references jdr.characters(id) on delete set null,        -- fiche liée au pion
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table jdr.board_items is 'JDR : éléments du plateau (images de carte, pions, couche cachée du MJ).';
create index board_items_scene on jdr.board_items(scene_id);
create index board_items_campaign on jdr.board_items(campaign_id);
create trigger board_items_touch before update on jdr.board_items for each row execute function jdr.touch_updated_at();

-- campaign_id toujours égal à celui de la scène (sert aux droits : on ne peut pas « tricher » sur la campagne)
create function jdr.board_items_campaign() returns trigger
language plpgsql set search_path = '' as $$
begin
  select s.campaign_id into new.campaign_id from jdr.scenes s where s.id = new.scene_id;
  if new.campaign_id is null then raise exception 'Scène introuvable'; end if;
  return new;
end $$;
create trigger board_items_campaign before insert or update on jdr.board_items
for each row execute function jdr.board_items_campaign();

-- Droits
alter table jdr.scenes enable row level security;
create policy scenes_select on jdr.scenes for select to authenticated using (jdr.is_gm(campaign_id) or jdr.is_member(campaign_id));
create policy scenes_insert on jdr.scenes for insert to authenticated with check (jdr.is_gm(campaign_id));
create policy scenes_update on jdr.scenes for update to authenticated using (jdr.is_gm(campaign_id)) with check (jdr.is_gm(campaign_id));
create policy scenes_delete on jdr.scenes for delete to authenticated using (jdr.is_gm(campaign_id));

alter table jdr.board_items enable row level security;
-- la couche 'gm' n'est lisible QUE par le MJ
create policy board_items_select on jdr.board_items for select to authenticated
  using (jdr.is_gm(campaign_id) or (layer <> 'gm' and jdr.is_member(campaign_id)));
create policy board_items_insert on jdr.board_items for insert to authenticated with check (jdr.is_gm(campaign_id));
create policy board_items_delete on jdr.board_items for delete to authenticated using (jdr.is_gm(campaign_id));
-- un joueur ne modifie que SES pions (couche pions), sans pouvoir les donner à un autre ni les changer de couche
create policy board_items_update on jdr.board_items for update to authenticated
  using (jdr.is_gm(campaign_id) or (owner_id = auth.uid() and layer = 'tokens' and jdr.is_member(campaign_id)))
  with check (jdr.is_gm(campaign_id) or (owner_id = auth.uid() and layer = 'tokens'));

grant select, insert, update, delete on jdr.scenes, jdr.board_items to authenticated;

-- Temps réel : les changements sont envoyés aux navigateurs (en respectant les droits ci-dessus)
alter publication supabase_realtime add table jdr.scenes, jdr.board_items, jdr.campaigns;

-- Bucket de fichiers du plateau (dédié au JDR, jamais ceux de Rimd'Orël)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jdr-plateau', 'jdr-plateau', true, 20971520,
        array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','audio/mpeg','audio/ogg','audio/wav','audio/webm']);

-- MJ du dossier : le 1er dossier du chemin est l'id de la campagne
create function jdr.is_gm_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v text := split_part(p_name, '/', 1);
begin
  if v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return jdr.is_gm(v::uuid);
end $$;
revoke execute on function jdr.is_gm_path(text) from public, anon;   -- pas pour les visiteurs non connectés
grant execute on function jdr.is_gm_path(text) to authenticated;

create policy jdr_plateau_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'jdr-plateau' and jdr.is_gm_path(name));
create policy jdr_plateau_update on storage.objects for update to authenticated
  using (bucket_id = 'jdr-plateau' and jdr.is_gm_path(name)) with check (bucket_id = 'jdr-plateau' and jdr.is_gm_path(name));
create policy jdr_plateau_delete on storage.objects for delete to authenticated
  using (bucket_id = 'jdr-plateau' and jdr.is_gm_path(name));
create policy jdr_plateau_select on storage.objects for select to authenticated
  using (bucket_id = 'jdr-plateau' and jdr.is_gm_path(name));
