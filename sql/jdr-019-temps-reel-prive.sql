-- jdr-019 : TEMPS RÉEL du plateau (canaux privés)
-- Constat (journaux Realtime du 26/10/2026) : « PrivateOnly: This project only allows private channels ».
-- Le projet Supabase (partagé avec Rimd'Orël) n'accepte que les canaux PRIVÉS : le canal public du plateau
-- « jdr-plateau-<campagne> » était refusé → aucun temps réel (pions, discussion, cartes, tours…).
-- Correction : le plateau ouvre un canal privé ; un canal privé demande des règles d'accès sur realtime.messages.
--
-- On n'enlève et ne modifie RIEN d'existant : on AJOUTE seulement deux règles (préfixées jdr_) qui ne concernent
-- que les canaux « jdr-plateau-… » (les règles de Rimd'Orël « rimdorel_… » ne sont pas touchées).
-- Rien dans le schéma public.

-- Vrai si l'utilisateur connecté est le MJ ou un joueur de la campagne du canal « jdr-plateau-<uuid> »
create or replace function jdr.rt_can_join(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid;
begin
  if p_topic is null or p_topic !~ '^jdr-plateau-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  cid := substring(p_topic from 13)::uuid;
  return jdr.is_gm(cid) or jdr.is_member(cid);
end $$;
revoke execute on function jdr.rt_can_join(text) from public, anon;
grant execute on function jdr.rt_can_join(text) to authenticated;

-- Recevoir (diffusion + présence) sur le canal de sa campagne
create policy jdr_plateau_lecture on realtime.messages for select to authenticated
  using (realtime.topic() like 'jdr-plateau-%' and jdr.rt_can_join(realtime.topic()));
-- Envoyer (diffusion : pions déplacés, pings, mesures… ; présence : qui est connecté) sur le canal de sa campagne
create policy jdr_plateau_envoi on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'jdr-plateau-%' and extension in ('broadcast', 'presence') and jdr.rt_can_join(realtime.topic()));
