# Prompt: Politisk fravær – søknad for tillitsvalgte og dashboard for attestanter

Du skal bygge en webapp i denne mappen for å søke om og sende ut dokumentasjon på politisk fravær. Den bygger videre på en eksisterende enkeltside («Fraværsmal») der én person fyller inn arrangement, deltakere og signatur, og så lager og sender PDF-er. Nå skal flyten deles i to roller.

## Roller

1. **Tillitsvalgt** (standardsiden, ingen innlogging): elev som har vært på et arrangement (f.eks. skolebesøk) og søker om politisk fravær for det.
2. **Attestant** (innlogget dashboard): fylkesleder, lokallagsleder eller lignende som godkjenner søknader og sender fraværserklæringen.

## Flyt 1 – Tillitsvalgt søker (startsiden `/`)

- Skjema med: navn, skole, e-post, telefon (valgfritt), arrangør (nedtrekksliste over arrangører/fylkeslag, hver koblet til én eller flere attestanter), type arrangement (f.eks. skolebesøk, møte, konferanse, annet), navn/beskrivelse av arrangementet, dato og klokkeslett fra–til, sted, og en valgfri kommentar til attestanten.
- Valg for om arrangementet «har vært» eller «skal være».
- Validering i skjemaet (gyldig e-post, fra-tid før til-tid, påkrevde felt) med tydelige feilmeldinger på norsk.
- Når hen trykker **Søk**:
  - søknaden lagres med status `venter`
  - attestanten(e) for valgt arrangør får en e-post: «[Navn] har søkt om politisk fravær for [arrangement] [dato]», med lenke direkte til søknaden i dashboardet
  - søkeren får en kvitteringsside og en kvitterings-e-post om at søknaden er mottatt
- Enkel beskyttelse mot spam: rate limit per IP/e-post, honeypot-felt eller Cloudflare Turnstile.

## Flyt 2 – Attestant-dashboard (`/attestant`)

- Innlogging med Google (organisasjonen bruker Google Workspace på `@elev.no`). Bare e-postadresser som er registrert som attestant i databasen får tilgang. Alle andre får en tydelig «du har ikke tilgang»-side.
- Oversikt over søknader for arrangørene attestanten hører til:
  - faner/filtre: Venter, Sendt, Avslått, Alle
  - søk på navn/skole/arrangement, filter på dato og arrangør
  - tabell med avkryssing per rad og «velg alle», sortert med nyeste først
- Klikk på en rad åpner detaljvisning med alle opplysninger og forhåndsvisning av fraværserklæringen (PDF) slik den blir.
- Handlinger:
  - **Send fravær** (for én eller flere markerte): lager en PDF per søker og sender den på e-post til søkeren fra den innloggede attestantens egen Gmail-konto. Status blir `sendt` med tidspunkt og hvem som sendte.
  - **Avslå** med valgfri begrunnelse, som sendes på e-post til søkeren.
  - **Rediger** feltene før sending (f.eks. rette tidspunkt eller navn på arrangementet).
  - Bekreftelsessteg før masseutsending («Du sender 12 fraværserklæringer fra kari@elev.no»).
  - Fremdrift og resultat per mottaker. Hvis noe feiler, skal det som allerede er sendt ikke sendes på nytt.
- Innstillinger per attestant: navn, verv, telefon og signatur (skrevet med håndskriftfont, tegnet eller opplastet bilde). Signaturen lagres og brukes på alle PDF-er attestanten sender.
- Admin-rolle (sentralstyret): administrere arrangører, attestanter og koblingen mellom dem, og se alle søknader.

## Fraværserklæringen (PDF)

- Samme innhold og oppsett som i dagens mal: logo øverst, dato øverst til høyre, tittel «Dokumentasjon av politisk fravær», lovhenvisningene (forskrift til opplæringslova § 3-3 siste ledd og § 3-47 femte ledd bokstav c, rundskriv Udir-3-2016), avsnittet «{navn} {deltok på / skal delta på} {arrangement} {tid} i regi av {arrangør}. Dette kan regnes som politisk arbeid …», hilsen, signatur, navn, verv og arrangør, og kontaktinfo.
- Malteksten, e-postteksten (emne og brødtekst med de samme `{felt}`-plassholderne), logoen og fargene skal kunne redigeres av admin i appen, ikke bare i koden.
- PDF-en lages på serveren, slik at den blir lik uansett nettleser, og den lagres eller kan lages på nytt fra søknaden.

## Teknisk

- **Frontend:** React + Vite + TypeScript og Tailwind, eller tilsvarende. Mobilvennlig. Søknadsskjemaet blir mest brukt på mobil.
- **Backend:** Supabase (Postgres, Auth med Google, Edge Functions, Storage for logo og signaturer).
- **Tabeller (forslag):** `arrangorer`, `attestanter` (bruker-id, e-post, navn, verv, telefon, signatur, rolle `attestant`/`admin`), `arrangor_attestant` (mange-til-mange), `soknader` (alle skjemafelt + status, `behandlet_av`, `behandlet_tid`, `avslag_begrunnelse`), `utsendinger` (logg per e-post: mottaker, avsender, tidspunkt, Gmail-message-id, feilmelding), `innstillinger` (maltekster, logo, farger).
- **Row Level Security på alle tabeller:**
  - Anonyme brukere kan bare sette inn søknader (via en Edge Function eller en insert-policy uten lesetilgang).
  - Attestanter kan bare lese og endre søknader for sine arrangører.
  - Admin kan alt.
- **E-post til attestant ved ny søknad og kvittering til søker:** systemavsender, f.eks. Resend fra `noreply@<domene>`, sendt fra en Edge Function.
- **Fraværserklæring fra attestantens egen konto:**
  - Gmail API med scope `gmail.send`, lagt til i Google-innloggingen. Lagre refresh token sikkert på serveren, aldri i nettleseren, og send fra en Edge Function.
  - Sett opp Google OAuth-appen som **intern** for Workspace-domenet, slik at `gmail.send` ikke krever Googles verifisering.
  - Dokumenter en reserveløsning hvis Gmail-tilgang mangler: send via Resend med attestantens navn som visningsnavn og `Reply-To` satt til attestantens adresse, og vis tydelig i appen hvilken løsning som ble brukt.
- **Hemmeligheter** (Resend-nøkkel, Google client secret) ligger bare i Supabase secrets.
- **Mal fra eksisterende kode:** hent logikken for PDF-tekst, plassholdere (`{navn}`, `{arrangement}`, `{tid}`, `{deltar}`, `{arrangør}`, `{dato}`, `{verv}`, `{organisasjon}`, `{avsender}`) og signaturtegning fra «Fraværsmal».

## Leveranse

1. Kort plan med datamodell og skjermskisser (tekst) før du begynner å kode. Vent på godkjenning av planen.
2. Kode i denne mappen, med `README.md` som forklarer oppsett: Supabase-prosjekt, Google OAuth (intern app), Resend, miljøvariabler og deploy (f.eks. Vercel eller Netlify).
3. SQL-migrasjoner med RLS-policyer og et seed-skript med testdata (én arrangør, én attestant, tre søknader).
4. Tester for RLS-policyene (anonym, attestant for annen arrangør, admin) og for PDF-generering.
5. Alt innhold i grensesnittet og e-postene på bokmål.

## Avklar med meg før du starter

- Hvilket domene appen og systemavsenderen skal ligge på.
- Om alle attestanter har `@elev.no`-kontoer i Google Workspace.
- Hvilke arrangører og attestanter som skal legges inn først.
- Om tillitsvalgte skal kunne se status på søknaden sin senere, f.eks. via en lenke i kvitterings-e-posten.
