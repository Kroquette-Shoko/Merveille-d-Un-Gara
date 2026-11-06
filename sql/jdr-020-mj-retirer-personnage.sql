-- jdr-020 : le MJ peut RETIRER un personnage de sa campagne (sans supprimer la fiche)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
-- La garde jdr.characters_guard (jdr-011) empêche le MJ de changer campaign_id : on passe donc par une fonction
-- qui vérifie que l'appelant est le MJ de la campagne du personnage, puis lève la garde pour cette seule mise à jour.
-- La fiche reste au joueur (il la retrouve dans son espace, « pas encore dans une partie ») ;
-- ses pions sont retirés des scènes de la campagne.

create or replace function jdr.characters_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.owner_id <> auth.uid() then          -- modification par le MJ (pas par le propriétaire)
    new.owner_id := old.owner_id; new.name := old.name;
    -- seule exception : jdr.gm_remove_character (réglage de session posé juste avant la mise à jour)
    if coalesce(current_setting('jdr.gm_remove', true), '') <> old.id::text then new.campaign_id := old.campaign_id; end if;
  end if;
  return new;
end $$;

create function jdr.gm_remove_character(p_character uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ch record;
begin
  select id, campaign_id into ch from jdr.characters where id = p_character;
  if ch is null or ch.campaign_id is null or not jdr.is_gm(ch.campaign_id) then raise exception 'Personnage introuvable dans tes parties'; end if;
  delete from jdr.board_items b using jdr.scenes s where b.scene_id = s.id and s.campaign_id = ch.campaign_id and b.character_id = ch.id;
  perform set_config('jdr.gm_remove', ch.id::text, true);
  update jdr.characters set campaign_id = null where id = ch.id;
  perform set_config('jdr.gm_remove', '', true);
end $$;
revoke execute on function jdr.gm_remove_character(uuid) from public, anon;
grant execute on function jdr.gm_remove_character(uuid) to authenticated;
