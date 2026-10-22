-- RLS-tester (pgTAP). Kjør med `supabase test db`, eller lim hele filen inn i SQL-editoren.
-- Forutsetter seed.sql. Alt skjer i en transaksjon som rulles tilbake.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(42);

-- ---------------------------------------------------------------------------
-- Hjelpere: kjør et uttrykk som en bestemt bruker (rolle + JWT-claims).
-- ---------------------------------------------------------------------------
create function pg_temp.som(epost text, rolle text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when epost is null then '' else json_build_object('sub', gen_random_uuid(), 'email', epost, 'role', rolle)::text end, true);
  perform set_config('role', rolle, true);
end $$;

-- Antall rader en spørring returnerer for brukeren (feil → -1)
create function pg_temp.antall(epost text, rolle text, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.som(epost, rolle);
  begin
    execute 'select count(*) from (' || q || ') x' into n;
  exception when others then n := -1;
  end;
  execute 'reset role';
  return n;
end $$;

-- Antall rader en skrivende setning påvirker (feil → -1)
create function pg_temp.skriv(epost text, rolle text, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.som(epost, rolle);
  begin
    execute q;
    get diagnostics n = row_count;
  exception when others then n := -1;
  end;
  execute 'reset role';
  return n;
end $$;

-- Ekstra testidentiteter (rulles tilbake)
insert into public.attestanter (organisasjon_id, e_post, navn, rolle)
values ('11111111-1111-4111-8111-111111111111', 'orgadmin@example.test', 'Org Admin', 'admin');
insert into public.superadmins (e_post) values ('super@example.test');

-- Seed-id-er (se seed.sql): Kari (Sør, venter), Ola (Sør, sendt), Per (Nord, avslått) i Eksempel; Hemmelig Elev i Annen.
-- Eksempel: Kari (Sør, venter), Ola (Sør, sendt), Per (Nord, avslått). Annen: Hemmelig Elev.

-- ---------------------------------------------------------------------------
-- 1. Anonym
-- ---------------------------------------------------------------------------
select is(pg_temp.antall(null, 'anon', 'select 1 from public.soknader'), -1::bigint, 'anon: kan ikke lese søknader');
select is(pg_temp.antall(null, 'anon', 'select 1 from public.attestanter'), -1::bigint, 'anon: kan ikke lese attestanter');
select is(pg_temp.antall(null, 'anon', 'select 1 from public.utsendinger'), -1::bigint, 'anon: kan ikke lese utsendinger');
select is(pg_temp.antall(null, 'anon', 'select 1 from public.organisasjoner'), -1::bigint, 'anon: kan ikke lese organisasjoner direkte');
select is(pg_temp.antall(null, 'anon', 'select 1 from public.google_tokens'), -1::bigint, 'anon: kan ikke lese google_tokens');
select is(pg_temp.skriv(null, 'anon', $q$insert into public.soknader (organisasjon_id, arrangor_id, navn, skole, e_post, type_arrangement, arrangement, har_vaert, dato_fra, tid_fra, dato_til, tid_til) values ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-aaaaaaaaaaa1','x','x','x@x.no','mote','x',true,'2026-01-01','10:00','2026-01-01','11:00')$q$),
  -1::bigint, 'anon: kan ikke sette inn søknader direkte');
select cmp_ok(pg_temp.antall(null, 'anon', 'select * from public.aktive_organisasjoner()'), '>=', 2::bigint, 'anon: ser aktive organisasjoner via RPC');
select is(pg_temp.antall(null, 'anon', $q$select 1 from public.organisasjon_profil('eksempel') p where p ? 'attestanter' or p::text like '%example.test%'$q$),
  0::bigint, 'anon: organisasjonsprofilen lekker ingen attestantdata (kontaktadressen er offentlig med vilje)');
select is(pg_temp.antall(null, 'anon', $q$select jsonb_array_elements(public.organisasjon_profil('eksempel') -> 'arrangorer')$q$),
  2::bigint, 'anon: ser de to aktive arrangørene i profilen');

-- ---------------------------------------------------------------------------
-- 2. Attestant for en annen arrangør i samme organisasjon (Nora, Nord)
-- ---------------------------------------------------------------------------
select is(pg_temp.antall('nord@example.test', 'authenticated', 'select 1 from public.soknader'), 1::bigint,
  'Nora (Nord): ser bare Pers søknad (Nord)');
select is(pg_temp.antall('nord@example.test', 'authenticated', $q$select 1 from public.soknader where id = '11111111-1111-4111-8111-ccccccccccc1'$q$), 0::bigint,
  'Nora: ser ikke Karis søknad (arrangør Sør i samme organisasjon)');
select is(pg_temp.skriv('nord@example.test', 'authenticated', $q$update public.soknader set sted = 'x' where id = '11111111-1111-4111-8111-ccccccccccc1'$q$), 0::bigint,
  'Nora: kan ikke endre Karis søknad');
select is(pg_temp.skriv('nord@example.test', 'authenticated', $q$update public.soknader set sted = 'Tromsø sentrum' where id = '11111111-1111-4111-8111-ccccccccccc3'$q$), 1::bigint,
  'Nora: kan redigere søknader for egen arrangør');
select is(pg_temp.skriv('nord@example.test', 'authenticated', $q$update public.soknader set status = 'sendt' where id = '11111111-1111-4111-8111-ccccccccccc3'$q$), -1::bigint,
  'Nora: kan ikke endre status direkte (bare via edge function)');
select is(pg_temp.antall('nord@example.test', 'authenticated', 'select 1 from public.attestanter'), 1::bigint, 'Nora: ser bare seg selv blant attestantene');
select is(pg_temp.skriv('nord@example.test', 'authenticated', $q$update public.attestanter set rolle = 'admin' where e_post = 'nord@example.test'$q$), -1::bigint,
  'Nora: kan ikke gjøre seg selv til admin');
select is(pg_temp.skriv('nord@example.test', 'authenticated', $q$update public.attestanter set navn = 'Nora N.' where e_post = 'nord@example.test'$q$), 1::bigint,
  'Nora: kan endre egne profilfelt');
select is(pg_temp.antall('nord@example.test', 'authenticated', 'select 1 from public.google_tokens'), -1::bigint, 'Nora: kan ikke lese google_tokens');
select is(pg_temp.skriv('nord@example.test', 'authenticated', $q$insert into public.arrangorer (organisasjon_id, navn) values ('11111111-1111-4111-8111-111111111111','Ny')$q$), -1::bigint,
  'Nora: kan ikke opprette arrangører');
select is(pg_temp.antall('nord@example.test', 'authenticated', $q$select 1 from public.utsendinger where soknad_id = '11111111-1111-4111-8111-ccccccccccc2'$q$), 0::bigint,
  'Nora: ser ikke utsendinger for andre arrangørers søknader');

-- ---------------------------------------------------------------------------
-- 3. Attestant i en annen organisasjon (Anna, Annen)
-- ---------------------------------------------------------------------------
select is(pg_temp.antall('annen@example.test', 'authenticated', 'select 1 from public.soknader'), 1::bigint, 'Anna: ser bare egen organisasjons søknad');
select is(pg_temp.antall('annen@example.test', 'authenticated', $q$select 1 from public.soknader where organisasjon_id = '11111111-1111-4111-8111-111111111111'$q$), 0::bigint,
  'Anna: ser ingen søknader fra Eksempel');
select is(pg_temp.antall('annen@example.test', 'authenticated', 'select 1 from public.organisasjoner'), 1::bigint, 'Anna: ser bare sin egen organisasjon');
select is(pg_temp.antall('annen@example.test', 'authenticated', $q$select 1 from public.attestanter where organisasjon_id = '11111111-1111-4111-8111-111111111111'$q$), 0::bigint,
  'Anna: ser ingen attestanter i Eksempel');
select is(pg_temp.skriv('annen@example.test', 'authenticated', $q$update public.soknader set sted = 'x' where id = '11111111-1111-4111-8111-ccccccccccc1'$q$), 0::bigint, 'Anna: kan ikke endre søknader i Eksempel');
select is(pg_temp.skriv('annen@example.test', 'authenticated', $q$insert into public.attestanter (organisasjon_id, e_post) values ('11111111-1111-4111-8111-111111111111','inntrenger@example.test')$q$), -1::bigint,
  'Anna: kan ikke legge til attestanter i Eksempel, selv om hun er admin hos Annen');

-- ---------------------------------------------------------------------------
-- 4. Org-admin (Eksempel)
-- ---------------------------------------------------------------------------
select is(pg_temp.antall('orgadmin@example.test', 'authenticated', $q$select 1 from public.soknader where id in ('11111111-1111-4111-8111-ccccccccccc1', '11111111-1111-4111-8111-ccccccccccc2', '11111111-1111-4111-8111-ccccccccccc3')$q$), 3::bigint,
  'Org-admin: ser alle søknader i egen organisasjon');
select is(pg_temp.antall('orgadmin@example.test', 'authenticated', $q$select 1 from public.soknader where id = '22222222-2222-4222-8222-ccccccccccc1'$q$), 0::bigint,
  'Org-admin: ser ikke andre organisasjoners søknader');
select is(pg_temp.skriv('orgadmin@example.test', 'authenticated', $q$insert into public.arrangorer (organisasjon_id, navn) values ('11111111-1111-4111-8111-111111111111','Eksempel Vest')$q$), 1::bigint,
  'Org-admin: kan opprette arrangører i egen organisasjon');
select is(pg_temp.skriv('orgadmin@example.test', 'authenticated', $q$insert into public.arrangorer (organisasjon_id, navn) values ('22222222-2222-4222-8222-222222222222','Kuppet')$q$), -1::bigint,
  'Org-admin: kan ikke opprette arrangører i en annen organisasjon');
select is(pg_temp.skriv('orgadmin@example.test', 'authenticated', $q$update public.organisasjoner set navn = 'Nytt navn' where id = '11111111-1111-4111-8111-111111111111'$q$), 1::bigint,
  'Org-admin: kan endre egen organisasjons profil');
select is(pg_temp.skriv('orgadmin@example.test', 'authenticated', $q$update public.organisasjoner set slug = 'kapret' where id = '11111111-1111-4111-8111-111111111111'$q$), -1::bigint,
  'Org-admin: kan ikke endre slug (forbeholdt superadmin)');
select is(pg_temp.skriv('orgadmin@example.test', 'authenticated', $q$update public.organisasjoner set gmail_aktivert = true where id = '11111111-1111-4111-8111-111111111111'$q$), -1::bigint,
  'Org-admin: kan ikke slå på Gmail selv');
select is(pg_temp.antall('orgadmin@example.test', 'authenticated', 'select 1 from public.superadmins'), 0::bigint, 'Org-admin: ser ikke superadmin-listen');
select is(pg_temp.antall('orgadmin@example.test', 'authenticated', $q$select 1 from public.utsendinger where organisasjon_id = '11111111-1111-4111-8111-111111111111'$q$), 2::bigint,
  'Org-admin: ser organisasjonens utsendinger');

-- ---------------------------------------------------------------------------
-- 5. Superadmin
-- ---------------------------------------------------------------------------
select is(pg_temp.antall('super@example.test', 'authenticated', $q$select 1 from public.soknader where id in ('11111111-1111-4111-8111-ccccccccccc1', '11111111-1111-4111-8111-ccccccccccc2', '11111111-1111-4111-8111-ccccccccccc3', '22222222-2222-4222-8222-ccccccccccc1')$q$), 4::bigint,
  'Superadmin: ser søknader i alle organisasjoner');
select cmp_ok(pg_temp.antall('super@example.test', 'authenticated', 'select 1 from public.organisasjoner'), '>=', 2::bigint, 'Superadmin: ser alle organisasjoner');
select is(pg_temp.skriv('super@example.test', 'authenticated', $q$insert into public.organisasjoner (slug, navn) values ('ny-org','Ny org')$q$), 1::bigint,
  'Superadmin: kan opprette organisasjoner');
select is(pg_temp.skriv('orgadmin@example.test', 'authenticated', $q$insert into public.organisasjoner (slug, navn) values ('ny-org-2','Ny org 2')$q$), -1::bigint,
  'Org-admin: kan ikke opprette organisasjoner');
select is(pg_temp.skriv('super@example.test', 'authenticated', $q$insert into public.organisasjoner (slug, navn) values ('api','Reservert')$q$), -1::bigint,
  'Reserverte slugs avvises av databasen');

-- ---------------------------------------------------------------------------
-- 6. Idempotens-sperre for utsendinger
-- ---------------------------------------------------------------------------
select lives_ok($q$insert into public.utsendinger (organisasjon_id, soknad_id, type, mottaker, kanal, status)
  values ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-ccccccccccc1', 'fravaer', 'kari@example.test', 'dev', 'sender')$q$,
  'første fraværsutsending for en søknad reserveres');
select throws_ok($q$insert into public.utsendinger (organisasjon_id, soknad_id, type, mottaker, kanal, status)
  values ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-ccccccccccc1', 'fravaer', 'kari@example.test', 'dev', 'sender')$q$,
  '23505', null, 'en andre fraværsutsending for samme søknad avvises');

-- Oppsummering. `supabase test db` skriver TAP-linjer selv; i SQL-editor får du bare siste resultat.
select _get('curr_test') as kjort, num_failed() as feilet,
       coalesce((select string_agg(f, E'\n') from finish() f), 'alle bestått') as feilmeldinger;

rollback;
