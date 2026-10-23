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

## Contenu du dépôt

| Chemin | Rôle |
|---|---|
| `index.html` | Page d'accueil |
| `connexion.html` | Connexion (compte commun avec Rimd'Orël) |
| `fiche-personnage.html` | Fiche de personnage (modèle « parchemin ») : portrait entouré des caractéristiques, blessures en 5 paliers de 6 cases, armures, ressources, armes, armure et bouclier, inventaire avec charge. Sauvegarde dans le navigateur, ou en ligne une fois connecté ; rejoindre une campagne ; lien vers le deck ; affiche les effets du deck sur les caractéristiques |
| `deck.html` | Construction du deck d'un personnage (cartes autorisées selon classe, spécialisation, passé, peuple, prérequis ; taille selon le niveau) |
| `bibliotheque.html` | Toutes les cartes avec filtres |
| `editeur-cartes.html` | Création / modification des cartes (réservé au compte éditeur). Type « Créature » : formulaire et fiche paysage dédiés |
| `editeur-groupes.html` | Tableaux d'action de groupe des créatures, attribués ensuite aux créatures (réservé au compte éditeur) |
| `mots-cles.html` | Liste des mots-clés (mécaniques, super-types, afflictions, propriétés) avec leur définition. Tout le monde lit ; le compte éditeur ajoute / modifie / supprime. Les mots-clés s'ajoutent aux cartes dans l'éditeur de cartes |
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
