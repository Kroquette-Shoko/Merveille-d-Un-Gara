# Merveille d'Un'Gara — règles pour l'IA

## ⚠️ Base de données partagée avec un jeu en production

Ce projet utilise **le même projet Supabase que Rimd'Orël** (`jzjhfxaibqqhzgkdyrdn`), un jeu de cartes en ligne **en production avec des joueurs**.

Règles obligatoires :

1. Tout objet SQL de ce projet (tables, vues, fonctions, types) va dans le schéma **`jdr`**. Toujours écrire le nom complet : `jdr.ma_table`.
2. **Ne jamais créer, modifier ou supprimer quoi que ce soit dans le schéma `public`** : il appartient à Rimd'Orël.
3. Les Edge Functions de ce projet sont préfixées **`jdr-`** (ex. `jdr-create-game`). Ne jamais déployer ni modifier une Edge Function sans ce préfixe.
4. Les scripts SQL sont des fichiers numérotés dans `sql/` : `jdr-001-...sql`, `jdr-002-...sql`, etc.
5. Le stockage de fichiers (images) utilise un bucket dédié au JDR, jamais ceux de Rimd'Orël.
6. Les comptes (`auth.users`) sont **communs** aux deux jeux : les données propres au JDR sont reliées au compte par son identifiant, dans le schéma `jdr`.

## Règles de jeu

- La **fiche de personnage** est plus à jour que le manuel V1 : blessures à la place des points de vie, points d'action à la place des vitesses d'action (action / action libre / réaction / mouvement).
- Le MJ dirige la partie et contrôle les adversaires.

## Façon de travailler

- Le développeur n'a jamais codé sans IA : expliquer simplement, réponses factuelles et structurées.
- Livrer les fichiers complets mis à jour, pas des morceaux à insérer.
- Distinguer une correction de symptôme d'une correction de cause.
- Si un bug ne peut pas être confirmé par la lecture du code, ajouter des traces de diagnostic et le dire clairement.
