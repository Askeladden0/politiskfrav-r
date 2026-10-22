-- Testdata. Trygt å kjøre flere ganger (rydder først).
-- Alt her er oppdiktet. E-postadresser på @example.test finnes ikke.

delete from public.organisasjoner where slug in ('eksempel', 'annen');
delete from public.superadmins where e_post = 'askedaln@gmail.com';

insert into public.superadmins (e_post) values ('askedaln@gmail.com');

-- ---------- Organisasjon 1: Eksempel Ungdomsorganisasjon ----------
insert into public.organisasjoner (id, slug, navn, kontakt_epost, innstillinger) values
  ('11111111-1111-4111-8111-111111111111', 'eksempel', 'Eksempel Ungdomsorganisasjon',
   'askedaln@gmail.com',
   '{"pageTitle":"Søk om politisk fravær","intro":"Har du vært på eller skal du på et arrangement i regi av oss? Fyll ut skjemaet, så får du dokumentasjon på politisk fravær av en attestant."}'::jsonb);

insert into public.arrangorer (id, organisasjon_id, navn) values
  ('11111111-1111-4111-8111-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Eksempel Sør'),
  ('11111111-1111-4111-8111-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Eksempel Nord');

insert into public.attestanter (id, organisasjon_id, e_post, navn, verv, telefon, rolle) values
  ('11111111-1111-4111-8111-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111',
   'askedaln@gmail.com', 'Test Admin', 'Organisasjonsleder', '900 00 000', 'admin'),
  ('11111111-1111-4111-8111-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111',
   'nord@example.test', 'Nora Nord', 'Fylkesleder Nord', '911 11 111', 'attestant');

insert into public.arrangor_attestant (arrangor_id, attestant_id) values
  ('11111111-1111-4111-8111-aaaaaaaaaaa1', '11111111-1111-4111-8111-bbbbbbbbbbb1'),
  ('11111111-1111-4111-8111-aaaaaaaaaaa2', '11111111-1111-4111-8111-bbbbbbbbbbb2');

insert into public.soknader
  (id, organisasjon_id, arrangor_id, navn, skole, e_post, telefon, type_arrangement, arrangement,
   har_vaert, dato_fra, tid_fra, dato_til, tid_til, sted, kommentar, status, behandlet_av, behandlet_tid,
   avslag_begrunnelse, status_token)
values
  -- venter
  ('11111111-1111-4111-8111-ccccccccccc1', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-aaaaaaaaaaa1', 'Kari Venter', 'Testbyen videregående skole', 'kari@example.test', null,
   'skolebesok', 'Skolebesøk på Testbyen vgs', false,
   current_date + 14, '09:00', current_date + 14, '14:30', 'Testbyen', 'Jeg kan også levere på papir.',
   'venter', null, null, null, 'seed-token-venter-0000000000000000000000'),
  -- sendt
  ('11111111-1111-4111-8111-ccccccccccc2', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-aaaaaaaaaaa1', 'Ola Sendt', 'Eksempeldalen videregående skole', 'ola@example.test', '922 22 222',
   'konferanse', 'Høstkonferansen', true,
   current_date - 20, '08:30', current_date - 19, '16:00', 'Oslo', null,
   'sendt', '11111111-1111-4111-8111-bbbbbbbbbbb1', now() - interval '15 days', null,
   'seed-token-sendt-00000000000000000000000'),
  -- avslått
  ('11111111-1111-4111-8111-ccccccccccc3', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-aaaaaaaaaaa2', 'Per Avslått', 'Nordlys videregående skole', 'per@example.test', null,
   'mote', 'Vennemøte', true,
   current_date - 10, '12:00', current_date - 10, '13:00', 'Tromsø', null,
   'avslatt', '11111111-1111-4111-8111-bbbbbbbbbbb2', now() - interval '8 days',
   'Dette var ikke et arrangement i vår regi.', 'seed-token-avslatt-000000000000000000000');

insert into public.utsendinger (organisasjon_id, soknad_id, type, mottaker, avsender, kanal, status, emne, tekst, sendt_av) values
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-ccccccccccc2', 'fravaer',
   'ola@example.test', 'Test Admin via Eksempel Ungdomsorganisasjon', 'dev', 'sendt',
   'Dokumentasjon av politisk fravær – Høstkonferansen', 'Seed-data.', '11111111-1111-4111-8111-bbbbbbbbbbb1'),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-ccccccccccc3', 'avslag',
   'per@example.test', 'Nora Nord via Eksempel Ungdomsorganisasjon', 'dev', 'sendt',
   'Svar på søknaden din om politisk fravær', 'Seed-data.', '11111111-1111-4111-8111-bbbbbbbbbbb2');

-- ---------- Organisasjon 2: Annen Ungdomsorganisasjon (for RLS-tester) ----------
insert into public.organisasjoner (id, slug, navn, kontakt_epost) values
  ('22222222-2222-4222-8222-222222222222', 'annen', 'Annen Ungdomsorganisasjon', 'annen@example.test');

insert into public.arrangorer (id, organisasjon_id, navn) values
  ('22222222-2222-4222-8222-aaaaaaaaaaa1', '22222222-2222-4222-8222-222222222222', 'Annen Lokallag');

insert into public.attestanter (id, organisasjon_id, e_post, navn, verv, rolle) values
  ('22222222-2222-4222-8222-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222',
   'annen@example.test', 'Anna Annen', 'Leder', 'admin');

insert into public.arrangor_attestant (arrangor_id, attestant_id) values
  ('22222222-2222-4222-8222-aaaaaaaaaaa1', '22222222-2222-4222-8222-bbbbbbbbbbb1');

insert into public.soknader
  (id, organisasjon_id, arrangor_id, navn, skole, e_post, type_arrangement, arrangement,
   har_vaert, dato_fra, tid_fra, dato_til, tid_til, sted, status, status_token)
values
  ('22222222-2222-4222-8222-ccccccccccc1', '22222222-2222-4222-8222-222222222222',
   '22222222-2222-4222-8222-aaaaaaaaaaa1', 'Hemmelig Elev', 'Annen skole', 'hemmelig@example.test',
   'mote', 'Lokallagsmøte', true,
   current_date - 3, '17:00', current_date - 3, '19:00', 'Annenbyen', 'venter',
   'seed-token-annen-0000000000000000000000');
