-- jdr-005 : mots-clés et capacités des cartes (schéma jdr uniquement — rien dans public)
-- Un mot-clé = un nom + une catégorie + une définition courte.
--   catégories : 'Mécanique', 'Super-type', 'Affliction', 'Propriété'
--   data = { category, text, hasValue }
--   hasValue = le mot-clé prend une valeur sur la carte (ex. « Explorer X » → « Explorer 2 »).
-- Les mots-clés de catégorie « Super-type » portent le même nom qu'un super-type des cartes :
-- leur définition s'affiche automatiquement sur les cartes qui ont ce super-type.
-- Sur une carte : data.keywords = [{ id, name, value }].
-- Droits : tout compte connecté lit ; seul l'éditeur crée / modifie / supprime (comme jdr.cards).
-- Liste de départ : définitions validées par Kroquette le 23/10/2026.

create table jdr.keywords (
  id          text primary key check (id ~ '^[a-z0-9_-]{2,64}$'),
  name        text not null check (char_length(name) between 1 and 60),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table jdr.keywords is 'JDR : mots-clés des cartes. data = { category, text, hasValue }.';

create trigger keywords_touch before update on jdr.keywords
for each row execute function jdr.touch_updated_at();

alter table jdr.keywords enable row level security;
create policy keywords_select on jdr.keywords for select to authenticated using (true);
create policy keywords_insert on jdr.keywords for insert to authenticated with check (jdr.is_editor());
create policy keywords_update on jdr.keywords for update to authenticated using (jdr.is_editor()) with check (jdr.is_editor());
create policy keywords_delete on jdr.keywords for delete to authenticated using (jdr.is_editor());

grant select, insert, update, delete on jdr.keywords to authenticated;

insert into jdr.keywords (id, name, data) values
-- Mécaniques
('persistant',      'Persistant',        '{"category":"Mécanique","hasValue":false,"text":"Une fois jouée, la carte ne va pas en défausse tant que sa condition est valide."}'),
('bannir',          'Bannir',            '{"category":"Mécanique","hasValue":false,"text":"Retirer une carte du deck jusqu''au prochain repos."}'),
('explorer',        'Explorer X',        '{"category":"Mécanique","hasValue":true,"text":"Mettre les X cartes du dessus du deck dans la défausse."}'),
('suivre-la-piste', 'Suivre la piste',   '{"category":"Mécanique","hasValue":false,"text":"Remettre cette carte sous son deck pour résoudre son effet de piste."}'),
('concentration',   'Concentration',     '{"category":"Mécanique","hasValue":false,"text":"Limitation : on ne peut pas jouer plusieurs sorts à concentration en même temps. Empêche certaines actions et demande d''être conscient."}'),
('refrain',         'Refrain',           '{"category":"Mécanique","hasValue":false,"text":"Permet de rejouer gratuitement une carte redite au début de son tour."}'),
('tenace',          'Tenace (X)',        '{"category":"Mécanique","hasValue":true,"text":"Les blessures du type de dégâts indiqué sont réduites d''un niveau."}'),
('formation',       'Formation',         '{"category":"Mécanique","hasValue":false,"text":"Coordonne les alliés proches. Tant que vous restez dans la formation, vous gagnez ses bonus ; si vous la quittez, il faut rejouer la carte pour la rejoindre."}'),
('mana-instable',   'Mana instable',     '{"category":"Mécanique","hasValue":false,"text":"Quand vous convertissez un sort en mana, un effet secondaire aléatoire se déclenche : bonus, malus ou cartes Risque."}'),
-- Super-types (même nom que les super-types des cartes)
('posture',         'Posture',           '{"category":"Super-type","hasValue":false,"text":"Carte persistante qui donne un bonus particulier. Peut s''activer depuis le deck dès la fin d''un repos. Une seule posture à la fois."}'),
('malediction',     'Malédiction',       '{"category":"Super-type","hasValue":false,"text":"Se joue sur une cible comme carte persistante. Les malédictions sont partagées entre toutes les créatures maudites."}'),
('aura',            'Aura',              '{"category":"Super-type","hasValue":false,"text":"Effet de zone proche du lanceur."}'),
('rage',            'Rage',              '{"category":"Super-type","hasValue":false,"text":"Donne un pouvoir tant que vous êtes enragé."}'),
('chanson',         'Chanson',           '{"category":"Super-type","hasValue":false,"text":"Carte avec le Refrain."}'),
('frappe',          'Frappe',            '{"category":"Super-type","hasValue":false,"text":"Carte qui utilise une ressource spéciale."}'),
('piege',           'Piège',             '{"category":"Super-type","hasValue":false,"text":"Type de carte."}'),
('piste',           'Piste',             '{"category":"Super-type","hasValue":false,"text":"Carte qui a un effet de piste (voir Suivre la piste)."}'),
('poison',          'Poison',            '{"category":"Super-type","hasValue":false,"text":"Effet à appliquer sur une arme."}'),
('arcane',          'Arcane',            '{"category":"Super-type","hasValue":false,"text":"Carte qui a des effets de mana instable."}'),
('feu',             'Feu',               '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('air',             'Air',               '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('eau',             'Eau',               '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('terre',           'Terre',             '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('eclosion',        'Éclosion',          '{"category":"Super-type","hasValue":false,"text":"Mot-clé qui sert de déclencheur à un compagnon."}'),
('enchantement',    'Enchantement',      '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('illusion',        'Illusion',          '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('transmutation',   'Transmutation',     '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('reaction',        'Réaction',          '{"category":"Super-type","hasValue":false,"text":"Se joue en réaction."}'),
('evocation',       'Évocation',         '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('divination',      'Divination',        '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
('invocation',      'Invocation',        '{"category":"Super-type","hasValue":false,"text":"Étiquette sans règle propre : d''autres cartes peuvent l''appeler."}'),
-- Afflictions
('enrage',          'Enragé',            '{"category":"Affliction","hasValue":false,"text":"Tous les pouvoirs de Rage sont actifs et chaque action est risquée, jusqu''à la fin du prochain tour."}'),
('etourdi',         'Étourdi',           '{"category":"Affliction","hasValue":false,"text":"État qui bloque certaines actions (à préciser)."}'),
('ralenti',         'Ralenti',           '{"category":"Affliction","hasValue":false,"text":"État qui bloque certaines actions (à préciser)."}'),
('deconcentre',     'Déconcentré',       '{"category":"Affliction","hasValue":false,"text":"État qui bloque certaines actions (à préciser)."}'),
('entrave',         'Entravé',           '{"category":"Affliction","hasValue":false,"text":"État qui bloque certaines actions (à préciser)."}'),
('saignement',      'Saignement',        '{"category":"Affliction","hasValue":false,"text":"La cible subit une blessure légère à chaque tour."}'),
('hemorragie',      'Hémorragie',        '{"category":"Affliction","hasValue":false,"text":"Saignement plus fort : la cible subit une blessure (3 cases) à chaque tour."}'),
('brise',           'Brisé',             '{"category":"Affliction","hasValue":false,"text":"Armure détruite."}'),
('immobilise',      'Immobilisé',        '{"category":"Affliction","hasValue":false,"text":"Ne peut plus bouger."}'),
('empoisonne',      'Empoisonné',        '{"category":"Affliction","hasValue":false,"text":"La cible subit une blessure légère à chaque tour pendant la durée indiquée."}'),
-- Propriétés d'armes et d'armures
('legere',          'Légère',            '{"category":"Propriété","hasValue":false,"text":"Vous pouvez équiper deux armes légères. Quand vous attaquez avec l''une, vous pouvez faire gratuitement l''attaque principale de l''autre."}'),
('lourde',          'Lourde',            '{"category":"Propriété","hasValue":false,"text":"Vous ne pouvez faire qu''une attaque avec une arme de ce type."}'),
('deux-mains',      'À deux mains',      '{"category":"Propriété","hasValue":false,"text":"Ne peut pas être maniée avec un objet dans l''autre main. Impossible de lancer des sorts à composante gestuelle."}'),
('polyvalente',     'Polyvalente (+X)',  '{"category":"Propriété","hasValue":true,"text":"Se manie à une ou deux mains. À deux mains, le malus « À deux mains » s''applique et vous gagnez +X aux dégâts."}'),
('lancer',          'Lancer',            '{"category":"Propriété","hasValue":false,"text":"L''arme est lancée à la portée indiquée, puis tombe au sol près de la cible."}'),
('bruyant',         'Bruyant',           '{"category":"Propriété","hasValue":false,"text":"Lors d''un test de discrétion, votre Corps et la valeur des cartes défaussées sont divisés par deux (arrondi à l''inférieur)."}'),
('encombrant',      'Encombrant',        '{"category":"Propriété","hasValue":false,"text":"Lors d''un test d''escalade ou d''acrobatie, votre Corps et la valeur des cartes défaussées sont divisés par deux (arrondi à l''inférieur)."}');
