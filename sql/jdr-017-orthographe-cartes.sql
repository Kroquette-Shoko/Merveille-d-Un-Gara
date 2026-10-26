-- jdr-017 : corrections d'orthographe et de grammaire des cartes déjà créées (26/10/2026)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël). Données seulement.
-- Chaque règle remplace un bout de texte précis dans un champ d'une carte (id '*' = toutes les cartes).
-- Si le texte a déjà été changé entre-temps, la règle ne fait rien. Les identifiants des cartes ne changent pas.
drop table if exists pg_temp.ortho_rules, pg_temp.ortho_report;
create temp table ortho_rules(n int, card text, path text[], find text, repl text);
create temp table ortho_report(n int, cards int);
insert into ortho_rules values
(0,$q$*$q$,'{special,text}'::text[],$q$ou a la prochaine fin$q$,$q$ou à la prochaine fin$q$),
(1,$q$*$q$,'{special,text}'::text[],$q$vous pouvez sortir de votre deck cette carte et l’utilisez immédiatement$q$,$q$vous pouvez sortir cette carte de votre deck et l’utiliser immédiatement$q$),
(2,$q$*$q$,'{special,text}'::text[],$q$Il existe d’autre cartes d’actions qui le permettent aussi ou$q$,$q$Il existe d’autres cartes d’action qui le permettent aussi, ou$q$),
(3,$q$*$q$,'{special,text}'::text[],$q$Il existe d’autre cartes qui le permettent aussi ou$q$,$q$Il existe d’autres cartes qui le permettent aussi, ou$q$),
(4,$q$*$q$,'{special,effects,0,text}'::text[],$q$Il existe d’autre cartes d’actions qui le permettent aussi ou$q$,$q$Il existe d’autres cartes d’action qui le permettent aussi, ou$q$),
(5,$q$*$q$,'{special,effects,0,text}'::text[],$q$Il existe d’autre cartes qui le permettent aussi ou$q$,$q$Il existe d’autres cartes qui le permettent aussi, ou$q$),
(6,$q$*$q$,'{abilities,0,text}'::text[],$q$ ce tour ci$q$,$q$ ce tour-ci$q$),
(7,$q$*$q$,'{abilities,0,text}'::text[],$q$est pioché,$q$,$q$est piochée,$q$),
(8,$q$*$q$,'{abilities,0,text}'::text[],$q$dans votre mains$q$,$q$dans votre main$q$),
(9,$q$*$q$,'{abilities,0,text}'::text[],$q$l’effet suivant:$q$,$q$l’effet suivant :$q$),
(10,$q$*$q$,'{abilities,0,effects,0,text}'::text[],$q$ ce tour ci$q$,$q$ ce tour-ci$q$),
(11,$q$*$q$,'{abilities,0,effects,0,text}'::text[],$q$est pioché,$q$,$q$est piochée,$q$),
(12,$q$*$q$,'{abilities,0,effects,0,text}'::text[],$q$dans votre mains$q$,$q$dans votre main$q$),
(13,$q$*$q$,'{abilities,0,effects,0,text}'::text[],$q$l’effet suivant:$q$,$q$l’effet suivant :$q$),
(14,$q$a_bout_de_souffle$q$,'{name}'::text[],$q$A bout de souffle$q$,$q$À bout de souffle$q$),
(15,$q$echec_critique$q$,'{name}'::text[],$q$Echec critique$q$,$q$Échec critique$q$),
(16,$q$foie_aveugle$q$,'{name}'::text[],$q$Foie aveugle$q$,$q$Foi aveugle$q$),
(17,$q$fureur_de_temeraire$q$,'{name}'::text[],$q$Fureur de téméraire$q$,$q$Fureur du téméraire$q$),
(18,$q$guerison_surnaturel$q$,'{name}'::text[],$q$Guérison surnaturel$q$,$q$Guérison surnaturelle$q$),
(19,$q$passez_inapercu$q$,'{name}'::text[],$q$Passez inaperçu$q$,$q$Passer inaperçu$q$),
(20,$q$reussite_critique$q$,'{name}'::text[],$q$Réussite critique!$q$,$q$Réussite critique !$q$),
(21,$q$un_truc_dans_l_oeil$q$,'{name}'::text[],$q$Un truc dans l’oeil$q$,$q$Un truc dans l’œil$q$),
(22,$q$voie_de_la_maitrise_astral$q$,'{name}'::text[],$q$Voie de la maitrise astral$q$,$q$Voie de la maîtrise astrale$q$),
(23,$q$voie_du_maitre_sse_d_arme$q$,'{name}'::text[],$q$Voie du maitre.sse d'arme$q$,$q$Voie du maître.sse d'armes$q$),
(24,$q$attaque_inconsideree$q$,'{abilities,0,text}'::text[],$q$ajouter, a votre attaque, votre valeur de Corps en blessure légère$q$,$q$ajouter, à votre attaque, votre valeur de Corps en blessures légères$q$),
(25,$q$attaque_inconsideree$q$,'{special,text}'::text[],$q$Point règle:  Cette carte$q$,$q$Point de règle : cette carte$q$),
(26,$q$attaquer_c$q$,'{abilities,0,text}'::text[],$q$besoin de vous défaussez de carte pour les attaques secondaire et tertiaire$q$,$q$besoin de vous défausser de cartes pour les attaques secondaires et tertiaires$q$),
(27,$q$attaquer_copie$q$,'{abilities,0,text}'::text[],$q$Opposez vous$q$,$q$Opposez-vous$q$),
(28,$q$attirer_l_attention$q$,'{abilities,0,text}'::text[],$q$tous vos adversaire proche vous$q$,$q$tous vos adversaires proches vous$q$),
(29,$q$attirer_l_attention$q$,'{abilities,0,text}'::text[],$q$toutes personne dans$q$,$q$toute personne dans$q$),
(30,$q$bloquer$q$,'{abilities,0,text}'::text[],$q$au corps à corps. Vous pouvez bloquer la moitié des dégâts (arrondit au supérieur)$q$,$q$au corps à corps, vous pouvez bloquer la moitié des dégâts (arrondie au supérieur)$q$),
(31,$q$chasseur_se$q$,'{abilities,0,text}'::text[],$q$compagnon animale$q$,$q$compagnon animal$q$),
(32,$q$desarmer$q$,'{abilities,0,text}'::text[],$q$vous pouvez annulé les dégâts$q$,$q$vous pouvez annuler les dégâts$q$),
(33,$q$desarmer$q$,'{special,text}'::text[],$q$Désarmé: Une cible désarmé ne peux pas faire d’attaque avec une arme a son prochains tour$q$,$q$Désarmé : une cible désarmée ne peut pas faire d’attaque avec une arme à son prochain tour$q$),
(34,$q$provocation$q$,'{special,text}'::text[],$q$Désarmé: Une cible désarmé ne peux pas faire d’attaque avec une arme a son prochains tour$q$,$q$Désarmé : une cible désarmée ne peut pas faire d’attaque avec une arme à son prochain tour$q$),
(35,$q$donner_de_l_inspiration$q$,'{special,text}'::text[],$q$Point règle:  Une fois une chanson jouée, si elle n’était pas redite mettez la de coté, elle devient redite. Au début de votre prochain tour après la pioche, Vous pouvez$q$,$q$Point de règle : une fois une chanson jouée, si elle n’était pas redite, mettez-la de côté : elle devient redite. Au début de votre prochain tour, après la pioche, vous pouvez$q$),
(36,$q$echec_critique$q$,'{abilities,0,text}'::text[],$q$donnez la a votre MJ$q$,$q$donnez-la à votre MJ$q$),
(37,$q$echec_critique$q$,'{abilities,0,text}'::text[],$q$à votre avantage dans circonstance bien évidement arrangeante pour vous$q$,$q$à votre avantage, dans une circonstance bien évidemment arrangeante pour vous$q$),
(38,$q$esquiver$q$,'{abilities,0,effects,0,text}'::text[],$q$ou par un projectile. Vous pouvez éviter$q$,$q$ou par un projectile, vous pouvez éviter$q$),
(39,$q$faire_face_au_danger$q$,'{abilities,0,text}'::text[],$q$Retirer toutes affliction de mouvement ou de peur qui vous affecte.$q$,$q$Retirez toutes les afflictions de mouvement ou de peur qui vous affectent.$q$),
(40,$q$feinte$q$,'{abilities,0,text}'::text[],$q$Opposez vous$q$,$q$Opposez-vous$q$),
(41,$q$feinte$q$,'{abilities,0,text}'::text[],$q$elle est déstabilisé$q$,$q$elle est déstabilisée$q$),
(42,$q$feinte$q$,'{special,text}'::text[],$q$Une cible déstabilisé ne peux pas$q$,$q$Une cible déstabilisée ne peut pas$q$),
(43,$q$feinte$q$,'{special,text}'::text[],$q$persuader ou berner$q$,$q$persuader ou berner.$q$),
(44,$q$foncer$q$,'{abilities,0,effects,0,text}'::text[],$q$vous déplacez au double$q$,$q$vous déplacer au double$q$),
(45,$q$fureur_de_l_ours$q$,'{abilities,0,text}'::text[],$q$tenace au dégâts contondant, perforant et tranchant non magique$q$,$q$tenace aux dégâts contondants, perforants et tranchants non magiques$q$),
(46,$q$fureur_de_temeraire$q$,'{abilities,0,text}'::text[],$q$en opportunisme une valeur égale au nombre de blessure que vous avez arrondi à l’inférieur$q$,$q$en Opportunisme une valeur égale au nombre de blessures que vous avez, arrondie à l’inférieur$q$),
(47,$q$guerison_surnaturel$q$,'{abilities,0,text}'::text[],$q$sont soignée de toutes les afflictions qui les affecte$q$,$q$êtes soignés de toutes les afflictions qui vous affectent$q$),
(48,$q$main_glissante$q$,'{abilities,0,text}'::text[],$q$il peux se briser$q$,$q$il peut se briser$q$),
(49,$q$mauvaise_posture$q$,'{abilities,0,text}'::text[],$q$qui coûtes 1 point$q$,$q$qui coûtent 1 point$q$),
(50,$q$ne_compter_que_sur_soi$q$,'{abilities,0,text}'::text[],$q$et que cela échoue. Vous pouvez$q$,$q$et que cela échoue, vous pouvez$q$),
(51,$q$parade_parfaite$q$,'{abilities,0,text}'::text[],$q$au corps à corps. Vous pouvez annuler$q$,$q$au corps à corps, vous pouvez annuler$q$),
(52,$q$parade_parfaite$q$,'{abilities,0,text}'::text[],$q$Si il l’attaque peut toucher une autre créature, vous pouvez la redirigez sur celle ci$q$,$q$Si l’attaque peut toucher une autre créature, vous pouvez la rediriger sur celle-ci$q$),
(53,$q$perdre_la_main$q$,'{abilities,0,text}'::text[],$q$défaussez vous$q$,$q$défaussez-vous$q$),
(54,$q$perte_d_energie$q$,'{abilities,0,text}'::text[],$q$défaussez vous$q$,$q$défaussez-vous$q$),
(55,$q$porter_la_poisse$q$,'{abilities,0,text}'::text[],$q$tous les alliés proche de vous$q$,$q$tous les alliés proches de vous$q$),
(56,$q$posture_d_archer$q$,'{abilities,0,text}'::text[],$q$ne sont jamais risqué.$q$,$q$ne sont jamais risquées.$q$),
(57,$q$posture_defensive$q$,'{abilities,0,text}'::text[],$q$corps a corps ne sont jamais risqué.$q$,$q$corps à corps ne sont jamais risquées.$q$),
(58,$q$posture_offensive$q$,'{abilities,0,text}'::text[],$q$au blessure de vos attaques$q$,$q$aux blessures de vos attaques$q$),
(59,$q$provocation$q$,'{abilities,0,text}'::text[],$q$proche de vous, Jusqu’à$q$,$q$proche de vous. Jusqu’à$q$),
(60,$q$reussite_critique$q$,'{abilities,0,text}'::text[],$q$doublez ce nombre de blessure.$q$,$q$doublez ce nombre de blessures.$q$),
(61,$q$reussite_critique$q$,'{abilities,0,text}'::text[],$q$pour un test ou vous opposez a la résistance d’un adversaire, vous réussissez forcement$q$,$q$pour un test ou pour vous opposer à la résistance d’un adversaire, vous réussissez forcément$q$),
(62,$q$sauvagerie$q$,'{abilities,0,text}'::text[],$q$ajoutez une blessures légère pour chaque risque défaussées$q$,$q$ajoutez une blessure légère pour chaque risque défaussé$q$),
(63,$q$se_concentrer$q$,'{abilities,0,effects,0,text}'::text[],$q$gagner 2 point de mana$q$,$q$gagner 2 points de mana$q$),
(64,$q$se_concentrer$q$,'{special,effects,0,text}'::text[],$q$Point règle: Convertir$q$,$q$Point de règle : convertir$q$),
(65,$q$se_decourager$q$,'{abilities,0,text}'::text[],$q$Charme passe à 0$q$,$q$Charme passent à 0$q$),
(66,$q$se_tordre_la_cheville$q$,'{abilities,0,text}'::text[],$q$votre vitesse est réduites de moitié$q$,$q$votre vitesse est réduite de moitié$q$),
(67,$q$tir_puissant$q$,'{abilities,0,text}'::text[],$q$ajouter, a votre attaque, le nombre de carte que vous avez mis en défausse ce tour-ci en blessure légère$q$,$q$ajouter, à votre attaque, le nombre de cartes que vous avez mises en défausse ce tour-ci en blessures légères$q$),
(68,$q$triomphons_ensemble$q$,'{special,name}'::text[],$q$Point règles$q$,$q$Point de règle$q$),
(69,$q$triomphons_ensemble$q$,'{special,text}'::text[],$q$Aura: Les aura sont des cartes qui persistent jusqu'à la fin de leur effet. Elle affecte toutes les personnes indiqué$q$,$q$Aura : les auras sont des cartes qui persistent jusqu'à la fin de leur effet. Elles affectent toutes les personnes indiquées$q$),
(70,$q$voie_de_l_ecaille_de_chene$q$,'{abilities,0,text}'::text[],$q$Vous pouvez fusionnez avec votre compagnon prenant une forme hybride. Cette nouvelle forme vous octrois de nouvelles capacité et compétence.$q$,$q$Vous pouvez fusionner avec votre compagnon en prenant une forme hybride. Cette nouvelle forme vous octroie de nouvelles capacités et compétences.$q$),
(71,$q$voie_de_l_ecaille_de_chene$q$,'{abilities,0,text}'::text[],$q$vos points de vie et vos points armures (physique et magique) actuelle et vos statistiques$q$,$q$vos points de vie, vos points d’armure (physique et magique) actuels et vos statistiques$q$),
(72,$q$voie_de_l_ecaille_de_chene$q$,'{special,text}'::text[],$q$Etre au contact$q$,$q$Être au contact$q$),
(73,$q$voie_de_l_ivresse$q$,'{abilities,0,text}'::text[],$q$Vous avez une réaction supplémentaire
$q$,$q$Vous avez une réaction supplémentaire.
$q$),
(74,$q$voie_de_l_ivresse$q$,'{abilities,0,text}'::text[],$q$à la fin de vos tour et$q$,$q$à la fin de vos tours et$q$),
(75,$q$voie_de_l_ivresse$q$,'{abilities,0,text}'::text[],$q$Vous pouvez attaquez en réaction a une attaque$q$,$q$Vous pouvez attaquer en réaction à une attaque$q$),
(76,$q$voie_de_l_oracle$q$,'{abilities,0,text}'::text[],$q$résolvez a chaque tour vous donne 1 points de mana$q$,$q$résolvez à chaque tour vous donne 1 point de mana$q$),
(77,$q$voie_de_l_oracle$q$,'{abilities,0,text}'::text[],$q$au dessous de leur deck$q$,$q$au-dessous de leur deck$q$),
(78,$q$voie_du_berserker$q$,'{abilities,0,text}'::text[],$q$ajoutez au dégâts un nombre de blessure légère égale au nombre de blessure que vous avez$q$,$q$ajoutez aux dégâts un nombre de blessures légères égal au nombre de blessures que vous avez$q$),
(79,$q$voie_du_corsaire$q$,'{abilities,0,text}'::text[],$q$Lorsqu'un alliée proche de vous se défausse d'une carte pour utilisez une capacité d'arme. Si c'est une manœuvres vous pouvez$q$,$q$Lorsqu'un allié proche de vous se défausse d'une carte pour utiliser une capacité d'arme, si c'est une manœuvre, vous pouvez$q$),
(80,$q$voie_du_corsaire$q$,'{abilities,0,text}'::text[],$q$ajoutez +1 a vos statistiques$q$,$q$ajoutez +1 à vos statistiques$q$),
(81,$q$voie_du_fantome$q$,'{abilities,0,text}'::text[],$q$Frapper dans le dos de vos adversaires dans le dos vous donnent des fragments$q$,$q$Frapper vos adversaires dans le dos vous donne des fragments$q$),
(82,$q$voie_du_fantome$q$,'{abilities,0,text}'::text[],$q$au moins 5  fragments$q$,$q$au moins 5 fragments$q$),
(83,$q$voie_du_fantome$q$,'{abilities,0,text}'::text[],$q$Les fragments d'âme se libère au bout$q$,$q$Les fragments d'âme se libèrent au bout$q$),
(84,$q$voie_du_sacrifice$q$,'{abilities,0,text}'::text[],$q$en subissant autant de Blessures$q$,$q$en subissant autant de blessures$q$),
(85,$q$voie_du_sang$q$,'{abilities,0,text}'::text[],$q$Les blessures au dégâts tranchants que vous infligez vous font gagnez$q$,$q$Les blessures par dégâts tranchants que vous infligez vous font gagner$q$),
(86,$q$voie_du_sang$q$,'{abilities,0,text}'::text[],$q$Vous pouvez utilisez vos points de sang à la place du mana pour lancez vos sorts$q$,$q$Vous pouvez utiliser vos points de sang à la place du mana pour lancer vos sorts$q$),
(87,$q$voie_du_scalde$q$,'{abilities,0,text}'::text[],$q$les effets des chansons redite se rejoue sans$q$,$q$les effets des chansons redites se rejouent sans$q$),
(88,$q$voie_du_signataire$q$,'{abilities,0,text}'::text[],$q$Choisissez un pacte parmis:
-  Pacte de la tombe
- Pacte des horreurs
• Pacte des ombres$q$,$q$Choisissez un pacte parmi :
• Pacte de la tombe
• Pacte des horreurs
• Pacte des ombres$q$),
(89,$q$voie_du_signataire$q$,'{abilities,0,text}'::text[],$q$vous pouvez : Défausser$q$,$q$vous pouvez : défausser$q$),
(90,$q$voie_du_tisse_ronce$q$,'{abilities,0,text}'::text[],$q$5 graines magique.$q$,$q$5 graines magiques.$q$),
(91,$q$voie_du_tisse_ronce$q$,'{abilities,0,text}'::text[],$q$vous jouez une sortilège$q$,$q$vous jouez un sortilège$q$),
(92,$q$voie_du_tisse_ronce$q$,'{abilities,0,text}'::text[],$q$en plus des normaux$q$,$q$en plus des composants normaux$q$),
(93,$q$voie_du_tisse_ronce$q$,'{abilities,0,text}'::text[],$q$devient alors entravé jusqu$q$,$q$devient alors entravée jusqu$q$),
(94,$q$voie_du_tueur_de_mage$q$,'{abilities,0,text}'::text[],$q$Lorsqu’un alliée ou$q$,$q$Lorsqu’un allié ou$q$),
(95,$q$voie_du_tueur_de_mage$q$,'{abilities,0,text}'::text[],$q$adversaire veux passer$q$,$q$adversaire veut passer$q$),
(96,$q$voleur$q$,'{abilities,0,text}'::text[],$q$ajoutez dans votre main$q$,$q$Ajoutez dans votre main$q$);
do $do$
declare r record; k int;
begin
  for r in select * from ortho_rules order by n loop
    if r.path = '{name}' then
      update jdr.cards set name = replace(name, r.find, r.repl),
             data = jsonb_set(data, '{name}', to_jsonb(replace(coalesce(data->>'name', name), r.find, r.repl)))
       where (r.card = '*' or id = r.card) and strpos(name, r.find) > 0;
    else
      update jdr.cards set data = jsonb_set(data, r.path, to_jsonb(replace(data#>>r.path, r.find, r.repl)))
       where (r.card = '*' or id = r.card) and strpos(data#>>r.path, r.find) > 0;
    end if;
    get diagnostics k = row_count;
    insert into ortho_report values (r.n, k);
  end loop;
end $do$;
select string_agg(n||':'||cards, ' ' order by n) filter (where cards <> 1) as anomalies, sum(cards) total from ortho_report;
