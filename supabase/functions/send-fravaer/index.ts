// Sender fraværserklæring til én eller flere søkere. Idempotent: utsendinger-tabellen har en
// unik sperre per søknad, så noe som allerede er sendt aldri sendes på nytt.
import {
  adminKlient, avsenderNavn, byggPdf, feil, finnAttestant, hentSoknadSomBruker, innlogget,
  sendEpost, svar, tjeneste,
} from '../_shared/felles.ts'
import { fill } from '../_shared/mal.ts'

type Resultat = { soknad_id: string; navn?: string; ok: boolean; allerede_sendt?: boolean; kanal?: string; feil?: string }

tjeneste(async (req) => {
  if (req.method !== 'POST') return feil(405, 'Metoden støttes ikke')
  const inn = await innlogget(req)
  if (!inn) return feil(401, 'Du må logge inn.')
  const b = await req.json().catch(() => null)
  const ider: string[] = Array.isArray(b?.soknad_ids) ? [...new Set<string>(b.soknad_ids.map(String))] : []
  if (!ider.length) return feil(400, 'Velg minst én søknad.')
  if (ider.length > 100) return feil(400, 'Du kan sende maks 100 om gangen.')

  const admin = adminKlient()
  const resultater: Resultat[] = []

  for (const id of ider) {
    const funnet = await hentSoknadSomBruker(inn, admin, id)
    if (!funnet) { resultater.push({ soknad_id: id, ok: false, feil: 'Fant ikke søknaden, eller du har ikke tilgang.' }); continue }
    const { soknad, org, arrangorNavn } = funnet
    const r: Resultat = { soknad_id: id, navn: soknad.navn, ok: false }

    if (soknad.status === 'avslatt') { resultater.push({ ...r, feil: 'Søknaden er avslått.' }); continue }
    if (soknad.status === 'sendt') { resultater.push({ ...r, ok: true, allerede_sendt: true }); continue }

    try {
      const att = await finnAttestant(admin, org.id, inn.bruker)
      const pdf = await byggPdf(admin, org, soknad, arrangorNavn, att)
      const ut = await sendEpost(admin, {
        orgId: org.id, gmailAktivert: org.gmail_aktivert, soknadId: id, type: 'fravaer',
        til: soknad.e_post, fraNavn: avsenderNavn(att, org), replyTo: att?.e_post ?? org.kontakt_epost,
        emne: fill(pdf.innst.mail.fravaer.subject, pdf.v), tekst: fill(pdf.innst.mail.fravaer.body, pdf.v),
        vedlegg: { navn: pdf.filnavn, bytes: pdf.bytes }, attestantId: att?.id ?? null,
      })
      if (ut.duplikat) { resultater.push({ ...r, ok: true, allerede_sendt: true }); continue }
      if (!ut.ok) { resultater.push({ ...r, kanal: ut.kanal, feil: ut.feil ?? 'Utsendingen feilet.' }); continue }

      await admin.from('soknader').update({
        status: 'sendt', behandlet_av: att?.id ?? null, behandlet_tid: new Date().toISOString(), avslag_begrunnelse: null,
      }).eq('id', id)
      resultater.push({ ...r, ok: true, kanal: ut.kanal })
    } catch (e) {
      console.error('send-fravaer feilet for', id, e)
      resultater.push({ ...r, feil: e instanceof Error ? e.message : 'Ukjent feil' })
    }
  }

  return svar({ resultater })
})
