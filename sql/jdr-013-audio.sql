-- jdr-013 : audio du plateau — état partagé des pistes Musique et Ambiance (YouTube)
-- Schéma jdr uniquement — rien dans public (Rimd'Orël).
--
-- campaigns.audio = {
--   music:    { src: { v: id vidéo YouTube, list: id playlist }, title, playing, pos (secondes au moment « at »), at (horodatage ms), loop, vol (0-100) },
--   ambiance: { … même chose … },
--   sfxVol: volume des bruitages (0-100),
--   saved: [ { kind: 'music' | 'ambiance', name, url } ]   -- liens favoris du MJ
-- }
-- Écrit par le MJ seulement (droits de jdr.campaigns), lu par les joueurs de la campagne.
-- Les bruitages sont des fichiers du bucket « jdr-plateau » (dossier <campagne>/sons/), joués chez tous par message temps réel.

alter table jdr.campaigns add column audio jsonb not null default '{}'::jsonb;
comment on column jdr.campaigns.audio is 'JDR : état des pistes audio du plateau (musique, ambiance, favoris, volume des bruitages).';
