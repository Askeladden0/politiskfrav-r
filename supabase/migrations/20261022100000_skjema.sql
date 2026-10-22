-- Politisk fravær: skjema, hjelpefunksjoner, RLS og offentlige RPC-er.
-- Alt innhold er multi-tenant: alle rader hører til en organisasjon.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table public.organisasjoner (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40)
    check (slug not in ('superadmin','logg-inn','ingen-tilgang','api','assets','status','admin','attestant','kvittering','auth','static','favicon')),
  navn text not null check (char_length(navn) between 1 and 120),
  aktiv boolean not null default true,
  kontakt_epost text,
  innstillinger jsonb not null default '{}'::jsonb,
  gmail_aktivert boolean not null default false,
  opprettet timestamptz not null default now()
);

create table public.arrangorer (
  id uuid primary key default gen_random_uuid(),
  organisasjon_id uuid not null references public.organisasjoner(id) on delete cascade,
  navn text not null check (char_length(navn) between 1 and 160),
  aktiv boolean not null default true,
  opprettet timestamptz not null default now(),
  unique (organisasjon_id, navn)
);
create index on public.arrangorer (organisasjon_id);

create table public.attestanter (
  id uuid primary key default gen_random_uuid(),
  organisasjon_id uuid not null references public.organisasjoner(id) on delete cascade,
  bruker_id uuid references auth.users(id) on delete set null,
  e_post text not null check (e_post = lower(e_post) and e_post ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  navn text,
  verv text,
  telefon text,
  signatur jsonb,            -- {modus:'tekst'|'tegnet', tekst, src (png data-url), w, h}
  rolle text not null default 'attestant' check (rolle in ('attestant','admin')),
  opprettet timestamptz not null default now(),
  unique (organisasjon_id, e_post)
);
create index on public.attestanter (e_post);
create index on public.attestanter (bruker_id);

create table public.arrangor_attestant (
  arrangor_id uuid not null references public.arrangorer(id) on delete cascade,
  attestant_id uuid not null references public.attestanter(id) on delete cascade,
  primary key (arrangor_id, attestant_id)
);
create index on public.arrangor_attestant (attestant_id);

create table public.soknader (
  id uuid primary key default gen_random_uuid(),
  organisasjon_id uuid not null references public.organisasjoner(id) on delete cascade,
  arrangor_id uuid not null references public.arrangorer(id) on delete restrict,
  navn text not null,
  skole text not null,
  e_post text not null,
  telefon text,
  type_arrangement text not null check (type_arrangement in ('skolebesok','mote','konferanse','annet')),
  arrangement text not null,
  har_vaert boolean not null,                -- true = «har vært», false = «skal være»
  dato_fra date not null,
  tid_fra time not null,
  dato_til date not null,
  tid_til time not null,
  sted text,
  kommentar text,
  status text not null default 'venter' check (status in ('venter','sendt','avslatt')),
  behandlet_av uuid references public.attestanter(id) on delete set null,
  behandlet_tid timestamptz,
  avslag_begrunnelse text,
  status_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  ip_hash text,
  opprettet timestamptz not null default now(),
  check ((dato_til, tid_til) > (dato_fra, tid_fra))
);
create index on public.soknader (organisasjon_id, status, opprettet desc);
create index on public.soknader (arrangor_id);
create index on public.soknader (ip_hash, opprettet);
create index on public.soknader (lower(e_post), opprettet);

create table public.utsendinger (
  id uuid primary key default gen_random_uuid(),
  organisasjon_id uuid not null references public.organisasjoner(id) on delete cascade,
  soknad_id uuid references public.soknader(id) on delete cascade,
  type text not null check (type in ('kvittering','varsel','fravaer','avslag')),
  mottaker text not null,
  avsender text,
  kanal text not null check (kanal in ('resend','gmail','dev')),
  status text not null default 'sender' check (status in ('sender','sendt','feilet')),
  emne text,
  tekst text,
  vedlegg text,
  ekstern_id text,
  feil text,
  sendt_av uuid references public.attestanter(id) on delete set null,
  opprettet timestamptz not null default now()
);
create index on public.utsendinger (organisasjon_id, opprettet desc);
create index on public.utsendinger (soknad_id);
-- Idempotens-sperre: en fraværserklæring og ett avslag per søknad kan bare
-- være «under sending» eller «sendt» én gang. Feilede forsøk blokkerer ikke.
create unique index utsendinger_en_per_soknad
  on public.utsendinger (soknad_id, type)
  where type in ('fravaer','avslag') and status in ('sender','sendt');

create table public.superadmins (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid references auth.users(id) on delete cascade,
  e_post text not null unique check (e_post = lower(e_post)),
  opprettet timestamptz not null default now()
);

create table public.google_tokens (
  attestant_id uuid primary key references public.attestanter(id) on delete cascade,
  refresh_token_kryptert text not null,
  google_epost text,
  opprettet timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Hjelpefunksjoner (security definer, ligger i skjemaet «private» som ikke
-- eksponeres via API-et)
-- ---------------------------------------------------------------------------

create or replace function private.min_epost() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function private.er_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.superadmins s
    where (auth.uid() is not null and s.bruker_id = auth.uid())
       or (private.min_epost() <> '' and s.e_post = private.min_epost())
  )
$$;

-- Attestant eller admin i organisasjonen?
create or replace function private.er_medlem(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.er_superadmin() or exists (
    select 1 from public.attestanter a
    where a.organisasjon_id = org
      and ((auth.uid() is not null and a.bruker_id = auth.uid())
        or (private.min_epost() <> '' and a.e_post = private.min_epost()))
  )
$$;

create or replace function private.er_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.er_superadmin() or exists (
    select 1 from public.attestanter a
    where a.organisasjon_id = org and a.rolle = 'admin'
      and ((auth.uid() is not null and a.bruker_id = auth.uid())
        or (private.min_epost() <> '' and a.e_post = private.min_epost()))
  )
$$;

-- Kan innlogget bruker behandle søknader for denne arrangøren?
create or replace function private.kan_behandle_arrangor(org uuid, arr uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.er_org_admin(org) or exists (
    select 1
    from public.attestanter a
    join public.arrangor_attestant aa on aa.attestant_id = a.id
    where a.organisasjon_id = org and aa.arrangor_id = arr
      and ((auth.uid() is not null and a.bruker_id = auth.uid())
        or (private.min_epost() <> '' and a.e_post = private.min_epost()))
  )
$$;

-- Er raden den innloggede brukerens egen attestantrad?
create or replace function private.er_meg(att public.attestanter) returns boolean
language sql stable set search_path = '' as $$
  select (auth.uid() is not null and att.bruker_id = auth.uid())
      or (private.min_epost() <> '' and att.e_post = private.min_epost())
$$;

grant execute on all functions in schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organisasjoner enable row level security;
alter table public.arrangorer enable row level security;
alter table public.attestanter enable row level security;
alter table public.arrangor_attestant enable row level security;
alter table public.soknader enable row level security;
alter table public.utsendinger enable row level security;
alter table public.superadmins enable row level security;
alter table public.google_tokens enable row level security;

-- organisasjoner: medlemmer ser sin egen, admin endrer, superadmin alt.
-- Anonyme leser via RPC-ene lenger ned, aldri direkte.
create policy org_select on public.organisasjoner for select to authenticated
  using (private.er_medlem(id));
create policy org_update on public.organisasjoner for update to authenticated
  using (private.er_org_admin(id)) with check (private.er_org_admin(id));
create policy org_insert on public.organisasjoner for insert to authenticated
  with check (private.er_superadmin());
create policy org_delete on public.organisasjoner for delete to authenticated
  using (private.er_superadmin());

-- arrangører
create policy arr_select on public.arrangorer for select to authenticated
  using (private.er_medlem(organisasjon_id));
create policy arr_write on public.arrangorer for all to authenticated
  using (private.er_org_admin(organisasjon_id)) with check (private.er_org_admin(organisasjon_id));

-- attestanter: egen rad + admin ser alle i organisasjonen
create policy att_select on public.attestanter for select to authenticated
  using (private.er_org_admin(organisasjon_id) or private.er_meg(attestanter));
create policy att_insert on public.attestanter for insert to authenticated
  with check (private.er_org_admin(organisasjon_id));
create policy att_delete on public.attestanter for delete to authenticated
  using (private.er_org_admin(organisasjon_id));
create policy att_update_admin on public.attestanter for update to authenticated
  using (private.er_org_admin(organisasjon_id)) with check (private.er_org_admin(organisasjon_id));
-- Attestant kan endre egne profilfelt, men ikke rolle eller e-post (se trigger under).
create policy att_update_self on public.attestanter for update to authenticated
  using (private.er_meg(attestanter)) with check (private.er_meg(attestanter));

create or replace function private.beskytt_attestant_felt() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.er_org_admin(old.organisasjon_id) then
    return new;
  end if;
  if new.rolle is distinct from old.rolle
     or new.e_post is distinct from old.e_post
     or new.organisasjon_id is distinct from old.organisasjon_id then
    raise exception 'Du kan ikke endre rolle, e-post eller organisasjon' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger beskytt_attestant_felt before update on public.attestanter
  for each row execute function private.beskytt_attestant_felt();

-- koblinger arrangør ↔ attestant
create policy aa_select on public.arrangor_attestant for select to authenticated
  using (exists (select 1 from public.arrangorer r
                 where r.id = arrangor_id and private.er_medlem(r.organisasjon_id)));
create policy aa_write on public.arrangor_attestant for all to authenticated
  using (exists (select 1 from public.arrangorer r
                 where r.id = arrangor_id and private.er_org_admin(r.organisasjon_id)))
  with check (exists (select 1 from public.arrangorer r
                 where r.id = arrangor_id and private.er_org_admin(r.organisasjon_id))
              and exists (select 1 from public.arrangorer r
                 join public.attestanter a on a.id = attestant_id
                 where r.id = arrangor_id and a.organisasjon_id = r.organisasjon_id));

-- søknader: ingen anonym tilgang. Innsending skjer via edge function «sok».
create policy sok_select on public.soknader for select to authenticated
  using (private.kan_behandle_arrangor(organisasjon_id, arrangor_id));
create policy sok_update on public.soknader for update to authenticated
  using (private.kan_behandle_arrangor(organisasjon_id, arrangor_id))
  with check (private.kan_behandle_arrangor(organisasjon_id, arrangor_id));
-- Ingen insert/delete-policy: bare service role (edge functions) oppretter søknader.

-- utsendinger: les-bare for dem som kan se søknaden; org-admin ser all e-post i organisasjonen
create policy uts_select on public.utsendinger for select to authenticated
  using (
    private.er_org_admin(organisasjon_id)
    or exists (select 1 from public.soknader s
               where s.id = soknad_id and private.kan_behandle_arrangor(s.organisasjon_id, s.arrangor_id))
  );

-- superadmins: bare superadmin kan se/endre
create policy sa_all on public.superadmins for all to authenticated
  using (private.er_superadmin()) with check (private.er_superadmin());

-- google_tokens: ingen policyer. Bare service role har tilgang.

-- Superadmin får full tilgang til alle tabeller
create policy sa_org on public.organisasjoner for all to authenticated
  using (private.er_superadmin()) with check (private.er_superadmin());

-- Tabellrettigheter: ingenting til anon. Authenticated styres av RLS.
revoke all on all tables in schema public from anon;
revoke all on public.google_tokens from authenticated;
revoke insert, delete on public.soknader from authenticated;
revoke insert, update, delete on public.utsendinger from authenticated;

-- ---------------------------------------------------------------------------
-- Offentlige RPC-er (lekker ikke attestantdata)
-- ---------------------------------------------------------------------------

create or replace function public.aktive_organisasjoner()
returns table (slug text, navn text)
language sql stable security definer set search_path = '' as $$
  select o.slug, o.navn from public.organisasjoner o where o.aktiv order by o.navn
$$;

create or replace function public.organisasjon_profil(p_slug text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id,
    'slug', o.slug,
    'navn', o.navn,
    'kontakt_epost', o.kontakt_epost,
    'profil', jsonb_strip_nulls(jsonb_build_object(
      'pageTitle', o.innstillinger -> 'pageTitle',
      'intro', o.innstillinger -> 'intro',
      'logo', o.innstillinger -> 'logo',
      'logoW', o.innstillinger -> 'logoW',
      'logoH', o.innstillinger -> 'logoH',
      'colors', o.innstillinger -> 'colors')),
    'arrangorer', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'navn', a.navn) order by a.navn)
      from public.arrangorer a
      where a.organisasjon_id = o.id and a.aktiv
        and exists (select 1 from public.arrangor_attestant aa where aa.arrangor_id = a.id)
    ), '[]'::jsonb))
  from public.organisasjoner o
  where o.slug = lower(p_slug) and o.aktiv
