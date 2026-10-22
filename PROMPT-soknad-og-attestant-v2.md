# Prompt: Politisk fravær – søknad for tillitsvalgte og dashboard for attestanter (v2)

Du skal bygge en webapp i denne mappen for å søke om og sende ut dokumentasjon på politisk fravær. Appen er **ikke for én bestemt organisasjon**: én felles installasjon skal brukes av mange ungdoms- og elevorganisasjoner (f.eks. AUF, Natur og Ungdom, elevorganisasjoner), hver med sin egen side, sine egne attestanter og sin egen profil.

Den bygger videre på en eksisterende enkeltside, «Fraværsmal», der én person fyller inn arrangement, deltakere og signatur og så lager og sender PDF-er. Kildekoden ligger i `fravaersmal-referanse.html` i denne mappen. Nå deles flyten i to roller.

> **Planen og avklaringene under er godkjent.** Du trenger ikke vente på ny godkjenning før du begynner. Spør bare før handlinger som koster penger eller ikke kan angres (se «Før du starter»).

## Beslutninger som er tatt

| Spørsmål | Beslutning |
|---|---|
| Distribusjon | Én felles app (multi-tenant). Hver organisasjon får sin side under en sti: `<domene>/<org-slug>`, f.eks. `/auf`. |
| Domene | Start på Vercel-adressen (`*.vercel.app`). Eget domene kommer senere. Ikke bygg støtte for egne subdomener, innbygging eller proxy nå, men ikke gjør det vanskelig å legge til senere. |
| Kontoer | Attestanter kan ha hvilken som helst e-postadresse. Tilgang styres av attestantregisteret i databasen, ikke av domenet. |
| Statuslenke | Ja. Søkeren får en hemmelig lenke i kvitteringen som viser status uten innlogging. |
| Supabase | Opprett et nytt prosjekt `politisk-fravaer` i `eu-north-1`. |
| Testdata | En oppdiktet organisasjon, «Eksempel Ungdomsorganisasjon» (`/eksempel`). |

## Roller

1. **Tillitsvalgt / søker** (ingen innlogging): elev som har vært på eller skal på et arrangement (f.eks. skolebesøk) og søker om politisk fravær.
2. **Attestant** (innlogget): godkjenner søknader for arrangørene sine og sender fraværserklæringen.
3. **Org-admin** (innlogget): administrerer sin egen organisasjon, dvs. arrangører, attestanter, koblinger, maltekster, logo og farger, og ser alle søknadene i organisasjonen.
4. **Superadmin** (innlogget, plattformeier): oppretter organisasjoner, setter slug og utnevner den første org-admin. Ser alt.

## URL-struktur

- `/` – enkel forside for plattformen: hva dette er, og «Finn organisasjonen din» (liste over aktive organisasjoner)
- `/<org>` – søknadsskjemaet med organisasjonens logo, farger og tekster
- `/<org>/kvittering/<id>` – kvitteringsside
- `/<org>/status/<hemmelig-token>` – statusside for søkeren
- `/<org>/attestant` – dashboard
- `/<org>/attestant/innstillinger` – egne innstillinger
- `/<org>/admin` – org-admin
- `/superadmin` – plattformadmin
- `/logg-inn`, `/ingen-tilgang`

Slugs er små bokstaver, tall og bindestrek. Reserver `superadmin`, `logg-inn`, `ingen-tilgang`, `api`, `assets`, `status` og lignende.

## Flyt 1 – Søker (`/<org>`)

- Skjemaet har disse feltene:
  - navn, skole, e-post og telefon (valgfritt)
  - arrangør: nedtrekksliste over organisasjonens arrangører/fylkeslag, der hver er koblet til én eller flere attestanter
  - type arrangement: skolebesøk, møte, konferanse eller annet
  - navn eller beskrivelse av arrangementet
  - dato og klokkeslett fra–til, og sted
  - valgfri kommentar til attestanten
- Et valg for om arrangementet «har vært» eller «skal være».
- Validering i skjemaet (gyldig e-post, fra-tid før til-tid, påkrevde felt) med tydelige feilmeldinger på norsk.
- Når søkeren trykker **Søk**:
  - lagres søknaden med status `venter`
  - får attestanten(e) for valgt arrangør en e-post: «[Navn] har søkt om politisk fravær for [arrangement] [dato]», med lenke direkte til søknaden i dashboardet
  - kommer søkeren til en kvitteringsside og får en kvitterings-e-post med statuslenken
- Spambeskyttelse: honeypot-felt og rate limit per IP og e-post, samt Cloudflare Turnstile (nøkkel i miljøvariabel; hopp over Turnstile hvis nøkkelen ikke er satt).
- Skjemaet blir mest brukt på mobil. Design for mobil først.

## Flyt 2 – Attestant-dashboard (`/<org>/attestant`)

- Innlogging med Google eller med innloggingslenke på e-post (Supabase Auth). Bare e-postadresser som er registrert som attestant i den aktuelle organisasjonen får tilgang. Alle andre får en tydelig «du har ikke tilgang»-side.
- Én person kan være attestant i flere organisasjoner. Hvis det gjelder deg, vis en organisasjonsvelger.
- Oversikt over søknader for arrangørene attestanten hører til:
  - faner/filtre: Venter, Sendt, Avslått, Alle
  - søk på navn/skole/arrangement, og filter på dato og arrangør
  - tabell med avkryssing per rad og «velg alle», sortert med nyeste først
