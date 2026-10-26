# Claude Design-prompt: Politisk fravær

Lim inn alt under streken i Claude Design.

---

## Oppdraget

Design en klikkbar prototype av **Politisk fravær**: en nettjeneste der ungdoms- og elevorganisasjoner dokumenterer politisk fravær for elever i videregående skole. Lag både mobil (390 px) og desktop (1440 px). Alt innhold skal være på **bokmål**.

Bakgrunn: Elever som er tillitsvalgte, kan få fravær fra politisk arbeid unntatt fra fraværsgrensen. Inntil 10 dager i året kan også fjernes fra vitnemålet. Fraværet må dokumenteres av en politisk organisasjon. I dag skriver noen i organisasjonen en erklæring for hånd til hver elev. Tjenesten gjør dette på minutter.

Tjenesten skal løfte tre parter:
- **Eleven** trenger et gyldig dokument raskt og uten styr.
- **Organisasjonen** trenger en rask og trygg måte å bekrefte at eleven deltok.
- **Skolen** trenger å kunne stole på dokumentet.

## Hvem som bruker den

| Rolle | Situasjon | Behov |
|---|---|---|
| **Elev** (16–19 år) | På mobil, ofte rett etter eller under et arrangement. Bruker tjenesten noen ganger i året. Ingen innlogging. | Ferdig på under ett minutt. Vite hva som skjer videre. |
| **Den som bekrefter** (attestant, f.eks. fylkesleder) | Frivillig med lite tid. Bruker mobil på arrangementet og PC etterpå. | Godkjenne mange på én gang. Ikke drukne i e-post. |
| **Org-admin** | Setter opp organisasjonen én gang og justerer av og til. | Komme i gang uten teknisk hjelp. Se resultatet mens hen redigerer. |
| **Skolen** (kontaktlærer, fraværsfører) | Får en PDF fra eleven. | Kunne sjekke at dokumentet er ekte. |
| **Plattformeier** (superadmin) | Tar inn nye organisasjoner. | Oversikt og enkel oppstart. |

I grensesnittet heter attestanten **«den som bekrefter»** eller «attestant» der det er naturlig. Bruk klarspråk, og unngå byråkratiske ord.

## Visuell retning

- **To lag med profil:** Plattformen har en nøktern og tillitvekkende profil, som en offentlig tjeneste med varme. Hver organisasjon setter sin egen logo, bakgrunnsfarge, tekstfarge og aksentfarge på sine sider. Design med fargevariabler (design tokens), og vis at det fungerer med **to fiktive organisasjoner** med svært ulike farger:
  - «Eksempel Ungdomsorganisasjon»: dyp blå aksent på lys gråblå bakgrunn
  - «Grønn Fremtid Ungdom»: grønn aksent på varm offwhite bakgrunn
  Bruk ikke navn, logoer eller farger fra ekte organisasjoner.
- **Typografi:** Store, selvsikre overskrifter (fet, tett linjeavstand) og lettlest brødtekst på 16–18 px. Én skrift med god støtte for æ, ø og å.
- **Universell utforming (WCAG 2.1 AA):**
  - kontrast på minst 4,5:1
  - trykkflater på minst 44 px
  - synlig fokus
  - feilmeldinger i tekst, ikke bare som farge
  - etikett på alle felt
- **Kontrast:** Vis at teksten på knapper og lenker justeres automatisk når org-fargen er for lys.
- **Tone:** Vennlig og direkte. Bruk «du». Korte setninger.

## Skjermbilder

### A. Eleven (mobil først)

**A1. Påmelding via QR** (`/eksempel/a/k7m2x9pq`) – hovedflyten
- Organisasjonens logo og navn øverst.
- Et kort med arrangementet: «Skolebesøk på Eksempel vgs», fredag 13. november kl. 09.00–14.30, Eksempel vgs, aula. Arrangør: Oslo fylkeslag.
- Bare tre felt: **Navn, Skole, E-post**, pluss telefon som valgfritt felt. Feltene er forhåndsutfylt hvis eleven har brukt tjenesten før, med teksten «Ikke deg? Tøm feltene».
- Avkrysning: «Send kopi direkte til skolen» med et felt for skolens e-postadresse (valgfritt).
- Én stor knapp: **Meld meg på**.
- Tilstander: påmeldingen er stengt (med lenke til vanlig søknad), du er allerede påmeldt, og feil i et felt.

