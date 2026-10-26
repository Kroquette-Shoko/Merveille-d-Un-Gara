-- jdr-015 : DECK DES RISQUES de la campagne (40 cartes par défaut)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
--
-- Une ligne par campagne :
--   cards       : [ id de carte… ] cartes restantes, déjà mélangées (la 1re est celle du dessus)
--   composition : { id de carte : nombre }  composition du deck (pour le régénérer)
-- Les joueurs NE LISENT PAS cette table (ils ne doivent pas savoir combien de cartes il reste) : seul le MJ la voit.
-- Tirer des Risques passe par jdr.risk_take(campagne, nombre) : MJ et joueurs de la campagne ;
--   si le deck est vide (ou se vide en cours de tirage), il est régénéré automatiquement avec sa composition et remélangé.
-- Les cartes tirées partent dans les piles du personnage (jdr.play_states) côté navigateur ; elles ne reviennent pas
-- dans le deck des Risques (un repos les retire du deck du personnage).

create table jdr.risk_decks (
  campaign_id uuid primary key references jdr.campaigns(id) on delete cascade,
  cards       jsonb not null default '[]'::jsonb,
  composition jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
comment on table jdr.risk_decks is 'JDR : deck des Risques de la campagne (cartes restantes + composition). MJ seulement ; tirage par jdr.risk_take.';
create trigger risk_decks_touch before update on jdr.risk_decks for each row execute function jdr.touch_updated_at();

alter table jdr.risk_decks enable row level security;
create policy risk_decks_gm on jdr.risk_decks for all to authenticated using (jdr.is_gm(campaign_id)) with check (jdr.is_gm(campaign_id));
grant select, insert, update, delete on jdr.risk_decks to authenticated;

-- Composition par défaut (26/10/2026) : 40 cartes
create function jdr.risk_default() returns jsonb language sql immutable set search_path = '' as $$
  select '{"reussite_critique":2,"parade_parfaite":2,"guerison_surnaturel":2,"a_bout_de_souffle":3,"attirer_l_attention":2,
           "totalement_insignifiant":2,"un_truc_dans_l_oeil":2,"se_tordre_la_cheville":2,"se_decourager":3,"porter_la_poisse":3,
           "perte_d_energie":2,"perdre_la_main":2,"magie_sauvage":3,"main_glissante":2,"mauvaise_posture":2,"echec_critique":3,
           "deconcentration":3}'::jsonb;
$$;

-- Deck mélangé à partir d'une composition (seulement les cartes qui existent encore)
create function jdr.risk_build(p_comp jsonb) returns jsonb language sql volatile set search_path = '' as $$
  select coalesce(jsonb_agg(x.id order by random()), '[]'::jsonb)
  from (select e.key as id from jsonb_each_text(p_comp) e
          cross join lateral generate_series(1, greatest(0, least(50, coalesce(nullif(e.value, '')::int, 0))))
        where exists (select 1 from jdr.cards c where c.id = e.key)) x;
$$;

create function jdr.risk_take(p_campaign uuid, p_n int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d record; deck jsonb; comp jsonb; taken jsonb := '[]'::jsonb; i int; regen int := 0;
begin
  if not (jdr.is_gm(p_campaign) or jdr.is_member(p_campaign)) then raise exception 'Partie introuvable'; end if;
  if p_n is null or p_n < 1 or p_n > 40 then raise exception 'Nombre de Risques invalide'; end if;
  select * into d from jdr.risk_decks where campaign_id = p_campaign for update;
  if d is null then
    comp := jdr.risk_default();
    insert into jdr.risk_decks(campaign_id, cards, composition) values (p_campaign, jdr.risk_build(comp), comp);
    select * into d from jdr.risk_decks where campaign_id = p_campaign for update;
  end if;
  deck := d.cards; comp := d.composition;
  for i in 1..p_n loop
    if jsonb_array_length(deck) = 0 then
      deck := jdr.risk_build(comp); regen := regen + 1;
      if jsonb_array_length(deck) = 0 then exit; end if;      -- composition vide
    end if;
    taken := taken || jsonb_build_array(deck->0);
    deck := deck - 0;
  end loop;
  update jdr.risk_decks set cards = deck where campaign_id = p_campaign;
  return jsonb_build_object('cards', taken, 'regenerated', regen);   -- le nombre restant n'est PAS renvoyé
end $$;
revoke execute on function jdr.risk_take(uuid, int) from public, anon;
grant execute on function jdr.risk_take(uuid, int) to authenticated;
revoke execute on function jdr.risk_build(jsonb) from public, anon;
grant execute on function jdr.risk_build(jsonb) to authenticated;
