// Felles hjelpekode for edge functions: klienter, autentisering, e-post (Resend/Gmail/dev) og PDF-bygging.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import {
  avsenderNavn, buildDoc, filnavn, medStandard, vars, idagOslo,
  type AttestantFelt, type Ekstra, type Innstillinger,
} from './mal.ts'
import { dataUrlTilBilde, lagFravaerPdf } from './pdf.ts'

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Filnavn',
}

export const svar = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

export const feil = (status: number, melding: string, ekstra: Record<string, unknown> = {}): Response =>
  svar({ feil: melding, ...ekstra }, status)

export function tjeneste(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    try {
      return await handler(req)
    } catch (e) {
      console.error('Uventet feil', e)
      return feil(500, 'Noe gikk galt hos oss. Prøv igjen om litt.')
    }
  })
}

export const env = (navn: string, standard = ''): string => Deno.env.get(navn) ?? standard
export const appUrl = (): string => env('APP_URL', 'http://localhost:5173').replace(/\/+$/, '')

// ---------------------------------------------------------------------------
// Supabase-klienter og autentisering
// ---------------------------------------------------------------------------

export const adminKlient = (): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

export type Innlogget = { klient: SupabaseClient; bruker: User }

/** Klient som handler som innlogget bruker (RLS gjelder). Null hvis ikke innlogget. */
export async function innlogget(req: Request): Promise<Innlogget | null> {
  const auth = req.headers.get('Authorization')
  if (!auth) return null
  const klient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data, error } = await klient.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
  if (error || !data.user) return null
  return { klient, bruker: data.user }
}

export type AttestantRad = AttestantFelt & { id: string; organisasjon_id: string; rolle: string; signatur: SignaturData | null }
export type SignaturData = { modus?: string; tekst?: string; src?: string; w?: number; h?: number }

export async function finnAttestant(admin: SupabaseClient, orgId: string, bruker: User): Promise<AttestantRad | null> {
  const epost = (bruker.email ?? '').toLowerCase()
  const { data } = await admin.from('attestanter').select('*').eq('organisasjon_id', orgId)
  const rad = (data ?? []).find((a) => a.bruker_id === bruker.id || (epost && a.e_post === epost))
  return (rad as AttestantRad) ?? null
}

export type OrgRad = { id: string; slug: string; navn: string; kontakt_epost: string | null; innstillinger: unknown; gmail_aktivert: boolean }
export type SoknadRad = Record<string, any> & { id: string; organisasjon_id: string; arrangor_id: string; status: string }

/** Henter søknaden slik innlogget bruker ser den (RLS), og deretter organisasjon og arrangør med admin-klient. */
export async function hentSoknadSomBruker(inn: Innlogget, admin: SupabaseClient, id: string) {
  const { data: s } = await inn.klient.from('soknader').select('*').eq('id', id).maybeSingle()
  if (!s) return null
  const { data: org } = await admin.from('organisasjoner').select('*').eq('id', s.organisasjon_id).single()
  const { data: arr } = await admin.from('arrangorer').select('navn').eq('id', s.arrangor_id).single()
  return { soknad: s as SoknadRad, org: org as OrgRad, arrangorNavn: (arr?.navn ?? '') as string }
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function byggPdf(
  admin: SupabaseClient,
  org: OrgRad,
  soknad: Partial<SoknadRad>,
  arrangorNavn: string,
  att: AttestantRad | null,
  ekstra: Ekstra = {},
): Promise<{ bytes: Uint8Array; filnavn: string; innst: Innstillinger; v: Record<string, string> }> {
  const innst = medStandard(org.innstillinger)
  const v = vars(soknad, org, arrangorNavn, att, idagOslo(), ekstra)
  const doc = buildDoc(innst, v, att)

  let logo = null
  if (innst.pdf.showLogo && innst.logo && innst.logoW > 0) {
    const { data } = await admin.storage.from('logoer').download(innst.logo)
    if (data) logo = { bytes: new Uint8Array(await data.arrayBuffer()), w: innst.logoW, h: innst.logoH }
  }
  const sig = att?.signatur
  const signatur = sig?.src ? dataUrlTilBilde(sig.src, sig.w ?? 0, sig.h ?? 0) : null

  const bytes = await lagFravaerPdf({ doc, orgNavn: org.navn, logo, visLogo: innst.pdf.showLogo, signatur })
  return { bytes, filnavn: filnavn(innst, v), innst, v }
}

// ---------------------------------------------------------------------------
// Kryptering av tokens (AES-GCM, nøkkel i TOKEN_ENC_KEY som base64 av 32 byte)
// ---------------------------------------------------------------------------

const b64 = (b: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}
const fraB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
export const base64url = (b: Uint8Array): string => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function krypteringsnokkel(): Promise<CryptoKey> {
  const raa = env('TOKEN_ENC_KEY')
  if (!raa) throw new Error('TOKEN_ENC_KEY er ikke satt')
  return crypto.subtle.importKey('raw', fraB64(raa), 'AES-GCM', false, ['encrypt', 'decrypt'])
}
export async function krypter(klartekst: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await krypteringsnokkel(), new TextEncoder().encode(klartekst)))
  return `${b64(iv)}.${b64(ct)}`
}
export async function dekrypter(verdi: string): Promise<string> {
  const [iv, ct] = verdi.split('.')
  const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fraB64(iv) }, await krypteringsnokkel(), fraB64(ct))
  return new TextDecoder().decode(klar)
}

