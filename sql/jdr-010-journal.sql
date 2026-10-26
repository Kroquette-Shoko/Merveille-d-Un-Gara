-- jdr-010 : journal de la table (PNJ, documents, dossiers) + scène par joueur
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
--
-- JOURNAL (onglet Journal du plateau) — une ligne = une entrée :
--   kind   : 'pnj' (fiche de PNJ) | 'doc' (document : image + texte, ex. lettre, carte, règle)
--   folder : dossier d'affichage (texte libre, ex. « Ville / Taverne »), '' = racine
--   sort   : ordre d'affichage dans le dossier
--   data   : { img, notes (visibles par ceux qui voient l'entrée), creature (id de carte Créature du bestiaire),
--             stats {corps, esprit, charme, resistance}, wounds (points de vie), armor, tags }
--   visible_all / visible_to : qui voit l'entrée (tous les joueurs, ou ces comptes)
--   controlled_by            : comptes qui peuvent modifier la fiche et déplacer ses pions
-- NOTES MJ : table séparée jdr.journal_secret, lisible par le MJ SEULEMENT (jamais envoyée aux joueurs).
--
-- SCÈNE PAR JOUEUR : campaigns.player_scenes = { "<id du joueur>": "<id de scène>" }
--   (vide = tout le monde est sur campaigns.active_scene, le marqueur « JOUEURS »)

alter table jdr.campaigns add column player_scenes jsonb not null default '{}'::jsonb;
comment on column jdr.campaigns.player_scenes is 'JDR : joueurs envoyés sur une autre scène que active_scene { user_id: scene_id }.';

create table jdr.journal (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references jdr.campaigns(id) on delete cascade,
  kind          text not null default 'pnj' check (kind in ('pnj','doc')),
  folder        text not null default '' check (char_length(folder) <= 120),
  sort          double precision not null default 0,
  name          text not null default 'Sans nom' check (char_length(name) between 1 and 120),
  data          jsonb not null default '{}'::jsonb,
  visible_all   boolean not null default false,
  visible_to    uuid[] not null default '{}',
  controlled_by uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table jdr.journal is 'JDR : journal de la table (PNJ, documents). Notes MJ dans jdr.journal_secret.';
create index journal_campaign on jdr.journal(campaign_id);
create trigger journal_touch before update on jdr.journal for each row execute function jdr.touch_updated_at();

create table jdr.journal_secret (
  entry_id    uuid primary key references jdr.journal(id) on delete cascade,
  campaign_id uuid not null references jdr.campaigns(id) on delete cascade,
  notes       text not null default '' check (char_length(notes) <= 20000),
  updated_at  timestamptz not null default now()
);
comment on table jdr.journal_secret is 'JDR : notes MJ des entrées du journal (MJ seulement).';
create trigger journal_secret_touch before update on jdr.journal_secret for each row execute function jdr.touch_updated_at();

-- Un joueur qui contrôle une fiche peut la modifier, mais pas changer qui la voit / la contrôle, ni la déplacer de campagne
create function jdr.journal_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not jdr.is_gm(old.campaign_id) then
    new.campaign_id := old.campaign_id; new.kind := old.kind; new.folder := old.folder; new.sort := old.sort;
    new.visible_all := old.visible_all; new.visible_to := old.visible_to; new.controlled_by := old.controlled_by;
  end if;
  return new;
end $$;
create trigger journal_guard before update on jdr.journal for each row execute function jdr.journal_guard();

alter table jdr.journal enable row level security;
create policy journal_select on jdr.journal for select to authenticated using (
  jdr.is_gm(campaign_id) or (jdr.is_member(campaign_id) and (visible_all or auth.uid() = any(visible_to) or auth.uid() = any(controlled_by))));
create policy journal_insert on jdr.journal for insert to authenticated with check (jdr.is_gm(campaign_id));
create policy journal_update on jdr.journal for update to authenticated
  using (jdr.is_gm(campaign_id) or (auth.uid() = any(controlled_by) and jdr.is_member(campaign_id)))
  with check (jdr.is_gm(campaign_id) or auth.uid() = any(controlled_by));
create policy journal_delete on jdr.journal for delete to authenticated using (jdr.is_gm(campaign_id));

alter table jdr.journal_secret enable row level security;
create policy journal_secret_all on jdr.journal_secret for all to authenticated
  using (jdr.is_gm(campaign_id)) with check (jdr.is_gm(campaign_id));

grant select, insert, update, delete on jdr.journal, jdr.journal_secret to authenticated;

alter publication supabase_realtime add table jdr.journal;

-- Pions : un joueur peut aussi déplacer les pions des PNJ qu'il contrôle (pion lié : data.journal = id de l'entrée)
create function jdr.controls_entry(p_entry text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jdr.journal j where j.id::text = p_entry and auth.uid() = any(j.controlled_by));
$$;
revoke execute on function jdr.controls_entry(text) from public, anon;
grant execute on function jdr.controls_entry(text) to authenticated;

drop policy board_items_update on jdr.board_items;
create policy board_items_update on jdr.board_items for update to authenticated
  using (jdr.is_gm(campaign_id) or (layer = 'tokens' and jdr.is_member(campaign_id)
         and (owner_id = auth.uid() or jdr.controls_entry(data->>'journal'))))
  with check (jdr.is_gm(campaign_id) or (layer = 'tokens' and (owner_id = auth.uid() or jdr.controls_entry(data->>'journal'))));

-- Un joueur ne peut changer que la position / l'apparence d'un pion qu'il contrôle : ni couche, ni propriétaire, ni fiche liée, ni scène
create function jdr.board_items_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not jdr.is_gm(old.campaign_id) then
    new.layer := old.layer; new.owner_id := old.owner_id; new.character_id := old.character_id; new.scene_id := old.scene_id; new.campaign_id := old.campaign_id;
    new.data := jsonb_set(new.data, '{journal}', coalesce(old.data->'journal', 'null'::jsonb));
  end if;
  return new;
end $$;
create trigger board_items_guard before update on jdr.board_items for each row execute function jdr.board_items_guard();
