-- jdr-014 : suivi des tours et des scènes sur le plateau
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
--
-- campaigns.turn = {
--   mode    : 'combat' | 'scene' | null (rien en cours)
--   round   : numéro du round de combat          scene : numéro de la scène
--   acted   : [ id des personnages qui ont joué ce round / cette scène ]
--   foes    : [ { id: id du pion, name } ]  adversaires du combat     foesActed : [ id des pions adversaires qui ont joué ]
--   current : { kind: 'pc' | 'foe', id, name } | null   (qui joue en ce moment)
--   last    : 'pc' | 'foe' | null            (dernier à avoir joué : sert à l'alternance)
--   strict  : vrai = alternance obligatoire (un adversaire entre deux joueurs, tant qu'il reste des adversaires)
-- }
-- Le MJ modifie turn directement (droits de jdr.campaigns).
-- Un joueur passe par jdr.turn_player(campagne, personnage, 'start' | 'end') : il ne peut agir que pour SON personnage.

alter table jdr.campaigns add column turn jsonb not null default '{}'::jsonb;
comment on column jdr.campaigns.turn is 'JDR : suivi du tour / de la scène sur le plateau (voir sql/jdr-014-tours.sql).';

create function jdr.turn_player(p_campaign uuid, p_character uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t jsonb; ch record; foes_left int; cur jsonb;
begin
  select * into ch from jdr.characters where id = p_character and campaign_id = p_campaign;
  if ch is null or (ch.owner_id <> auth.uid() and not jdr.is_gm(p_campaign)) then raise exception 'Personnage introuvable'; end if;
  select turn into t from jdr.campaigns where id = p_campaign for update;
  if coalesce(t->>'mode', '') = '' then raise exception 'Aucun tour en cours'; end if;
  cur := t->'current';
  if p_action = 'start' then
    if t->'acted' ? p_character::text then raise exception 'Ce personnage a déjà joué ce round'; end if;
    if cur is not null and jsonb_typeof(cur) = 'object' then raise exception 'Quelqu''un est déjà en train de jouer'; end if;
    if t->>'mode' = 'combat' and coalesce((t->>'strict')::boolean, true) and t->>'last' = 'pc' then
      select count(*) into foes_left from jsonb_array_elements(coalesce(t->'foes', '[]'::jsonb)) f
        where not (coalesce(t->'foesActed', '[]'::jsonb) ? (f->>'id'));
      if foes_left > 0 then raise exception 'Au tour d''un adversaire'; end if;
    end if;
    t := jsonb_set(t, '{current}', jsonb_build_object('kind', 'pc', 'id', p_character, 'name', ch.name));
    t := jsonb_set(t, '{acted}', coalesce(t->'acted', '[]'::jsonb) || to_jsonb(p_character::text));
  elsif p_action = 'end' then
    if cur is null or jsonb_typeof(cur) <> 'object' or cur->>'id' <> p_character::text then raise exception 'Ce n''est pas le tour de ce personnage'; end if;
    t := jsonb_set(t, '{current}', 'null'::jsonb);
    t := jsonb_set(t, '{last}', '"pc"'::jsonb);
  else
    raise exception 'Action inconnue';
  end if;
  update jdr.campaigns set turn = t where id = p_campaign;
  return t;
end $$;
revoke execute on function jdr.turn_player(uuid, uuid, text) from public, anon;
grant execute on function jdr.turn_player(uuid, uuid, text) to authenticated;