**A2. Vanlig søknad** (`/eksempel`) – for arrangementer som ikke er registrert
- Om deg: navn, skole, e-post og telefon (valgfritt).
- Arrangementet:
  - arrangør (nedtrekksliste over fylkeslag og lokallag)
  - type (skolebesøk, møte, konferanse, annet)
  - navn på arrangementet
  - valg mellom «Har vært» og «Skal være»
  - fra og til (dato og klokkeslett)
  - sted
- Kommentar til den som bekrefter (valgfritt).
- Valget «Send kopi til skolen».
- Vis feilmeldinger slik de ser ut på norsk.

**A3. Kvittering**
- Overskrift: «Du er påmeldt» eller «Søknaden er sendt».
- Hva skjer nå, som en tidslinje i tre steg: Mottatt → Bekreftes av Oslo fylkeslag → PDF på e-post. Vanligvis innen 2 dager.
- Lenke til statussiden og en melding om at kvitteringen også er sendt på e-post.

**A4. Status** (hemmelig lenke, uten innlogging)
- Tre varianter: venter, sendt (med knapp for å laste ned PDF-en på nytt), avslått (med begrunnelse og kontaktadresse).

**A5. Mine fravær** (eleven får en innloggingslenke på e-post, ingen passord)
- Liste over alle erklæringer dette skoleåret, på tvers av organisasjoner.
- En tydelig teller: «6 av 10 dager kan fjernes fra vitnemålet». Vis den som en fremdriftsindikator, med en forklaring om at grensen gjelder vitnemålet og ikke fraværsgrensen.
- Last ned hver PDF, eller alle samlet.

### B. Den som bekrefter (mobil og desktop)

**B1. Innboks** (`/eksempel/attestant`)
- Faner: Venter (12), Sendt, Avslått, Alle.
- På mobil: kort som kan godkjennes med én knapp hver. På desktop: tabell med avkrysning, «velg alle», søk og filter på arrangør, arrangement og dato.
- Merkelapp på søknader som kom fra et arrangement.
- Handlingslinje som vises når noe er valgt: **Send fravær (5)** og **Avslå**.

**B2. Søknadsdetalj** (sidepanel på desktop, egen side på mobil)
- Alle opplysninger og en forhåndsvisning av PDF-en til høyre.
- Knapper: Send fravær, Rediger, Avslå (med valgfri begrunnelse).
- Historikk: mottatt, redigert av Kari, sendt.

**B3. Arrangementer** – oversikt
- Kommende og tidligere arrangementer som kort, med «23 påmeldt · 0 møtt».
- Knapp for nytt arrangement.

**B4. Nytt arrangement**
- Navn, type, arrangør, fra og til, sted.
- Valg: påmeldingen stenger automatisk 24 timer etter slutt.

**B5. Arrangementsdetalj** – kjernen i det nye. Fire deler:
1. **Del:** stor QR-kode, kort lenke med kopier-knapp, «Last ned QR (PNG)» og **Vis på storskjerm**.
2. **Deltakere:** liste med store knapper for **Møtt / Ikke møtt** per person. Knappen «Merk alle som møtt», tellere (23 påmeldt · 19 møtt · 2 ikke møtt · 2 ikke registrert) og «Legg til deltaker manuelt».
3. **Send:** fast knapp nederst: **Send fravær til 19 som møtte**.
4. **Avslutt arrangement:** de som ikke møtte avslås med en standard begrunnelse. Attestanten kan krysse av for om det skal sendes e-post.

**B6. Storskjermvisning**
- Fullskjerm i liggende format: arrangementets navn, en gigantisk QR-kode, lenken i stor tekst og en levende teller: «17 påmeldt».

**B7. Bekreftelse før masseutsending**
- Dialog: «Du sender 19 fraværserklæringer som Kari Nordmann, fylkesleder. Svar går til kari@eksempel.no.»
- Advarsel hvis attestanten ikke har lagt inn signatur.
- Fremdrift og resultat per mottaker. Viser «allerede sendt (ikke sendt på nytt)» der det gjelder.

**B8. Mine innstillinger**
- Navn, verv og telefon.
- Signatur: tre faner (skriv navnet ditt med håndskriftfont, tegn med fingeren, last opp bilde). Signaturen vises i en forhåndsvisning på en mini-PDF.

### C. Org-admin

**C1. Oppsettsveiviser** (første innlogging) – fem steg med fremdrift:
1. Logo og farger, med live forhåndsvisning av søknadssiden på mobil ved siden av
2. Lokallag og fylkeslag, som et tre (sentralledd → fylkeslag → lokallag)
3. Inviter de som skal bekrefte (e-postadresser, og velg hvilke enheter hver av dem har ansvar for)
4. Se over teksten i erklæringen
5. Send en testsøknad til deg selv

