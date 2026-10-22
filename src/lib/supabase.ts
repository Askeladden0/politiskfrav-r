import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export class ApiFeil extends Error {
  status: number
  felter?: Record<string, string>
  constructor(status: number, melding: string, felter?: Record<string, string>) {
    super(melding)
    this.status = status
    this.felter = felter
  }
}

async function kall(navn: string, body: unknown, medInnlogging: boolean): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: ANON }
  if (medInnlogging) {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  let r: Response
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/${navn}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new ApiFeil(0, 'Fikk ikke kontakt med serveren. Sjekk nettforbindelsen og prøv igjen.')
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new ApiFeil(r.status, j.feil ?? 'Noe gikk galt. Prøv igjen.', j.felter)
  }
  return r
}

/** Kaller en edge function og returnerer JSON. */
export async function funksjon<T>(navn: string, body: unknown, medInnlogging = true): Promise<T> {
  return (await kall(navn, body, medInnlogging)).json() as Promise<T>
}

/** Kaller en edge function som returnerer en fil (PDF). */
export async function funksjonFil(navn: string, body: unknown): Promise<{ blob: Blob; filnavn: string }> {
  const r = await kall(navn, body, true)
  const filnavn = decodeURIComponent(r.headers.get('X-Filnavn') ?? 'fravaer.pdf')
  return { blob: await r.blob(), filnavn }
}

export const logoUrl = (sti?: string | null): string =>
  sti ? supabase.storage.from('logoer').getPublicUrl(sti).data.publicUrl : ''