- Et klikk på en rad åpner en detaljvisning med alle opplysninger og en forhåndsvisning av fraværserklæringen (PDF) slik den blir.
- Handlinger:
  - **Send fravær** (for én eller flere markerte): lager én PDF per søker og sender den på e-post til søkeren. Status blir `sendt` med tidspunkt og hvem som sendte.
  - **Avslå** med valgfri begrunnelse, som sendes på e-post til søkeren.
  - **Rediger** feltene før sending (f.eks. rette tidspunkt eller navn på arrangementet).
  - Bekreftelsessteg før masseutsending, f.eks. «Du sender 12 fraværserklæringer som Kari Nordmann (svar går til kari@…)».
  - Fremdrift og resultat per mottaker. Hvis noe feiler, skal det som allerede er sendt ikke sendes på nytt. Bruk `utsendinger`-tabellen som idempotens-sperre.
- Innstillinger per attestant: navn, verv, telefon og signatur (skrevet med håndskriftfont, tegnet eller opplastet bilde). Signaturen lagres og brukes på alle PDF-er attestanten sender.

## E-post

- **Standard for all e-post er Resend**, sendt fra en Edge Function.
  - Avsenderadressen er plattformens systemavsender (`noreply@<plattformdomene>`).
  - Visningsnavnet er organisasjonens navn (for fraværserklæringer: «Kari Nordmann via AUF»).
  - `Reply-To` er attestantens adresse (for fraværserklæringer) eller organisasjonens kontaktadresse (for kvitteringer).
- **Viktig begrensning du må håndtere:** Uten et verifisert domene i Resend kan det bare sendes til kontoeierens egen adresse.
  - Lag appen slik at avsenderdomenet er en miljøvariabel.
  - I utviklingsmodus skal e-poster i tillegg logges og vises i en «Sendte e-poster (dev)»-visning, slik at hele flyten kan testes uten verifisert domene.
  - Dokumenter i README hva som må til for å sende ekte e-post.
- **Gmail fra attestantens egen konto er et valgfritt tillegg**, av som standard.
  - Det kan slås på per organisasjon av superadmin, når Google-appen er verifisert.
  - Scope `gmail.send` er sensitivt, og OAuth-appen er *ekstern* (ikke intern Workspace-app). Uverifisert virker den bare for testbrukere (maks 100), og de får en advarsel.
  - Bygg integrasjonen bak et flagg:
    - attestanten kobler til Gmail under innstillinger
    - refresh-token lagres kryptert på serveren og aldri i nettleseren
    - sendingen skjer fra en Edge Function
    - hvis tilkoblingen mangler eller feiler, faller appen tilbake til Resend
  - Vis tydelig i appen og i loggen hvilken kanal som ble brukt.
  - Dokumenter Googles verifiseringsprosess i README.
- Alle e-postmaler (kvittering, varsel til attestant, fraværserklæring, avslag) kan redigeres av org-admin og bruker de samme `{felt}`-plassholderne.

## Fraværserklæringen (PDF)

- Samme innhold og oppsett som i Fraværsmal:
  - logo øverst og dato øverst til høyre
  - tittelen «Dokumentasjon av politisk fravær»
  - lovhenvisningene (forskrift til opplæringslova § 3-3 siste ledd og § 3-47 femte ledd bokstav c, rundskriv Udir-3-2016)
  - avsnittet «{navn} {deltok på / skal delta på} {arrangement} {tid} i regi av {arrangør}. Dette kan regnes som politisk arbeid …»
  - hilsen, signatur, navn, verv og arrangør, og kontaktinfo
- Standardteksten hentes fra `site-config` i `fravaersmal-referanse.html`. Hver organisasjon får en kopi av den når organisasjonen opprettes, og org-admin kan endre den.
- Malteksten, e-posttekstene, logoen, fargene og organisasjonsnavnet redigeres i appen, ikke i koden.
- PDF-en lages på serveren (f.eks. med `pdf-lib` og Caveat-fonten innebygd), slik at den blir lik uansett nettleser. Den kan lages på nytt fra søknaden og signaturen når som helst. Forhåndsvisningen i dashboardet skal bruke samme genereringskode.
- Plassholdere: `{navn}`, `{skole}`, `{arrangement}`, `{tid}`, `{sted}`, `{deltar}`, `{arrangør}`, `{dato}`, `{attestant}`, `{verv}`, `{organisasjon}`, `{avsender}`.
  - Behold logikken fra `vars()`, `fill()` og `buildDoc()` i referansefilen, inkludert hvordan `{tid}` blir «den …» eller «fra … til …».
  - Lag `{tid}` fra de strukturerte dato- og tidsfeltene i søknaden, med norske månedsnavn.
- Signaturtegning (lerret, beskjæring og opplasting) og skrevet signatur med Caveat-fonten tas fra `setupPad()`, `saveSig()` og `textSig()` i referansefilen.

