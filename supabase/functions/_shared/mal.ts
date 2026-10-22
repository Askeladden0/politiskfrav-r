// Ren TypeScript uten avhengigheter. Brukes både av edge functions, frontend og tester.
// Logikken følger vars()/fill()/buildDoc() i fravaersmal-referanse.html.

export const MAANEDER = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
] as const

export const PLASSHOLDERE = [
  'navn', 'skole', 'arrangement', 'tid', 'sted', 'deltar', 'arrangør',
  'dato', 'attestant', 'verv', 'organisasjon', 'avsender',
] as const

export const EKSTRA_PLASSHOLDERE = ['epost', 'statuslenke', 'soknadslenke', 'begrunnelse', 'antall'] as const

export type EpostMal = { subject: string; body: string }

export type Innstillinger = {
  pageTitle: string
  intro: string
  logo: string
  logoW: number
  logoH: number
  colors: { bg: string; fg: string; accent: string }
  pdf: { title: string; body: string; greeting: string; fileName: string; showLogo: boolean }
  mail: {
    kvittering: EpostMal
    varsel: EpostMal
    fravaer: EpostMal
    avslag: EpostMal
  }
}

export const STANDARD_INNSTILLINGER: Innstillinger = {
  pageTitle: 'Politisk fravær',
  intro:
    'Har du deltatt på, eller skal du delta på, et politisk arrangement? Fyll ut skjemaet, så får du dokumentasjon på politisk fravær av en attestant.',
  logo: '',
  logoW: 0,
  logoH: 0,
  colors: { bg: '#EEF1F6', fg: '#121826', accent: '#3346D3' },
  pdf: {
    title: 'Dokumentasjon av politisk fravær',
    body:
      'Elever i videregående skole kan ha fravær fra undervisning uten at dette påvirker fraværsgrensen på 10 prosent for å få sluttvurdering i fag dersom eleven kan dokumentere at årsaken til fraværet er politisk arbeid (jf. forskrift til opplæringslova, § 3-3, siste ledd).\n\n' +
      'Det er ingen grense for hvor mange timer fravær som kan unntas dersom det er dokumentert. Elever har også krav på at inntil 10 dagers fravær i året fjernes fra vitnemålet dersom fraværet skyldes politisk arbeid (jf. forskrift til opplæringslova, § 3-47, femte ledd, bokstav c).\n\n' +
      'Politisk fravær «kan dokumenteres av en politisk organisasjon» (rundskriv Udir-3-2016).\n\n' +
      '{navn} {deltar} {arrangement} {tid} i regi av {arrangør}. Dette kan regnes som politisk arbeid etter forskriftene til opplæringslova.',
    greeting: 'Vennlig hilsen,',
    fileName: 'Politisk fravær - {navn}',
    showLogo: true,
  },
  mail: {
    kvittering: {
      subject: 'Vi har mottatt søknaden din om politisk fravær',
      body:
        'Hei {navn}!\n\nVi har mottatt søknaden din om politisk fravær for {arrangement} {tid}. En attestant fra {arrangør} behandler den så snart som mulig.\n\nDu kan følge med på statusen her:\n{statuslenke}\n\nVennlig hilsen\n{organisasjon}',
    },
    varsel: {
      subject: '{navn} har søkt om politisk fravær for {arrangement} {tid}',
      body:
        'Hei!\n\n{navn} ({skole}) har søkt om politisk fravær for {arrangement} {tid}, i regi av {arrangør}.\n\nÅpne søknaden i dashboardet:\n{soknadslenke}\n\nVennlig hilsen\n{organisasjon}',
    },
    fravaer: {
      subject: 'Dokumentasjon av politisk fravær – {arrangement}',
      body:
        'Hei {navn}!\n\nVedlagt ligger dokumentasjon på politisk fravær for {arrangement} {tid}. Lever den til kontaktlæreren din eller den som fører fravær på skolen din.\n\nTa kontakt hvis noe er uklart.\n\nVennlig hilsen\n{avsender}\n{organisasjon}',
    },
    avslag: {
      subject: 'Svar på søknaden din om politisk fravær',
      body:
        'Hei {navn}!\n\nVi kan dessverre ikke dokumentere politisk fravær for {arrangement} {tid}.\n\n{begrunnelse}\n\nTa gjerne kontakt hvis du mener dette er feil.\n\nVennlig hilsen\n{avsender}\n{organisasjon}',
    },
  },
}

// ---------------------------------------------------------------------------
// Hjelpere
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>
const erObjekt = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Slår sammen overstyrte innstillinger over standardene. Tomme strenger i mal-tekster faller tilbake til standard. */
export function medStandard(innst: unknown): Innstillinger {
  const slaaSammen = (std: unknown, ov: unknown): unknown => {
    if (!erObjekt(std)) {
      if (ov === undefined || ov === null) return std
      if (typeof std === 'string' && typeof ov === 'string' && ov.trim() === '') return std
      return ov
    }
    const ut: Rec = {}
    const o = erObjekt(ov) ? ov : {}
    for (const k of Object.keys(std)) ut[k] = slaaSammen(std[k], o[k])
    return ut
  }
  return slaaSammen(STANDARD_INNSTILLINGER, innst) as Innstillinger
}

export const fmtDato = (iso: string): string => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d}. ${MAANEDER[m - 1]} ${y}`
}

/** «09:00:00» → «09.00» */
export const fmtKlokke = (t: string): string => {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${h.padStart(2, '0')}.${(m ?? '00').padStart(2, '0')}`
}