$$;

-- Knytter innlogget bruker til attestantrader med samme e-post (første innlogging).
create or replace function public.koble_innlogget_bruker()
returns void
language sql volatile security definer set search_path = '' as $$
  update public.attestanter a set bruker_id = auth.uid()
   where auth.uid() is not null and a.bruker_id is distinct from auth.uid()
     and a.e_post = private.min_epost();
  update public.superadmins s set bruker_id = auth.uid()
   where auth.uid() is not null and s.bruker_id is distinct from auth.uid()
     and s.e_post = private.min_epost();
$$;

-- Hvilke organisasjoner har innlogget bruker tilgang til, og med hvilken rolle?
create or replace function public.mine_organisasjoner()
returns table (slug text, navn text, rolle text)
language sql stable security definer set search_path = '' as $$
  select o.slug, o.navn, 'superadmin'::text from public.organisasjoner o where private.er_superadmin()
  union
  select o.slug, o.navn, a.rolle
  from public.attestanter a join public.organisasjoner o on o.id = a.organisasjon_id
  where (auth.uid() is not null and a.bruker_id = auth.uid())
     or (private.min_epost() <> '' and a.e_post = private.min_epost())
  order by 2
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.aktive_organisasjoner() to anon, authenticated;
grant execute on function public.organisasjon_profil(text) to anon, authenticated;
grant execute on function public.koble_innlogget_bruker() to authenticated;
grant execute on function public.mine_organisasjoner() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: offentlig bucket for logoer; bare admin skriver i egen organisasjons mappe
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logoer', 'logoer', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy logoer_skriv on storage.objects for all to authenticated
  using (bucket_id = 'logoer' and private.er_org_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'logoer' and private.er_org_admin(((storage.foldername(name))[1])::uuid));
