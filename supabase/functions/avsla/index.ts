// Avslår en søknad og sender begrunnelsen til søkeren.
import {
  adminKlient, avsenderNavn, feil, finnAttestant, hentSoknadSomBruker, innlogget, sendEpost, svar, tjeneste,
} from '../_shared/felles.ts'
import { fill, idagOslo, medStandard, vars } from '../_shared/mal.ts'

tjeneste(async (req) => {
  if (req.method !== 'POST') return feil(405, 'Metoden støttes ikke')
  const inn = await innlogget(req)
  if (!inn) return feil(401, 'Du må logge inn.')
  const b = await req.json().catch(() => null)
  if (!b?.soknad_id) return feil(400, 'Mangler soknad_id')
  const begrunnelse = String(b.begrunnelse ?? '').trim().slice(0, 2000)

  const admin = adminKlient()
  const funnet = await hentSoknadSomBruker(inn, admin, String(b.soknad_id))
  if (!funnet) return feil(404, 'Fant ikke søknaden, eller du har ikke tilgang.')
  const { soknad, org, arrangorNavn } = funnet
  if (soknad.status === 'sendt') return feil(409, 'Fraværserklæringen er allerede sendt og kan ikke avslås.')
  if (soknad.status === 'avslatt') return svar({ ok: true, allerede_avslatt: true })

  const att = await finnAttestant(admin, org.id, inn.bruker)
  const innst = medStandard(org.innstillinger)
  const v = vars(soknad, org, arrangorNavn, att, idagOslo(), {
    begrunnelse: begrunnelse ? `Begrunnelse: ${begrunnelse}` : '',
  })
  const ut = await sendEpost(admin, {
    orgId: org.id, gmailAktivert: org.gmail_aktivert, soknadId: soknad.id, type: 'avslag',
    til: soknad.e_post, fraNavn: avsenderNavn(att, org), replyTo: att?.e_post ?? org.kontakt_epost,
    emne: fill(innst.mail.avslag.subject, v), tekst: fill(innst.mail.avslag.body, v).replace(/\n{3,}/g, '\n\n'),
    attestantId: att?.id ?? null,
  })
  if (ut.duplikat) return svar({ ok: true, allerede_avslatt: true })
  if (!ut.ok) return feil(502, `Kunne ikke sende e-posten: ${ut.feil ?? 'ukjent feil'}`)

  await admin.from('soknader').update({
    status: 'avslatt', behandlet_av: att?.id ?? null, behandlet_tid: new Date().toISOString(),
    avslag_begrunnelse: begrunnelse || null,
  }).eq('id', soknad.id)
  return svar({ ok: true, kanal: ut.kanal })
})
