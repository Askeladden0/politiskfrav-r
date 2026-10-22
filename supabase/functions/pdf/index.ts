// Forhåndsvisning og nedlasting av fraværserklæringen for innloggede attestanter.
// Valgfritt `overstyr` lar dashboardet forhåndsvise ulagrede endringer.
import {
  adminKlient, byggPdf, CORS, feil, finnAttestant, hentSoknadSomBruker, innlogget, tjeneste,
} from '../_shared/felles.ts'

const REDIGERBARE = ['navn', 'skole', 'arrangement', 'sted', 'har_vaert', 'dato_fra', 'tid_fra', 'dato_til', 'tid_til']

tjeneste(async (req) => {
  if (req.method !== 'POST') return feil(405, 'Metoden støttes ikke')
  const inn = await innlogget(req)
  if (!inn) return feil(401, 'Du må logge inn.')
  const b = await req.json().catch(() => null)
  if (!b?.soknad_id) return feil(400, 'Mangler soknad_id')

  const admin = adminKlient()
  const funnet = await hentSoknadSomBruker(inn, admin, String(b.soknad_id))
  if (!funnet) return feil(404, 'Fant ikke søknaden, eller du har ikke tilgang.')

  const soknad = { ...funnet.soknad }
  for (const k of REDIGERBARE) if (b.overstyr && k in b.overstyr) (soknad as Record<string, unknown>)[k] = b.overstyr[k]

  const att = await finnAttestant(admin, funnet.org.id, inn.bruker)
  const pdf = await byggPdf(admin, funnet.org, soknad, funnet.arrangorNavn, att)
  return new Response(pdf.bytes, {
    headers: {
      ...CORS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(pdf.filnavn)}`,
      'X-Filnavn': encodeURIComponent(pdf.filnavn),
    },
  })
})