export async function signer(data: string): Promise<string> {
  const nokkel = await crypto.subtle.importKey('raw', fraB64(env('TOKEN_ENC_KEY')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', nokkel, new TextEncoder().encode(data))))
}

// ---------------------------------------------------------------------------
// E-post
// ---------------------------------------------------------------------------

export type EpostInn = {
  orgId: string
  gmailAktivert: boolean
  soknadId: string | null
  type: 'kvittering' | 'varsel' | 'fravaer' | 'avslag'
  til: string
  fraNavn: string
  replyTo?: string | null
  emne: string
  tekst: string
  vedlegg?: { navn: string; bytes: Uint8Array } | null
  /** Attestanten som sender. Gmail brukes bare når denne har koblet til Gmail. */
  attestantId?: string | null
}
export type EpostUt = { ok: boolean; kanal?: string; feil?: string; duplikat?: boolean }

const rens = (s: string) => s.replace(/[\r\n"<>]/g, ' ').trim()
export const avsenderAdresse = (): string => env('EMAIL_FROM_ADDRESS') || `noreply@${env('EMAIL_FROM_DOMAIN', 'example.invalid')}`

async function sendViaResend(e: EpostInn): Promise<string> {
  const nokkel = env('RESEND_API_KEY')
  if (!nokkel) throw new Error('RESEND_API_KEY er ikke satt')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${nokkel}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `"${rens(e.fraNavn)}" <${avsenderAdresse()}>`,
      to: [e.til],
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      subject: e.emne,
      text: e.tekst,
      ...(e.vedlegg ? { attachments: [{ filename: e.vedlegg.navn, content: b64(e.vedlegg.bytes) }] } : {}),
    }),
  })
  const svarTekst = await r.text()
  if (!r.ok) throw new Error(`Resend ${r.status}: ${svarTekst.slice(0, 300)}`)
  try { return JSON.parse(svarTekst).id ?? '' } catch { return '' }
}

async function gmailTilgangstoken(refresh: string): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (!r.ok || !j.access_token) throw new Error(`Google-token: ${j.error_description ?? j.error ?? r.status}`)
  return j.access_token
}

const mimeTekst = (s: string) => `=?UTF-8?B?${b64(new TextEncoder().encode(s))}?=`
const linjer76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')

