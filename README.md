# Merveille d'Un'Gara

Jeu de rôle (JDR) en ligne avec un système de deckbuilding, dans l'univers d'Un'Gara (le même que *Rimd'Orël*).

## Principe

- Un **MJ** dirige la partie et gère les adversaires (fiches de créatures).
- Chaque joueur a une **fiche de personnage** et un **deck de cartes**.
- Les cartes servent à **toutes les actions**, en combat et hors combat.
- Le plateau est une **grille avec des pions**, déplaçables librement.
- Ressources prévues : mana, points d'action, énergie, surcharge, blessures, armure, armure magique… (liste extensible).

## Technique

| Élément | Choix |
|---|---|
| Interface | Web : HTML / CSS / JavaScript |
| Serveur | Supabase, **même projet que Rimd'Orël**, isolé dans le schéma `jdr` |
| Comptes | Communs avec Rimd'Orël |

## Navigation (26/10/2026)
Le menu n'a que 2 entrées, avec des onglets secondaires selon l'espace (réglés dans `JDR_SECTIONS`, `js/jdr-ui.js`) :
- **Joueur** : Mes personnages · Créer un personnage · Rejoindre une partie (la fiche et le deck en font partie)
- **Maître du jeu** : *Parties* (Héberger et gérer) · *Éditeur* (Cartes, Bestiaire, Actions de groupe, Équipement, Origines, Mots-clés, Bibliothèque)

## Contenu du dépôt

