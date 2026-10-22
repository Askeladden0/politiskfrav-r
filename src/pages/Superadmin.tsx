import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { EPOST_RE, RESERVERTE_SLUGS, SLUG_RE, STANDARD_INNSTILLINGER } from '../../supabase/functions/_shared/mal'
import { Boks, Felt, Knapp, Laster, Overskrift, Varsel } from '../ui'

type Org = { id: string; slug: string; navn: string; aktiv: boolean; gmail_aktivert: boolean; kontakt_epost: string | null }

const tilSlug = (s: string) =>
  s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function Superadmin() {
  const { session, laster, mineOrg, lasterOrg, loggUt } = useAuth()
  const [orger, setOrger] = useState<Org[] | null>(null)
  const [navn, setNavn] = useState('')
  const [slug, setSlug] = useState('')
  const [slugRedigert, setSlugRedigert] = useState(false)
  const [admin, setAdmin] = useState('')
  const [melding, setMelding] = useState<{ t: 'ok' | 'warn'; s: string } | null>(null)
  const erSuper = mineOrg.some((m) => m.rolle === 'superadmin')

  const hent = useCallback(async () => {
    const { data } = await supabase.from('organisasjoner').select('id, slug, navn, aktiv, gmail_aktivert, kontakt_epost').order('navn')
    setOrger((data as Org[]) ?? [])
  }, [])
  useEffect(() => { if (erSuper) hent() }, [erSuper, hent])
  useEffect(() => { document.title = 'Plattformadmin – Politisk fravær' }, [])

  if (laster || (session && lasterOrg)) return <Laster />
  if (!session) return <Navigate to="/logg-inn?next=%2Fsuperadmin" replace />
  if (!erSuper) return <Navigate to="/ingen-tilgang" replace />

  const opprett = async () => {
    const s = slug.trim()
    const e = admin.trim().toLowerCase()
    if (!navn.trim()) return setMelding({ t: 'warn', s: 'Skriv inn organisasjonsnavn.' })
    if (!SLUG_RE.test(s) || s.length < 2 || s.length > 40) return setMelding({ t: 'warn', s: 'Adressen kan bare ha små bokstaver, tall og bindestrek (2–40 tegn).' })
    if (RESERVERTE_SLUGS.includes(s)) return setMelding({ t: 'warn', s: `«${s}» er reservert. Velg en annen adresse.` })
    if (!EPOST_RE.test(e)) return setMelding({ t: 'warn', s: 'Skriv inn e-postadressen til første org-admin.' })

    const { data: ny, error } = await supabase.from('organisasjoner')
      .insert({ slug: s, navn: navn.trim(), kontakt_epost: e, innstillinger: STANDARD_INNSTILLINGER })
      .select('id').single()
    if (error || !ny) return setMelding({ t: 'warn', s: error?.code === '23505' ? 'Den adressen er opptatt.' : `Kunne ikke opprette: ${error?.message}` })
    const { error: e2 } = await supabase.from('attestanter').insert({ organisasjon_id: ny.id, e_post: e, rolle: 'admin' })
    if (e2) return setMelding({ t: 'warn', s: `Organisasjonen ble opprettet, men admin kunne ikke legges til: ${e2.message}` })
    setMelding({ t: 'ok', s: `«${navn.trim()}» er opprettet på /${s}. ${e} kan nå logge inn som org-admin.` })
    setNavn(''); setSlug(''); setSlugRedigert(false); setAdmin('')
    hent()
  }

  const endre = async (o: Org, felt: { aktiv?: boolean; gmail?: boolean }) => {
    const { error } = await supabase.rpc('superadmin_oppdater_organisasjon', {
      p_id: o.id, p_slug: null, p_aktiv: felt.aktiv ?? null, p_gmail_aktivert: felt.gmail ?? null,
    })
    if (error) setMelding({ t: 'warn', s: error.message })
    hent()
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-8">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm"><Link to="/">← Forsiden</Link></p>
        <button type="button" className="text-sm text-muted underline" onClick={loggUt}>Logg ut</button>
      </div>
      <h1 className="mt-2 text-[clamp(32px,5vw,48px)] font-extrabold leading-none tracking-tight">Plattformadmin</h1>

      <section className="mt-8 flex flex-col gap-4" aria-labelledby="h-ny">
        <Overskrift><span id="h-ny">Ny organisasjon</span></Overskrift>
        <Boks className="flex flex-col gap-4">
          <Felt label="Organisasjonsnavn" value={navn} onChange={(e) => { setNavn(e.target.value); if (!slugRedigert) setSlug(tilSlug(e.target.value)) }} />
          <Felt label="Adresse" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugRedigert(true) }}
            hint={<>Siden havner på <code>/{slug || 'adresse'}</code>. Små bokstaver, tall og bindestrek.</>} />
          <Felt label="Første org-admin (e-post)" type="email" value={admin} onChange={(e) => setAdmin(e.target.value)}
            hint="Personen logger inn med denne adressen og setter opp resten selv. Brukes også som kontaktadresse til å begynne med." />
          <Knapp onClick={opprett} className="self-start">Opprett organisasjon</Knapp>
        </Boks>
      </section>

      {melding && <div className="mt-4"><Varsel type={melding.t}>{melding.s}</Varsel></div>}

      <section className="mt-10 flex flex-col gap-4" aria-labelledby="h-org">
        <Overskrift meta={orger ? `${orger.length}` : ''}><span id="h-org">Organisasjoner</span></Overskrift>
        {!orger ? <Laster /> : orger.map((o) => (
          <Boks key={o.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-lg">{o.navn}</b>
              <span className="text-sm text-muted">/{o.slug}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex min-h-9 items-center gap-2 text-[15px]">
                <input type="checkbox" className="size-5" checked={o.aktiv} onChange={(e) => endre(o, { aktiv: e.target.checked })} /> Aktiv (synlig for søkere)
              </label>
              <label className="flex min-h-9 items-center gap-2 text-[15px]">
                <input type="checkbox" className="size-5" checked={o.gmail_aktivert} onChange={(e) => endre(o, { gmail: e.target.checked })} /> Tillat Gmail-utsending
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <Link to={`/${o.slug}`}>Søknadsskjema</Link><Link to={`/${o.slug}/attestant`}>Dashboard</Link><Link to={`/${o.slug}/admin`}>Org-admin</Link>
            </div>
          </Boks>
        ))}
      </section>
    </main>
  )
}
