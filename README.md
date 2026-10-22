# Politisk fravær

Én felles webapp der mange ungdoms- og elevorganisasjoner kan ta imot søknader om politisk fravær og sende ut
fraværserklæringer. Hver organisasjon får sin egen side (`/<org>`), sine egne attestanter, sin egen logo, sine farger og
sine maltekster.

| Rolle | Hva de gjør | Adresse |
|---|---|---|
| Søker | Fyller ut søknad uten innlogging, får kvittering og en hemmelig statuslenke | `/<org>`, `/<org>/status/<token>` |
| Attestant | Behandler søknader for arrangørene sine, sender fravær eller avslår | `/<org>/attestant` |
| Org-admin | Administrerer arrangører, attestanter, logo, farger og maltekster | `/<org>/admin` |
| Superadmin | Oppretter organisasjoner og utnevner første org-admin | `/superadmin` |

Appen bygger videre på «Fraværsmal» (`fravaersmal-referanse.html`). Plassholderlogikk (`{navn}`, `{tid}` …), PDF-oppsett,
fargejustering og signaturfelt er portert derfra.

## Arkitektur

- **Frontend:** React, Vite, TypeScript, Tailwind v4 og React Router. Mobil først. Fargene til organisasjonen settes som
  CSS-variabler (`src/lib/theme.ts`, med automatisk kontrastjustering).
- **Backend:** Supabase (Postgres med RLS, Auth, Storage, Edge Functions).
- **Delt kode:** `supabase/functions/_shared/mal.ts` (plassholdere, `{tid}`, standardtekster) og `pdf.ts` (PDF med `pdf-lib`)
  brukes av både frontend, edge functions og tester. Forhåndsvisningen i dashboardet kaller `pdf`-funksjonen, så den er
  identisk med PDF-en som sendes.
- **Ingen anonym tilgang til tabellene.** Søknader settes inn av edge function `sok`, og statussiden leses via `status`
  (oppslag på token). Offentlig skjemadata hentes via RPC-ene `organisasjon_profil` og `aktive_organisasjoner`, som ikke
  returnerer attestantdata.

### Edge Functions

| Funksjon | Hva den gjør |
|---|---|
| `sok` | Validerer og lagrer søknad. Honeypot, rate limit per IP og e-post, valgfri Turnstile. Sender kvittering og varsel. |
| `status` | Returnerer bare status og trygge felt for en statustoken. |
| `pdf` | Lager fraværserklæringen for innloggede (forhåndsvisning og nedlasting). |
| `send-fravaer` | Sender fraværserklæring. Idempotent via unik sperre i `utsendinger`. |
| `avsla` | Avslår med valgfri begrunnelse og sender svar. |
| `gmail-connect`, `gmail-callback` | Valgfritt Gmail-tillegg (se under). |

### Tabeller

`organisasjoner`, `arrangorer`, `attestanter`, `arrangor_attestant`, `soknader`, `utsendinger`, `superadmins`,
`google_tokens`. Alle har RLS. `google_tokens` har ingen policyer, så bare service role kommer til.

Tilgangsregler i korte trekk:

- Anonym: ingen direkte tilgang.
- Attestant: leser og redigerer innholdet i søknader for arrangører hen er koblet til, i egen organisasjon. Status kan bare
  endres via edge functions.
- Org-admin: alt i egen organisasjon, men ikke `slug`, `aktiv` eller `gmail_aktivert`.
- Superadmin: alt.

Tilgang gis etter **e-postadressen i innloggingen** (attestantregisteret), ikke etter domene. Første innlogging knytter
`bruker_id` til raden via `koble_innlogget_bruker()`.

## Kom i gang lokalt

```bash
npm install
cp .env.example .env.local   # fyll inn Supabase-URL og publishable key
npm run dev                  # http://localhost:5173
npm test                     # Vitest
npm run build
```

Prøv `http://localhost:5173/eksempel` (testorganisasjonen).

## Oppsett av Supabase

Prosjektet heter `politisk-fravaer` (region `eu-north-1`, Askeladden-organisasjonen, gratisplan).

1. **Migrasjoner:** kjør filene i `supabase/migrations/` i rekkefølge (SQL-editor eller `supabase db push`).
2. **Testdata:** kjør `supabase/seed.sql`. Den oppretter «Eksempel Ungdomsorganisasjon» (`/eksempel`) og «Annen
   Ungdomsorganisasjon» (`/annen`) og gjør `askedaln@gmail.com` til superadmin og org-admin/attestant i `eksempel`.
   Kjør **ikke** seed i et produksjonsprosjekt med ekte data: den sletter og gjenskaper organisasjonene `eksempel` og `annen`.