| Chemin | Rôle |
|---|---|
| `index.html` | Page d'accueil : 2 choix, **Joueur** ou **Maître du jeu** |
| `joueur.html` | Espace joueur : mes personnages (ouvrir la fiche), créer un personnage (assistant guidé), rejoindre une partie avec le code du MJ |
| `mj.html` | Espace maître du jeu : **Parties** (héberger et gérer une campagne) et **Éditeur** (cartes, bestiaire, actions de groupe, équipement, origines, mots-clés, bibliothèque — compte éditeur) |
| `connexion.html` | Connexion (compte commun avec Rimd'Orël) |
| `creation-personnage.html` | Assistant de création en 8 étapes (peuple, classe, spécialisation, passé, équipement de base, informations, résumé, deck) : choix à gauche, tableau des caractéristiques au centre, informations et illustration à droite. Enregistre le personnage en ligne puis ouvre la construction du deck |
| `fiche-personnage.html` | Fiche de personnage (modèle « parchemin ») : portrait entouré des caractéristiques, blessures en 5 paliers de 6 cases, armures, ressources, armes, armure et bouclier, inventaire avec charge. Sauvegarde dans le navigateur, ou en ligne une fois connecté ; rejoindre une campagne ; lien vers le deck ; affiche les effets du deck sur les caractéristiques |
| `deck.html` | Construction du deck, ouverte **depuis le bouton « Deck » de la fiche** (`deck.html?character=…`) (navigation reprise du deckbuilder de Rimd'Orël) : onglets des types de cartes et coût en mana en haut, filtres secondaires à gauche (sous-type, super-types, mot-clé, rang), classeur paginé au centre (clic gauche ajouter, clic droit agrandir), deck à droite (compteur, courbe de mana, liste / détails). Seules les cartes jouables par le personnage sont proposées |
| `bibliotheque.html` | Toutes les cartes avec filtres |
| `editeur-cartes.html` | Création / modification des cartes (réservé au compte éditeur). `editeur-cartes.html?type=Créature` = **Bestiaire** (seulement les créatures, formulaire et fiche paysage dédiés) |
| `editeur-groupes.html` | Tableaux d'action de groupe des créatures, attribués ensuite aux créatures (réservé au compte éditeur) |
| `mots-cles.html` | Liste des mots-clés (mécaniques, super-types, afflictions, propriétés) avec leur définition. Tout le monde lit ; le compte éditeur ajoute / modifie / supprime. Les mots-clés s'ajoutent aux cartes dans l'éditeur de cartes |
| `equipement.html` | Équipement : armes, armures, boucliers, objets magiques (emplacement, rareté, bonus, pouvoirs) et objets divers (catégorie, consommable, effet), avec aperçu de la fiche d'objet. Tout le monde consulte ; le compte éditeur modifie |
| `js/jdr-items.js` | Modèle et affichage de l'équipement (table `jdr.items`) |
| `origines.html` | Origines du personnage, avec image : peuples (famille, taille, bonus de caractéristiques et d'armure, capacités), classes (couleur, accès à la magie, caractéristiques, capacités, spécialisations cochées, évolution sur 15 niveaux), spécialisations (carte de voie, magie, passif de base, améliorations), passés (caractéristiques, carte de passé, événements possibles) |
| `js/jdr-origins.js` | Modèle et affichage des origines (table `jdr.origins`) |
| `plateau.html` | **Plateau de jeu** (`plateau.html?campagne=…`), disposition de table virtuelle : plateau plein écran ; barre d'outils à gauche (sélection, couche active, mesure, ping, échelle, zoom, images, aide) ; bandeau des scènes en haut pour le MJ (marqueur « JOUEURS » = scène vue par les joueurs) ; barre latérale à onglets (Discussion enregistrée, Images de la campagne à glisser sur la carte, Journal des personnages, Musique, Réglages) ; joueurs connectés en bas à gauche ; clic droit = menu de l'élément, double-clic = réglages du pion ; poignées de taille et de rotation. 3 couches (carte, pions, MJ cachée — jamais envoyée aux joueurs), temps réel, mesure en mètres (sans grille, échelle étalonnable), ping (Alt + clic), cercles de portée au survol de ses pions ; **scènes** (MJ) : glisser pour ranger, double-clic sur le nom pour renommer, ⧉ dupliquer (carte et pions), marqueur JOUEURS à glisser pour emmener le groupe, pastille d'un joueur à glisser pour l'envoyer seul sur une scène, « Rassembler tout le monde » ; **journal** : dossiers, recherche, PNJ (fiche simple ou créature du bestiaire liée, points de vie), documents (image + texte), notes visibles et **notes MJ secrètes** (table `journal_secret`), partage par joueur (voit / contrôle), « Montrer aux joueurs » (ouvre la fiche chez eux), fenêtres flottantes, glisser une entrée sur la carte = pion lié (le joueur qui contrôle le PNJ peut le déplacer) ; **pions** : barres PV / armure / armure magique / mana (reliées à la fiche du personnage, à la fiche du journal ou au pion), états (afflictions des mots-clés ou texte libre), infobulle au survol (valeurs pour qui contrôle le pion), panneau de raccourcis du pion sélectionné (Blessure −1 / −3 / −6, soin, armure, mana, fiche, centrer), dégâts et soins notés dans la discussion |
| `campagnes.html` | Espace MJ : créer une campagne, code d'invitation, fiches et decks des joueurs (lecture seule) |
| `js/jdr-supabase.js` | Connexion à Supabase (schéma `jdr`) |
| `js/jdr-rules.js` | Règles : modèle de carte, déclencheurs, effets, formules avec les caractéristiques, effets des cartes sur les caractéristiques, règles de deck |
| `js/jdr-card-render.js` | Dessin d'une carte |
| `js/jdr-filters.js` | Filtres de cartes (bibliothèque et deck) |
| `js/jdr-ui.js`, `css/jdr-ui.css` | Barre de navigation et styles communs |

## Cartes ↔ caractéristiques

- **Cartes → caractéristiques** : une capacité « Tant que cette carte est dans votre deck » avec l'effet « Modifier une caractéristique » ciblant « vous » change la caractéristique sur la fiche et dans le deck.
- **Caractéristiques → cartes** : les quantités des effets acceptent des formules (`2+corps`, `esprit*2`, `niveau`) calculées avec la fiche ; une carte peut exiger une caractéristique minimale.
- Les effets pendant une partie (postures, auras, rages…) seront appliqués par le futur moteur de jeu.
| `sql/` | Scripts SQL numérotés `jdr-001`, `jdr-002`… |
| `CLAUDE.md` | Règles de travail pour l'IA sur ce projet |

## Réutilisé depuis Rimd'Orël (à venir)

Création de deck, fonctions de jeu des cartes, système de déclencheurs (triggers), ajout de carte dans le deck, parties à plusieurs.