export type TidFelt = { dato_fra: string; tid_fra: string; dato_til: string; tid_til: string }

/**
 * Lager {tid} av de strukturerte feltene.
 *  - Samme dag:  «den 12. november 2026 kl. 09.00–14.30»
 *  - Flere dager: «fra 12. november 2026 kl. 09.00 til 14. november 2026 kl. 16.00»
 *  - Ingen dato:  «den [tid]»
 */
export function tidTekst(s: Partial<TidFelt>): string {
  const fra = s.dato_fra ? fmtDato(s.dato_fra) : ''
  if (!fra) return 'den [tid]'
  const klFra = s.tid_fra ? ` kl. ${fmtKlokke(s.tid_fra)}` : ''
  const til = s.dato_til ? fmtDato(s.dato_til) : ''
  if (!til || s.dato_til!.slice(0, 10) === s.dato_fra!.slice(0, 10)) {
    const klTil = s.tid_til ? `–${fmtKlokke(s.tid_til)}` : ''
    return `den ${fra}${klFra}${klTil}`
  }
  const klTil = s.tid_til ? ` kl. ${fmtKlokke(s.tid_til)}` : ''
  return `fra ${fra}${klFra} til ${til}${klTil}`
}

export type SoknadFelt = TidFelt & {
  navn: string
  skole: string
  e_post: string
  arrangement: string
  sted?: string | null
  har_vaert: boolean
}
export type AttestantFelt = { navn?: string | null; verv?: string | null; telefon?: string | null; e_post?: string | null }
export type OrgFelt = { navn: string }

export type Ekstra = Partial<Record<(typeof EKSTRA_PLASSHOLDERE)[number], string>>

/** Dato i Europe/Oslo som ISO (åååå-mm-dd). */
export const idagOslo = (nu: Date = new Date()): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(nu)

const ph = (x: string | null | undefined, etikett: string) => (x && String(x).trim() ? String(x).trim() : `[${etikett}]`)

export function vars(
  s: Partial<SoknadFelt>,
  org: OrgFelt,
  arrangorNavn: string | null | undefined,
  att: AttestantFelt | null | undefined,
  idag: string,
  ekstra: Ekstra = {},
): Record<string, string> {
  const arr = (arrangorNavn ?? '').trim() || org.navn
  const attNavn = (att?.navn ?? '').trim()
  return {
    navn: ph(s.navn, 'Navn'),
    skole: ph(s.skole, 'skole'),
    epost: (s.e_post ?? '').trim(),
    arrangement: ph(s.arrangement, 'arrangement'),
    tid: tidTekst(s),
    sted: ph(s.sted, 'sted'),
    arrangør: arr,
    arrangor: arr,
    organisasjon: org.navn,
    deltar: s.har_vaert === false ? 'skal delta på' : 'deltok på',
    dato: fmtDato(idag),
    attestant: ph(attNavn, 'attestant'),
    verv: (att?.verv ?? '').trim(),
    avsender: attNavn || org.navn,
    statuslenke: ekstra.statuslenke ?? '',
    soknadslenke: ekstra.soknadslenke ?? '',
    begrunnelse: ekstra.begrunnelse ?? '',
    antall: ekstra.antall ?? '',
  }
}

/** Fyller {felt}. Ukjente felt blir stående urørt. Nøkler matches uavhengig av store/små bokstaver. */
export const fill = (mal: string | null | undefined, v: Record<string, string>): string =>
  String(mal ?? '').replace(/\{([^{}\s]+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(v, k.toLowerCase()) ? v[k.toLowerCase()] : m,
  )

export type Dokument = {
  title: string
  paras: string[]
  greeting: string
  date: string
  signer: string
  role: string
  contact: string
}

export function buildDoc(
  innst: Innstillinger,
  v: Record<string, string>,
  att: AttestantFelt | null | undefined,
): Dokument {
  const tlf = (att?.telefon ?? '').trim()
  const epost = (att?.e_post ?? '').trim()
  return {
    title: fill(innst.pdf.title, v),
    paras: String(innst.pdf.body || '')
      .split(/\n\s*\n/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => fill(t, v)),
    greeting: fill(innst.pdf.greeting, v),
    date: v.dato,
    signer: (att?.navn ?? '').trim() || '[Navn på attestant]',
    role: [(att?.verv ?? '').trim(), v['arrangør']].filter(Boolean).join(', '),
    contact: [tlf && `Tlf: ${tlf}`, epost && `E-post: ${epost}`].filter(Boolean).join(', '),
  }
}

export const filnavn = (innst: Innstillinger, v: Record<string, string>): string =>
  (fill(innst.pdf.fileName || 'Politisk fravær - {navn}', v).replace(/[\\/:*?"<>|]/g, '').trim() || 'Fravær') + '.pdf'

/** Visningsnavn for avsender: «Kari Nordmann via AUF», eller bare organisasjonsnavnet. */
export const avsenderNavn = (att: AttestantFelt | null | undefined, org: OrgFelt): string =>
  att?.navn?.trim() ? `${att.navn.trim()} via ${org.navn}` : org.navn

export const EPOST_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const RESERVERTE_SLUGS = [
  'superadmin', 'logg-inn', 'ingen-tilgang', 'api', 'assets', 'status', 'admin',
  'attestant', 'kvittering', 'auth', 'static', 'favicon',
]
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