3. **Edge Functions:**
   ```bash
   supabase functions deploy --project-ref <ref>
   ```
   (`supabase/config.toml` slår av JWT-verifisering; funksjonene autentiserer selv.)
4. **Secrets** (Dashboard → Edge Functions → Secrets, eller `supabase secrets set`):

   | Navn | Bruk |
   |---|---|
   | `APP_URL` | Frontendens adresse, f.eks. `https://politisk-fravaer.vercel.app`. Brukes i lenker i e-post. |
   | `EMAIL_MODE` | `dev` (standard, e-post logges bare) eller `resend` |
   | `RESEND_API_KEY` | Resend API-nøkkel |
   | `EMAIL_FROM_DOMAIN` | Verifisert avsenderdomene. Avsender blir `noreply@<domene>`. |
   | `EMAIL_FROM_ADDRESS` | Valgfritt: full avsenderadresse i stedet for `noreply@<domene>` |
   | `TURNSTILE_SECRET` | Valgfritt. Uten den hoppes Turnstile over. |
   | `RATE_LIMIT_SALT` | Valgfritt tilfeldig tekst til IP-hashing |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENC_KEY` | Bare for Gmail-tillegget |

   `SUPABASE_URL`, `SUPABASE_ANON_KEY` og `SUPABASE_SERVICE_ROLE_KEY` finnes automatisk i funksjonene. Ingen hemmeligheter
   ligger i frontend-koden eller repoet.

## Innlogging (Supabase Auth)

Authentication → **URL Configuration**:

- *Site URL*: frontendens adresse (Vercel-adressen).
- *Redirect URLs*: `http://localhost:5173/**` og `https://<din-adresse>/**`.

**Innloggingslenke på e-post** virker ut av boksen. Merk at Supabases innebygde e-posttjeneste har lav grense og bare
sender til adresser i Supabase-teamet. For ekte bruk: Authentication → SMTP Settings → bruk Resend som SMTP
(`smtp.resend.com`, port 465, bruker `resend`, passord = API-nøkkel).

**Google-innlogging:**

1. Google Cloud Console → *APIs & Services* → *OAuth consent screen* (type *External*) → fyll inn appnavn og e-post.
   Scopes `openid`, `email` og `profile` krever ingen verifisering.
2. *Credentials* → *Create credentials* → *OAuth client ID* → *Web application*. Legg til *Authorized redirect URI*:
   `https://<prosjekt-ref>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google: slå på og lim inn Client ID og Client secret.

Uten dette fungerer innloggingslenke på e-post fortsatt, og Google-knappen viser en forklarende feilmelding.

## E-post (Resend)

Alle e-poster (kvittering, varsel, fraværserklæring, avslag) sendes av en Edge Function. Avsenderadressen er
`noreply@<EMAIL_FROM_DOMAIN>`, visningsnavnet er organisasjonen (for fraværserklæringer «Kari Nordmann via AUF»), og
`Reply-To` er attestantens adresse (kvitteringer: organisasjonens kontaktadresse).

**Begrensning:** uten et verifisert domene i Resend kan det bare sendes til kontoeierens egen adresse. Derfor er standard
`EMAIL_MODE=dev`: e-poster sendes ikke, men logges i `utsendinger` og vises under **Admin → Sendte e-poster**, slik at hele
flyten kan testes uten domene.

For å sende ekte e-post:

1. Opprett konto på resend.com og en API-nøkkel.
2. *Domains* → *Add domain* → legg inn DNS-postene (SPF, DKIM, helst DMARC) hos domeneregistraren og vent på «Verified».
3. Sett secrets `EMAIL_MODE=resend`, `RESEND_API_KEY` og `EMAIL_FROM_DOMAIN=<ditt domene>`.

Ønsker du ulike avsenderdomener per organisasjon senere (eget domene i Resend per organisasjon), er `avsenderAdresse()` i
`_shared/felles.ts` stedet å utvide.

## Valgfritt: Gmail fra attestantens egen konto

Av som standard. Når det er på, sendes fraværserklæringer og avslag fra attestantens egen Gmail-adresse. Hvis tilkoblingen
mangler eller feiler, faller appen tilbake til Resend (eller dev-logg). Kanalen som faktisk ble brukt vises i
**Sendte e-poster**.

1. Superadmin slår på «Tillat Gmail-utsending» for organisasjonen (`/superadmin`).
2. Google Cloud: aktiver *Gmail API*. På samme OAuth-klient som over (eller en egen), legg til redirect URI
   `https://<prosjekt-ref>.supabase.co/functions/v1/gmail-callback`.
