import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { EPOST_RE } from '../../supabase/functions/_shared/mal'
import { Boks, Felt, Knapp, Laster, Varsel } from '../ui'

const trygg = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null)

export function LoggInn() {
  const [params] = useSearchParams()
  const next = trygg(params.get('next'))
  const { session, laster, mineOrg, lasterOrg } = useAuth()
  const [epost, setEpost] = useState('')
  const [feil, setFeil] = useState('')
  const [sendt, setSendt] = useState(false)
  const [jobber, setJobber] = useState(false)
  useEffect(() => { document.title = 'Logg inn – Politisk fravær' }, [])

  if (laster || (session && lasterOrg)) return <Laster />
  if (session) {
    if (next) return <Navigate to={next} replace />
    if (mineOrg.length === 0) return <Navigate to="/ingen-tilgang" replace />
    if (mineOrg.length === 1) {
      const m = mineOrg[0]
      return <Navigate to={m.rolle === 'superadmin' ? '/superadmin' : `/${m.slug}/attestant`} replace />
    }
    return (
      <Side tittel="Velg organisasjon">
        <ul className="flex flex-col gap-2 p-0">
          {mineOrg.map((m) => (
            <li key={m.slug} className="list-none">
              <Link to={`/${m.slug}/attestant`} className="flex min-h-12 items-center justify-between rounded-lg border-[1.5px] border-line bg-surface px-4 py-3 font-semibold text-fg no-underline hover:border-fg">
                {m.navn} <span className="text-sm font-normal text-muted">{m.rolle}</span>
              </Link>
            </li>
          ))}
          {mineOrg.some((m) => m.rolle === 'superadmin') && (
            <li className="list-none"><Link to="/superadmin">Plattformadministrasjon</Link></li>
          )}
        </ul>
      </Side>
    )
  }

  const retur = `${window.location.origin}/logg-inn${next ? `?next=${encodeURIComponent(next)}` : ''}`

  const google = async () => {
    setFeil('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: retur } })
    if (error) setFeil('Google-innlogging er ikke satt opp ennå. Bruk innloggingslenke på e-post.')
  }
  const lenke = async (e: FormEvent) => {
    e.preventDefault()
    setFeil('')
    if (!EPOST_RE.test(epost.trim())) return setFeil('Skriv inn en gyldig e-postadresse.')
    setJobber(true)
    const { error } = await supabase.auth.signInWithOtp({ email: epost.trim().toLowerCase(), options: { emailRedirectTo: retur } })
    setJobber(false)
    if (error) setFeil('Kunne ikke sende innloggingslenke: ' + error.message)
    else setSendt(true)
  }

  return (
    <Side tittel="Logg inn">
      <p className="text-muted">For attestanter og administratorer. Bare e-postadresser som er registrert i organisasjonen får tilgang.</p>
      <Boks className="mt-6 flex flex-col gap-5">
        <Knapp variant="linje" onClick={google}>Logg inn med Google</Knapp>
        <div className="text-center text-sm text-muted">eller</div>
        {sendt ? (
          <Varsel type="ok">Vi har sendt en innloggingslenke til <b>{epost}</b>. Åpne e-posten og trykk på lenken.</Varsel>
        ) : (
          <form onSubmit={lenke} className="flex flex-col gap-3" noValidate>
            <Felt label="E-postadresse" type="email" autoComplete="email" value={epost} onChange={(e) => setEpost(e.target.value)} />
            <Knapp type="submit" disabled={jobber}>{jobber ? 'Sender …' : 'Send innloggingslenke'}</Knapp>
          </form>
        )}
        {feil && <Varsel type="warn">{feil}</Varsel>}
      </Boks>
    </Side>
  )
}

export function IngenTilgang() {
  const { session, loggUt } = useAuth()
  const [params] = useSearchParams()
  useEffect(() => { document.title = 'Ingen tilgang – Politisk fravær' }, [])
  return (
    <Side tittel="Du har ikke tilgang">
      <p className="text-muted">
        {session?.user.email ? <>E-postadressen <b>{session.user.email}</b> er ikke registrert</> : <>Du er ikke registrert</>} som attestant
        {params.get('org') ? <> i <b>{params.get('org')}</b></> : null}. Be en administrator i organisasjonen om å legge deg til.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {session && <Knapp variant="linje" onClick={loggUt}>Logg ut og bruk en annen adresse</Knapp>}
        <Link to="/" className="inline-flex min-h-11 items-center">Til forsiden</Link>
      </div>
    </Side>
  )
}

function Side({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <h1 className="mb-3 text-4xl font-extrabold leading-tight tracking-tight">{tittel}</h1>
      {children}
    </main>
  )
}