**C2. Administrasjon** (etter oppsettet), med disse fanene:
- Enheter (tre med dra og slipp)
- Personer og roller (invitert, aktiv, deaktivert, og «Send invitasjon på nytt»)
- Profil
- Maltekster
- Sendte e-poster
- Statistikk
- Personvern

**C3. Maltekster**
- Redigering til venstre og live forhåndsvisning til høyre (PDF eller e-post).
- Plassholdere som brikker som kan settes inn: {navn}, {skole}, {arrangement}, {tid}, {sted}, {deltar}, {arrangør}, {dato}, {attestant}, {verv}, {organisasjon}.
- Knappen «Tilbakestill til standard».

**C4. Statistikk**
- Antall erklæringer per måned, behandlingstid i snitt og aktivitet per fylkeslag. Enkelt og lesbart.

**C5. Personvern**
- Hvor lenge data lagres (standard 18 måneder, deretter automatisk sletting), med en nedtelling til neste sletting.
- Lenke til databehandleravtalen og revisjonslogg (hvem gjorde hva, og når).

### D. Skolen

**D1. Verifisering** (`/v/K7M2-X9PQ`, nås via QR-koden på PDF-en)
- Grønt kort: «Dokumentet er ekte». Viser elevens navn, arrangementet, tid, organisasjon og hvem som bekreftet, og når.
- Variant for ugyldig eller tilbaketrukket dokument.
- Kort forklaring av regelverket for skolen.
- Ingen innlogging, og bare det som står på PDF-en vises.

### E. Plattform

**E1. Forside** (`/`)
- Hva tjenesten er, i én setning, og «Finn organisasjonen din» med søk.
- En seksjon for organisasjoner som vil ta tjenesten i bruk: fordeler, hvordan det fungerer i tre steg, og en kontaktknapp.

**E2. Logg inn**
- Innloggingslenke på e-post, Google og Microsoft.
- Tilstand for «du har ikke tilgang», med forklaring.

**E3. Superadmin**
- Liste over organisasjoner med status.
- «Ny organisasjon»: navn, adresse og første admin.

### F. Fraværserklæringen (PDF, A4)

- Logo øverst til venstre og dato øverst til høyre.
- Tittel: «Dokumentasjon av politisk fravær».
- Lovhenvisninger: forskrift til opplæringslova § 3-3 siste ledd og § 3-47 femte ledd bokstav c, rundskriv Udir-3-2016.
- Hovedavsnitt: «Ola Nordmann deltok på Skolebesøk på Eksempel vgs den 13. november 2026 kl. 09.00–14.30 i regi av Oslo fylkeslag. Dette kan regnes som politisk arbeid …»
- Hilsen, håndskrevet signatur, navn, verv, arrangør og kontaktinfo.
- **Nytt:** QR-kode og verifiseringskode nederst til høyre: «Sjekk at dokumentet er ekte: politiskfravaer.no/v/K7M2-X9PQ».

### G. E-poster (vis to)

- **Kvittering til eleven:** kort, med statuslenke.
- **Daglig sammendrag til den som bekrefter:** «3 nye søknader og 1 arrangement venter på avkrysning», med knapp til innboksen. Erstatter én e-post per søknad.

## Tilstander som skal vises

For de viktigste skjermene: tom tilstand (f.eks. «Ingen søknader venter. Godt jobbet!»), lasting, feil og suksess. Vis også påmelding når nettet er dårlig, med beskjeden «Vi prøver igjen …».

## Eksempeldata

Bruk fiktive, realistiske norske navn og skoler, for eksempel Ola Nordmann, Sara Ahmed, Jonas Berg, Eksempel vgs og Fjordbyen vgs. Fylkeslagene heter for eksempel Oslo fylkeslag, Vestland fylkeslag og Trøndelag fylkeslag. Bruk datoer i november 2026.

## Leveranse

1. Klikkbar prototype med disse to hovedflytene:
   - **QR-flyten:** opprett arrangement → storskjerm → elev melder seg på (mobil) → kryss av oppmøte → send → elev får PDF → skolen verifiserer
   - **Søknadsflyten:** vanlig søknad → innboks → detalj → send
2. Alle skjermbilder over, både på mobil og desktop der det er relevant. Storskjerm og PDF lages bare i sitt eget format.
3. En liten komponentoversikt: knapper, felt, statusmerker, kort, avkrysning for oppmøte, fremdriftsteller og dialoger. Vis dem med begge organisasjonsprofilene.

Prioriter A1, B5, B6, B7, D1 og F hvis du må velge. De viser det som er nytt.
