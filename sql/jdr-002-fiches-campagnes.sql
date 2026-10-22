-- jdr-002 : campagnes et fiches de personnage (schéma jdr uniquement)
-- Appliqué le 23/10/2026 sur le projet Supabase jzjhfxaibqqhzgkdyrdn.
--
-- Qui peut faire quoi :
--   - Un joueur voit et modifie uniquement SES fiches.
--   - Le MJ d'une campagne voit (lecture seule) les fiches rattachées à sa campagne.
--   - Un joueur rejoint une campagne avec le code d'invitation : jdr.join_campaign(code, id_fiche).

create table jdr.campaigns (
  id          uuid primary key default gen_random_uuid(),
  gm_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 8),
  created_at  timestamptz not null default now()
);
comment on table jdr.campaigns is 'JDR : campagnes. gm_id = compte du MJ. invite_code sert aux joueurs pour rejoindre.';

create table jdr.characters (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  campaign_id uuid references jdr.campaigns(id) on delete set null,
  name        text not null default '',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table jdr.characters is 'JDR : fiches de personnage. data = contenu complet de la fiche (JSON, format de fiche-personnage.html).';

create index characters_owner_idx on jdr.characters(owner_id);
create index characters_campaign_idx on jdr.characters(campaign_id);
create index campaigns_gm_idx on jdr.campaigns(gm_id);

-- mise à jour automatique de updated_at
create function jdr.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger characters_touch before update on jdr.characters
for each row execute function jdr.touch_updated_at();

-- fonctions d'aide pour la sécurité (évitent les boucles entre règles)
create function jdr.is_gm(p_campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jdr.campaigns c where c.id = p_campaign and c.gm_id = auth.uid());
$$;
create function jdr.is_member(p_campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jdr.characters ch where ch.campaign_id = p_campaign and ch.owner_id = auth.uid());
$$;

-- rejoindre une campagne avec un code
create function jdr.join_campaign(p_code text, p_character uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_campaign uuid;
begin
  select id into v_campaign from jdr.campaigns where invite_code = p_code;
  if v_campaign is null then raise exception 'Code de campagne invalide'; end if;
  update jdr.characters set campaign_id = v_campaign
   where id = p_character and owner_id = auth.uid();
  if not found then raise exception 'Personnage introuvable'; end if;
  return v_campaign;
end $$;

-- règles d'accès (RLS)
alter table jdr.campaigns  enable row level security;
alter table jdr.characters enable row level security;

create policy campaigns_select on jdr.campaigns for select to authenticated
  using (gm_id = auth.uid() or jdr.is_member(id));
create policy campaigns_insert on jdr.campaigns for insert to authenticated
  with check (gm_id = auth.uid());
create policy campaigns_update on jdr.campaigns for update to authenticated
  using (gm_id = auth.uid()) with check (gm_id = auth.uid());
create policy campaigns_delete on jdr.campaigns for delete to authenticated
  using (gm_id = auth.uid());

create policy characters_select on jdr.characters for select to authenticated
  using (owner_id = auth.uid() or (campaign_id is not null and jdr.is_gm(campaign_id)));
create policy characters_insert on jdr.characters for insert to authenticated
  with check (owner_id = auth.uid());
create policy characters_update on jdr.characters for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy characters_delete on jdr.characters for delete to authenticated
  using (owner_id = auth.uid());

-- droits : comptes connectés seulement
grant select, insert, update, delete on jdr.campaigns, jdr.characters to authenticated;
revoke execute on function jdr.is_gm(uuid), jdr.is_member(uuid), jdr.join_campaign(text, uuid), jdr.touch_updated_at() from public, anon;
grant execute on function jdr.is_gm(uuid), jdr.is_member(uuid), jdr.join_campaign(text, uuid) to authenticated;
