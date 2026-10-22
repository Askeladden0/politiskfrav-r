// OAuth-retur fra Google. Lagrer refresh-token kryptert på serveren (aldri i nettleseren).
// Deployes med verify_jwt=false fordi Google kaller denne direkte; `state` er signert med HMAC.
import { adminKlient, appUrl, env, krypter, signer, tjeneste } from '../_shared/felles.ts'

const tilbake = (slug: string | null, status: string) =>
  Response.redirect(`${appUrl()}/${slug ?? ''}/attestant/innstillinger?gmail=${status}`, 302)

tjeneste(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''
  const [nyttelast, sig] = state.split('.')
  if (!code || !nyttelast || !sig || (await signer(nyttelast)) !== sig) return tilbake(null, 'feil')

  let data: { a: string; s: string; t: number }
  try {
    const bin = atob(nyttelast.replace(/-/g, '+').replace(/_/g, '/'))
    data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
  } catch { return tilbake(null, 'feil') }
  if (Date.now() - data.t > 15 * 60_000) return tilbake(data.s, 'feil')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: `${env('SUPABASE_URL')}/functions/v1/gmail-callback`, grant_type: 'authorization_code',
    }),
  })
  const j = await r.json()
  if (!r.ok || !j.refresh_token) {
    console.error('Google-token-utveksling feilet', j.error)
    return tilbake(data.s, 'feil')
  }
  let googleEpost: string | null = null
  try {
    const payload = JSON.parse(atob(String(j.id_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    googleEpost = payload.email ?? null
  } catch { /* uten e-post kan vi ikke sende */ }
  if (!googleEpost) return tilbake(data.s, 'feil')

  await adminKlient().from('google_tokens').upsert({
    attestant_id: data.a, refresh_token_kryptert: await krypter(j.refresh_token), google_epost: googleEpost,
  })
  return tilbake(data.s, 'ok')
})
