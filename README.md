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
| `fiche-personnage.html` | Fiche de personnage interactive (prototype, sauvegarde dans le navigateur) |
| `sql/` | Scripts SQL numérotés `jdr-001`, `jdr-002`… |
| `CLAUDE.md` | Règles de travail pour l'IA sur ce projet |

## Réutilisé depuis Rimd'Orël (à venir)

Création de deck, fonctions de jeu des cartes, système de déclencheurs (triggers), ajout de carte dans le deck, parties à plusieurs.
