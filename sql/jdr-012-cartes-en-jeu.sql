-- jdr-012 : cartes en jeu sur le plateau — pioche, main, défausse, bannies, en jeu (par personnage)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
--
-- Une ligne par personnage d'une campagne :
--   data = { draw: [carte…], hand: [carte…], discard: [carte…], banished: [carte…], play: [carte…] }
--   carte = { u: identifiant unique de l'exemplaire, c: id de la carte (jdr.cards) }
--   draw[0] = carte du dessus de la pioche ; discard[dernier] = carte du dessus de la défausse
--   version : augmente à chaque modification (évite que deux personnes s'écrasent : on n'enregistre
--             que si la version n'a pas changé entre-temps, sinon on relit et on recommence)
-- Droits (choix du MJ, 26/10/2026) : accès LIBRE pour le MJ et tous les joueurs de la campagne ;
--   tout est noté dans la discussion (journal des actions).

create table jdr.play_states (
  character_id uuid primary key references jdr.characters(id) on delete cascade,
  campaign_id  uuid not null references jdr.campaigns(id) on delete cascade,
  owner_id     uuid,                       -- joueur du personnage (copié, pour l'affichage)
  char_name    text not null default '',   -- nom du personnage (copié : les autres joueurs ne lisent pas sa fiche)
  version      integer not null default 0,
  data         jsonb not null default '{"draw":[],"hand":[],"discard":[],"banished":[],"play":[]}'::jsonb,
  updated_at   timestamptz not null default now()
);
comment on table jdr.play_states is 'JDR : piles de cartes en jeu (pioche, main, défausse, bannies, en jeu) d''un personnage.';
create index play_states_campaign on jdr.play_states(campaign_id);
create trigger play_states_touch before update on jdr.play_states for each row execute function jdr.touch_updated_at();

-- campaign_id, owner_id, char_name = ceux du personnage (toujours)
create function jdr.play_states_campaign() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select ch.campaign_id, ch.owner_id, ch.name into new.campaign_id, new.owner_id, new.char_name from jdr.characters ch where ch.id = new.character_id;
  if new.campaign_id is null then raise exception 'Personnage hors campagne'; end if;
  return new;
end $$;
create trigger play_states_campaign before insert or update on jdr.play_states
for each row execute function jdr.play_states_campaign();

alter table jdr.play_states enable row level security;
create policy play_states_select on jdr.play_states for select to authenticated using (jdr.is_gm(campaign_id) or jdr.is_member(campaign_id));
create policy play_states_insert on jdr.play_states for insert to authenticated with check (jdr.is_gm(campaign_id) or jdr.is_member(campaign_id));
create policy play_states_update on jdr.play_states for update to authenticated
  using (jdr.is_gm(campaign_id) or jdr.is_member(campaign_id)) with check (jdr.is_gm(campaign_id) or jdr.is_member(campaign_id));
create policy play_states_delete on jdr.play_states for delete to authenticated using (jdr.is_gm(campaign_id));
grant select, insert, update, delete on jdr.play_states to authenticated;

alter publication supabase_realtime add table jdr.play_states;