3. Sett secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` og `TOKEN_ENC_KEY` (`openssl rand -base64 32`).
4. Attestanten kobler til under *Mine innstillinger*. Refresh-token lagres **kryptert (AES-GCM) på serveren** i
   `google_tokens` og forlater aldri serveren.

**Googles verifisering:** scopet `https://www.googleapis.com/auth/gmail.send` er *sensitivt*, og OAuth-appen er *ekstern*
(ikke en intern Workspace-app). Uverifisert virker den bare for opptil 100 testbrukere som legges inn under *OAuth consent
screen → Test users*, og de får en «Google har ikke verifisert denne appen»-advarsel. For å åpne for alle må appen
verifiseres: send inn en verifiseringsforespørsel i Google Cloud (OAuth consent screen → *Publish app* → *Prepare for
verification*) med personvernerklæring på eget domene, en forklaring av hvorfor `gmail.send` trengs og en demovideo av
flyten. Behandlingen tar typisk dager til uker.

## Cloudflare Turnstile (valgfritt)

Opprett en widget på dash.cloudflare.com → Turnstile. Sett `VITE_TURNSTILE_SITE_KEY` i frontend og `TURNSTILE_SECRET` som
Edge Function-secret. Uten nøklene hoppes sjekken over. Honeypot og rate limit (10 søknader per IP og 5 per e-post i timen)
er alltid på.

## Miljøvariabler (frontend)

| Navn | Bruk |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Publishable key (offentlig) |
| `VITE_TURNSTILE_SITE_KEY` | Valgfritt |

## Deploy til Vercel

1. Importer repoet i Vercel (rammeverk: Vite). Build: `npm run build`, output: `dist`.
2. Legg inn variablene over under *Environment Variables*.
3. `vercel.json` har SPA-rewrite, så `/<org>/…` virker ved direkte lasting.
4. Sett `APP_URL`-secret i Supabase til Vercel-adressen, og legg adressen inn under *Redirect URLs* (se Innlogging).

Starter du på `*.vercel.app`, kan eget domene legges til senere uten kodeendringer. Egne subdomener per organisasjon er ikke
bygget, men slug hentes ett sted (`useParams` i `OrgLayout`), så oppslag på hostname kan legges til der.

## Ny organisasjon

1. Logg inn som superadmin og gå til `/superadmin`.
2. **Ny organisasjon:** skriv navn, adresse (slug) og e-postadressen til første org-admin. Organisasjonen får en kopi av
   standardtekstene.
3. Den første org-admin logger inn på `/<slug>/admin`, legger inn arrangører og attestanter, kobler dem, laster opp logo og
   velger farger. Husk at en arrangør uten attestant ikke vises i søknadsskjemaet.

Superadmin legges til ved å sette inn en rad i `superadmins` (`insert into superadmins (e_post) values ('navn@…')`).

## Tester

```bash
npm test                    # Vitest: plassholdere, {tid}, PDF-generering
```

- **RLS (pgTAP):** `supabase/tests/rls.test.sql` (42 tester: anonym, attestant for annen arrangør i samme organisasjon,
  attestant i annen organisasjon, org-admin, superadmin, idempotens-sperre). Kjør med `supabase test db`, eller lim hele
  filen i SQL-editoren (alt rulles tilbake). Krever seed-dataene.
- Vitest dekker `{tid}`-formatering og plassholdere (`tests/mal.test.ts`) og PDF (`tests/pdf.test.ts`).

## Avvik og valg verdt å vite

- **Signatur lagres som PNG.** Den skrevne signaturen tegnes med Caveat i nettleseren og lagres som bilde i
  `attestanter.signatur`. Serveren trenger da ikke å bundle fonten, og PDF-en blir lik uansett hvor den lages.
- **Logo konverteres til PNG** (maks 800 px bred) ved opplasting, også SVG, fordi PDF-biblioteket bare embedder PNG/JPEG.
- **`{tid}`** lages av de strukturerte feltene: «den 12. november 2026 kl. 09.00–14.30» (samme dag) eller «fra … til …»
  (flere dager).
- Tilleggsplassholdere i e-post: `{statuslenke}`, `{soknadslenke}`, `{begrunnelse}`, `{epost}`.
