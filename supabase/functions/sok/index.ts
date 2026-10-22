// Mottar en søknad fra det offentlige skjemaet. Ingen innlogging.
import { adminKlient, appUrl, env, feil, sendEpost, svar, tjeneste } from '../_shared/felles.ts'
import { EPOST_RE, fill, idagOslo, medStandard, vars } from '../_shared/mal.ts'

const TYPER = ['skolebesok', 'mote', 'konferanse', 'annet']
const DATO = /^\d{4}-\d{2}-\d{2}$/
const KLOKKE = /^([01]\d|2[0-3]):[0-5]\d$/
const STYKKER_PER_TIME = { ip: 10, epost: 5 }

const tekst = (v: unknown, maks: number): string =>
  String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, maks)

async function sha256(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function turnstileOk(token: string, ip: string): Promise<boolean> {
  const hemmelighet = env('TURNSTILE_SECRET')
  if (!hemmelighet) return true // ikke konfigurert: hoppes over
  if (!token) return false
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: hemmelighet, response: token, remoteip: ip }),
  })
  const j = await r.json().catch(() => ({}))
  return !!j.success
}

tjeneste(async (req) => {
  if (req.method !== 'POST') return feil(405, 'Metoden støttes ikke')
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== 'object') return feil(400, 'Ugyldig forespørsel')

  // Honeypot: roboter fyller ut skjulte felt. Vi later som alt gikk bra.
  if (tekst(b.nettside, 200)) return svar({ id: crypto.randomUUID(), status_token: crypto.randomUUID() })

  const felter: Record<string, string> = {}
  const navn = tekst(b.navn, 120)
  const skole = tekst(b.skole, 160)
  const epost = tekst(b.e_post, 200).toLowerCase()
  const telefon = tekst(b.telefon, 40) || null
  const arrangement = tekst(b.arrangement, 200)
  const sted = tekst(b.sted, 160) || null
  const kommentar = tekst(b.kommentar, 2000) || null
  const type = tekst(b.type_arrangement, 20)
  const arrangorId = tekst(b.arrangor_id, 40)
  const dFra = tekst(b.dato_fra, 10), tFra = tekst(b.tid_fra, 5), dTil = tekst(b.dato_til, 10), tTil = tekst(b.tid_til, 5)
  if (!navn) felter.navn = 'Skriv inn navnet ditt.'
  if (!skole) felter.skole = 'Skriv inn skolen din.'
  if (!EPOST_RE.test(epost)) felter.e_post = 'Skriv inn en gyldig e-postadresse.'
  if (!arrangorId) felter.arrangor_id = 'Velg arrangør.'
  if (!TYPER.includes(type)) felter.type_arrangement = 'Velg type arrangement.'
  if (!arrangement) felter.arrangement = 'Skriv inn navn eller beskrivelse av arrangementet.'
  if (!DATO.test(dFra)) felter.dato_fra = 'Velg startdato.'
  if (!KLOKKE.test(tFra)) felter.tid_fra = 'Skriv inn starttidspunkt.'
  if (!DATO.test(dTil)) felter.dato_til = 'Velg sluttdato.'
  if (!KLOKKE.test(tTil)) felter.tid_til = 'Skriv inn sluttidspunkt.'
  if (typeof b.har_vaert !== 'boolean') felter.har_vaert = 'Velg om arrangementet har vært eller skal være.'
  if (!felter.dato_fra && !felter.tid_fra && !felter.dato_til && !felter.tid_til && `${dTil}T${tTil}` <= `${dFra}T${tFra}`) {
    felter.tid_til = 'Sluttidspunktet må være etter starttidspunktet.'
  }
  if (Object.keys(felter).length) return feil(422, 'Sjekk feltene som er merket.', { felter })

  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'ukjent').split(',')[0].trim()
  if (!(await turnstileOk(tekst(b.turnstile_token, 4000), ip))) {
    return feil(400, 'Vi kunne ikke bekrefte at du er et menneske. Last siden på nytt og prøv igjen.')
  }

  const admin = adminKlient()
  const ipHash = await sha256(`${ip}|${env('RATE_LIMIT_SALT', 'politisk-fravaer')}`)
  const siden = new Date(Date.now() - 3600_000).toISOString()
  const [{ count: perIp }, { count: perEpost }] = await Promise.all([
    admin.from('soknader').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gt('opprettet', siden),
    admin.from('soknader').select('id', { count: 'exact', head: true }).ilike('e_post', epost).gt('opprettet', siden),
  ])
  if ((perIp ?? 0) >= STYKKER_PER_TIME.ip || (perEpost ?? 0) >= STYKKER_PER_TIME.epost) {
    return feil(429, 'Du har sendt mange søknader den siste timen. Vent litt og prøv igjen.')
  }

  const slug = tekst(b.org_slug, 60).toLowerCase()
  const { data: org } = await admin.from('organisasjoner').select('*').eq('slug', slug).eq('aktiv', true).maybeSingle()
  if (!org) return feil(404, 'Fant ikke organisasjonen.')
  const { data: arr } = await admin.from('arrangorer').select('id, navn').eq('id', arrangorId)
    .eq('organisasjon_id', org.id).eq('aktiv', true).maybeSingle()
  if (!arr) return feil(422, 'Sjekk feltene som er merket.', { felter: { arrangor_id: 'Velg en gyldig arrangør.' } })

  const { data: kobl } = await admin.from('arrangor_attestant').select('attestant_id').eq('arrangor_id', arr.id)
  const attIds = (kobl ?? []).map((k) => k.attestant_id)
  if (!attIds.length) return feil(422, 'Denne arrangøren har ingen attestant ennå.', { felter: { arrangor_id: 'Denne arrangøren kan ikke motta søknader ennå.' } })
  const { data: attestanter } = await admin.from('attestanter').select('id, navn, e_post').in('id', attIds)

  const { data: s, error } = await admin.from('soknader').insert({
    organisasjon_id: org.id, arrangor_id: arr.id, navn, skole, e_post: epost, telefon,
    type_arrangement: type, arrangement, har_vaert: b.har_vaert, dato_fra: dFra, tid_fra: tFra,
    dato_til: dTil, tid_til: tTil, sted, kommentar, ip_hash: ipHash,
  }).select('*').single()
  if (error || !s) {
    console.error('Kunne ikke lagre søknad', error)
    return feil(500, 'Kunne ikke lagre søknaden. Prøv igjen.')
  }

  // E-post: feil her skal ikke velte innsendingen. Alt er logget i utsendinger.
  const innst = medStandard(org.innstillinger)
  const statuslenke = `${appUrl()}/${org.slug}/status/${s.status_token}`
  const soknadslenke = `${appUrl()}/${org.slug}/attestant?soknad=${s.id}`
  const basis = { orgId: org.id, gmailAktivert: false, soknadId: s.id }

  const vSoker = vars(s, org, arr.navn, null, idagOslo(), { statuslenke })
  await sendEpost(admin, {
    ...basis, type: 'kvittering', til: epost, fraNavn: org.navn, replyTo: org.kontakt_epost,
    emne: fill(innst.mail.kvittering.subject, vSoker), tekst: fill(innst.mail.kvittering.body, vSoker),
  }).catch((e) => console.error('Kvittering feilet', e))

  for (const a of attestanter ?? []) {
    const v = vars(s, org, arr.navn, a, idagOslo(), { soknadslenke })
    // Varselet gjentas ikke per attestant i utsendinger-indeksen (bare fravær/avslag er unike).
    await sendEpost(admin, {
      ...basis, type: 'varsel', til: a.e_post, fraNavn: org.navn, replyTo: epost,
      emne: fill(innst.mail.varsel.subject, v), tekst: fill(innst.mail.varsel.body, v),
    }).catch((e) => console.error('Varsel feilet', e))
  }

  return svar({ id: s.id, status_token: s.status_token })
})
