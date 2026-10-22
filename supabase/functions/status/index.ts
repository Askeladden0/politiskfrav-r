// Statusside for søkeren. Slår opp på hemmelig token og returnerer bare felt som er trygge å vise.
import { adminKlient, feil, svar, tjeneste } from '../_shared/felles.ts'
import { tidTekst } from '../_shared/mal.ts'

tjeneste(async (req) => {
  let token = ''
  if (req.method === 'POST') token = String((await req.json().catch(() => ({}))).token ?? '')
  else token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return feil(404, 'Fant ikke søknaden.')

  const admin = adminKlient()
  const { data: s } = await admin.from('soknader').select('*').eq('status_token', token).maybeSingle()
  if (!s) return feil(404, 'Fant ikke søknaden.')
  const [{ data: org }, { data: arr }] = await Promise.all([
    admin.from('organisasjoner').select('slug, navn, kontakt_epost, aktiv').eq('id', s.organisasjon_id).single(),
    admin.from('arrangorer').select('navn').eq('id', s.arrangor_id).single(),
  ])

  return svar({
    organisasjon: { slug: org?.slug, navn: org?.navn, kontakt_epost: org?.kontakt_epost },
    soknad: {
      navn: s.navn,
      arrangement: s.arrangement,
      arrangor: arr?.navn ?? '',
      tid: tidTekst(s),
      status: s.status,
      opprettet: s.opprettet,
      behandlet_tid: s.behandlet_tid,
      avslag_begrunnelse: s.status === 'avslatt' ? s.avslag_begrunnelse : null,
    },
  })
})