async function sendViaGmail(admin: SupabaseClient, e: EpostInn): Promise<string> {
  if (!e.attestantId) throw new Error('Ingen attestant')
  const { data: tok } = await admin.from('google_tokens').select('*').eq('attestant_id', e.attestantId).maybeSingle()
  if (!tok) throw new Error('Gmail er ikke koblet til')
  const access = await gmailTilgangstoken(await dekrypter(tok.refresh_token_kryptert))
  const grense = `grense_${crypto.randomUUID()}`
  const deler = [
    `From: ${mimeTekst(rens(e.fraNavn))} <${tok.google_epost}>`,
    `To: ${e.til}`,
    ...(e.replyTo ? [`Reply-To: ${e.replyTo}`] : []),
    `Subject: ${mimeTekst(e.emne)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${grense}"`,
    '',
    `--${grense}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    linjer76(b64(new TextEncoder().encode(e.tekst))),
    ...(e.vedlegg
      ? [
          `--${grense}`,
          `Content-Type: application/pdf; name="${mimeTekst(e.vedlegg.navn)}"`,
          `Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(e.vedlegg.navn)}`,
          'Content-Transfer-Encoding: base64',
          '',
          linjer76(b64(e.vedlegg.bytes)),
        ]
      : []),
    `--${grense}--`,
  ]
  const raw = base64url(new TextEncoder().encode(deler.join('\r\n')))
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j.id ?? ''
}

/**
 * Sender én e-post og logger den i `utsendinger`.
 * For fraværserklæring og avslag reserveres raden først (unik indeks), så samme søknad aldri
 * får to utsendinger selv om to forespørsler kommer samtidig.
 *
 * Kanal: Gmail (hvis aktivert for organisasjonen og attestanten har koblet til) → Resend → dev-logg.
 * Feiler Gmail, faller vi tilbake til Resend/dev, og loggen viser hvilken kanal som faktisk ble brukt.
 */
export async function sendEpost(admin: SupabaseClient, e: EpostInn): Promise<EpostUt> {
  const resendModus = env('EMAIL_MODE', 'dev') === 'resend'
  let planlagt: 'gmail' | 'resend' | 'dev' = resendModus ? 'resend' : 'dev'
  const vilBrukeGmail = e.gmailAktivert && !!e.attestantId && (e.type === 'fravaer' || e.type === 'avslag') && !!env('GOOGLE_CLIENT_ID')
  if (vilBrukeGmail) {
    const { data } = await admin.from('google_tokens').select('attestant_id').eq('attestant_id', e.attestantId!).maybeSingle()
    if (data) planlagt = 'gmail'
  }

  const { data: rad, error: insFeil } = await admin.from('utsendinger').insert({
    organisasjon_id: e.orgId, soknad_id: e.soknadId, type: e.type, mottaker: e.til,
    avsender: e.fraNavn, kanal: planlagt, status: 'sender', emne: e.emne, tekst: e.tekst,
    vedlegg: e.vedlegg?.navn ?? null, sendt_av: e.attestantId ?? null,
  }).select('id').single()
  if (insFeil) {
    if (insFeil.code === '23505') return { ok: false, duplikat: true }
    return { ok: false, feil: insFeil.message }
  }

  const fullfor = async (kanal: string, status: 'sendt' | 'feilet', ekstern: string | null, feilmelding: string | null) => {
    await admin.from('utsendinger').update({ kanal, status, ekstern_id: ekstern, feil: feilmelding }).eq('id', rad.id)
  }

  let kanal = planlagt
  let gmailFeil: string | null = null
  try {
    if (kanal === 'gmail') {
      try {
        const id = await sendViaGmail(admin, e)
        await fullfor('gmail', 'sendt', id, null)
        return { ok: true, kanal: 'gmail' }
      } catch (ge) {
        gmailFeil = ge instanceof Error ? ge.message : String(ge)
        console.error('Gmail feilet, faller tilbake', gmailFeil)
        kanal = resendModus ? 'resend' : 'dev'
      }
    }
    if (kanal === 'resend') {
      const id = await sendViaResend(e)
      await fullfor('resend', 'sendt', id, gmailFeil ? `Gmail feilet (${gmailFeil}); sendt via Resend` : null)
      return { ok: true, kanal: 'resend' }
    }
    console.log(`[dev-epost] til=${e.til} emne=${e.emne}`)
    await fullfor('dev', 'sendt', null, gmailFeil ? `Gmail feilet (${gmailFeil}); logget i dev` : null)
    return { ok: true, kanal: 'dev' }
  } catch (err) {
    const melding = err instanceof Error ? err.message : String(err)
    await fullfor(kanal, 'feilet', null, melding)
    return { ok: false, kanal, feil: melding }
  }
}

export { avsenderNavn }
