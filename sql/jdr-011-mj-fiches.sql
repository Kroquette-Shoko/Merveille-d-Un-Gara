-- jdr-011 : le MJ peut modifier les fiches des joueurs de SA campagne (points de vie, armure, mana depuis le plateau)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
-- Le MJ ne peut ni changer le propriétaire d'une fiche, ni la sortir de la campagne (garde ci-dessous).
-- Temps réel : les changements de fiche arrivent sur le plateau (barres des pions).

create policy characters_update_gm on jdr.characters for update to authenticated
  using (campaign_id is not null and jdr.is_gm(campaign_id))
  with check (campaign_id is not null and jdr.is_gm(campaign_id));

create function jdr.characters_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.owner_id <> auth.uid() then          -- modification par le MJ (pas par le propriétaire)
    new.owner_id := old.owner_id; new.campaign_id := old.campaign_id; new.name := old.name;
  end if;
  return new;
end $$;
create trigger characters_guard before update on jdr.characters for each row execute function jdr.characters_guard();

alter publication supabase_realtime add table jdr.characters;
