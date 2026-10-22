export type OrgProfil = {
  id: string
  slug: string
  navn: string
  kontakt_epost: string | null
  profil: {
    pageTitle?: string
    intro?: string
    logo?: string
    logoW?: number
    logoH?: number
    colors?: { bg?: string; fg?: string; accent?: string }
  }
  arrangorer: { id: string; navn: string }[]
}

export type MinOrg = { slug: string; navn: string; rolle: 'attestant' | 'admin' | 'superadmin' }

export type Signatur = { modus: 'tekst' | 'tegnet' | 'bilde'; tekst?: string; src: string; w: number; h: number }

export type Attestant = {
  id: string
  organisasjon_id: string
  bruker_id: string | null
  e_post: string
  navn: string | null
  verv: string | null
  telefon: string | null
  signatur: Signatur | null
  rolle: 'attestant' | 'admin'
}

export type Arrangor = { id: string; organisasjon_id: string; navn: string; aktiv: boolean }

export type SoknadStatus = 'venter' | 'sendt' | 'avslatt'

export type Soknad = {
  id: string
  organisasjon_id: string
  arrangor_id: string
  navn: string
  skole: string
  e_post: string
  telefon: string | null
  type_arrangement: 'skolebesok' | 'mote' | 'konferanse' | 'annet'
  arrangement: string
  har_vaert: boolean
  dato_fra: string
  tid_fra: string
  dato_til: string
  tid_til: string
  sted: string | null
  kommentar: string | null
  status: SoknadStatus
  behandlet_av: string | null
  behandlet_tid: string | null
  avslag_begrunnelse: string | null
  opprettet: string
  arrangorer?: { navn: string } | null
}

export type Utsending = {
  id: string
  soknad_id: string | null
  type: 'kvittering' | 'varsel' | 'fravaer' | 'avslag'
  mottaker: string
  avsender: string | null
  kanal: 'resend' | 'gmail' | 'dev'
  status: 'sender' | 'sendt' | 'feilet'
  emne: string | null
  tekst: string | null
  vedlegg: string | null
  feil: string | null
  opprettet: string
}

export const TYPE_ETIKETT: Record<Soknad['type_arrangement'], string> = {
  skolebesok: 'Skolebesøk',
  mote: 'Møte',
  konferanse: 'Konferanse',
  annet: 'Annet',
}
export const STATUS_ETIKETT: Record<SoknadStatus, string> = {
  venter: 'Venter',
  sendt: 'Sendt',
  avslatt: 'Avslått',
}
