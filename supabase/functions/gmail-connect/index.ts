// Valgfritt Gmail-tillegg (bak flagg per organisasjon). Starter OAuth, kobler fra og viser status.
// handling: 'status' | 'start' | 'koble_fra'
import {
  adminKlient, base64url, env, feil, finnAttestant, innlogget, signer, svar, tjeneste,
} from '../_shared/felles.ts'

tjeneste(async (req) => {
  if (req.method !== 'POST') return feil(405, 'Metoden støttes ikke')
  const inn = await innlogget(req)
  if (!inn) return feil(401, 'Du må logge inn.')
  const b = await req.json().catch(() => null)
  const slug = String(b?.org_slug ?? '').toLowerCase()
  const handling = String(b?.handling ?? 'status')

  const admin = adminKlient()
  const { data: org } = await admin.from('organisasjoner').select('id, slug, gmail_aktivert').eq('slug', slug).maybeSingle()
  if (!org) return feil(404, 'Fant ikke organisasjonen.')
  const att = await finnAttestant(admin, org.id, inn.bruker)
  if (!att) return feil(403, 'Du er ikke attestant i denne organisasjonen.')

  const konfigurert = !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && env('TOKEN_ENC_KEY'))
  const { data: tok } = await admin.from('google_tokens').select('google_epost').eq('attestant_id', att.id).maybeSingle()

  if (handling === 'status') {
    return svar({ tilgjengelig: org.gmail_aktivert && konfigurert, tilkoblet: !!tok, google_epost: tok?.google_epost ?? null })
  }
  if (!org.gmail_aktivert || !konfigurert) return feil(403, 'Gmail er ikke slått på for denne organisasjonen.')

  if (handling === 'koble_fra') {
    await admin.from('google_tokens').delete().eq('attestant_id', att.id)
    return svar({ ok: true })
  }
  if (handling !== 'start') return feil(400, 'Ukjent handling')

  const nyttelast = base64url(new TextEncoder().encode(JSON.stringify({ a: att.id, s: org.slug, t: Date.now() })))
  const state = `${nyttelast}.${await signer(nyttelast)}`
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: `${env('SUPABASE_URL')}/functions/v1/gmail-callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send openid email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return svar({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
})
