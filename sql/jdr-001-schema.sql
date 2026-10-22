-- jdr-001 : création du schéma du projet JDR deckbuilding (Merveille d'Un'Gara)
-- Appliqué le 23/10/2026 sur le projet Supabase jzjhfxaibqqhzgkdyrdn.
-- ATTENTION : le schéma public appartient à Rimd'Orël (jeu en production). Ne pas y toucher.

create schema if not exists jdr;

comment on schema jdr is 'PROJET JDR DECKBUILDING (distinct de Rimd''Orel). Tout ce qui concerne le JDR va ici. Ne jamais créer, modifier ou supprimer des objets Rimd''Orel (schéma public) depuis ce projet. Edge Functions du JDR préfixées jdr-. Scripts SQL numérotés jdr-001, jdr-002...';

comment on schema public is 'PROJET RIMD''OREL (jeu de cartes en ligne, en production avec des joueurs). Ne pas y mettre d''objets du projet JDR deckbuilding : ceux-ci vont dans le schéma jdr.';

grant usage on schema jdr to anon, authenticated, service_role;