## Teknisk

- **Frontend:** React, Vite, TypeScript, Tailwind og React Router. Mobilvennlig og tilgjengelig (labels, fokus, kontrast).
  - Org-fargene settes som CSS-variabler, på samme måte som `applyTheme()` i referansefilen, inkludert den automatiske kontrastjusteringen.
- **Backend:** Supabase (Postgres, Auth med Google og innloggingslenke på e-post, Edge Functions, Storage for logoer og signaturer).
- **Tabeller (forslag):**
  - `organisasjoner`:
    - id, slug, navn, aktiv, kontakt-e-post
    - innstillinger som jsonb: maltekster, e-postmaler, logo-sti og farger
    - `gmail_aktivert`
  - `arrangorer`: organisasjon_id, navn, aktiv
  - `attestanter`:
    - organisasjon_id, bruker-id (nullable til første innlogging) og e-post
    - navn, verv, telefon, signatur
    - rolle `attestant` eller `admin`
    - unik på (organisasjon_id, e-post)
  - `arrangor_attestant`: kobling mellom arrangører og attestanter (mange-til-mange)
  - `soknader`:
    - organisasjon_id og alle skjemafeltene
    - status, `behandlet_av`, `behandlet_tid`, `avslag_begrunnelse`
    - `status_token` (tilfeldig, unik)
  - `utsendinger`: logg per e-post med søknad, type, mottaker, avsender, kanal (`resend`/`gmail`), ekstern meldings-id, feilmelding og tidspunkt
  - `superadmins`: bruker-id
  - `google_tokens`: attestant-id og kryptert refresh-token. Ingen policyer, så bare service role har tilgang.
- **Row Level Security på alle tabeller:**
  - Anonyme brukere har ingen direkte lese- eller skrivetilgang. Søknader settes inn via Edge Function `sok`, og statussiden leses via en Edge Function som slår opp på token og returnerer bare status og felt som er trygge å vise.
  - Offentlig lesbart: aktive organisasjoners slug, navn og profil, og aktive arrangørers navn (for skjemaet). Bruk et view eller en RPC som ikke lekker attestantdata.
  - Attestanter kan bare lese og endre søknader for arrangører de er koblet til, i sin egen organisasjon.
  - Org-admin kan alt innenfor sin egen organisasjon.
  - Superadmin kan alt.
  - Data fra én organisasjon skal aldri være synlig for en annen.
- **Edge Functions:**
  - `sok`
  - `status`
  - `pdf` (forhåndsvisning og nedlasting for innloggede)
  - `send-fravaer` (en liste med søknader, idempotent, resultat per mottaker)
  - `avsla`
  - `gmail-connect` og `gmail-callback` (bak flagg)
- **Hemmeligheter** (Resend-nøkkel, Google client secret, krypteringsnøkkel for tokens, Turnstile-secret) ligger bare i Supabase secrets og miljøvariabler, aldri i frontend-koden eller i repoet.
- **Deploy:** Vercel med SPA-rewrite, slik at `/<org>/…` fungerer ved direkte lasting.

## Før du starter

- Sjekk kostnad før du oppretter Supabase-prosjektet. Hvis det koster penger, vis prisen og spør meg først.
- Spør meg om:
  - hvilken e-postadresse som skal være superadmin og attestant i seed-dataene
  - om jeg har en Resend-konto og en Google Cloud-konto, eller om du skal dokumentere oppsettet for meg
- Ikke deploy til Vercel uten å spørre.

## Leveranse

1. Kode i denne mappen, i et git-repo med jevnlige commits.
2. `README.md` som forklarer:
   - oppsett av Supabase-prosjektet
   - Google-innlogging (Supabase Auth)
   - Resend og hva som skal til for ekte e-post (domeneverifisering)
   - det valgfrie Gmail-tillegget og Googles verifisering
   - miljøvariabler og deploy til Vercel
   - hvordan en ny organisasjon tas inn (superadmin → ny organisasjon → første org-admin)
3. SQL-migrasjoner med RLS-policyer, og et seed-skript med testdata: «Eksempel Ungdomsorganisasjon» (`eksempel`) med én arrangør, én attestant som også er org-admin, og tre søknader (én som venter, én som er sendt og én som er avslått). Legg også inn en organisasjon nummer to med én søknad, slik at RLS-testene kan sjekke at data ikke lekker mellom organisasjoner.
4. Tester:
   - RLS (pgTAP eller tilsvarende) for disse tilfellene:
     - anonym
     - attestant for en annen arrangør i samme organisasjon
     - attestant i en annen organisasjon
     - org-admin
     - superadmin
   - Vitest for plassholderutfylling, `{tid}`-formatering og PDF-generering
5. Alt innhold i grensesnittet og e-postene på bokmål.

## Senere (ikke bygg nå, men ikke stengt ute)

- Egne subdomener per organisasjon (f.eks. `fravaer.auf.no`) via Vercel-domener og oppslag på hostname.
- En kodebit for å bygge inn søknadsskjemaet på organisasjonens egen nettside.
- E-post fra organisasjonens eget domene (domeneverifisering i Resend per organisasjon).
