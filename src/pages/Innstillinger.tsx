import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiFeil, funksjon, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Attestant, Signatur } from '../lib/types'
import { SignaturFelt } from '../components/Signatur'
import { Boks, Felt, Knapp, Laster, Overskrift, Varsel } from '../ui'
import { useOrg } from './OrgLayout'

type GmailStatus = { tilgjengelig: boolean; tilkoblet: boolean; google_epost: string | null }

export function Innstillinger() {
  const org = useOrg()
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [meg, setMeg] = useState<Attestant | null | undefined>(undefined)
  const [navn, setNavn] = useState('')
  const [verv, setVerv] = useState('')
  const [telefon, setTelefon] = useState('')
  const [signatur, setSignatur] = useState<Signatur | null>(null)
  const [melding, setMelding] = useState<{ t: 'ok' | 'warn'; s: string } | null>(null)
  const [jobber, setJobber] = useState(false)
  const [gmail, setGmail] = useState<GmailStatus | null>(null)

  useEffect(() => { document.title = `Mine innstillinger – ${org.navn}` }, [org.navn])
  useEffect(() => {
    const epost = session?.user.email?.toLowerCase()
    if (!epost) return
    supabase.from('attestanter').select('*').eq('organisasjon_id', org.id).eq('e_post', epost).maybeSingle().then(({ data }) => {
      const a = data as Attestant | null
      setMeg(a)
      if (a) { setNavn(a.navn ?? ''); setVerv(a.verv ?? ''); setTelefon(a.telefon ?? ''); setSignatur(a.signatur) }
    })
    funksjon<GmailStatus>('gmail-connect', { org_slug: org.slug, handling: 'status' }).then(setGmail).catch(() => setGmail(null))
  }, [org.id, org.slug, session?.user.email])

  if (meg === undefined) return <Laster />
  if (meg === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Ingen attestantprofil</h1>
        <p className="mt-3 text-muted">Du er ikke registrert som attestant i {org.navn}, så det er ingen innstillinger å endre. <Link to={`/${org.slug}/attestant`}>Tilbake</Link></p>
      </main>
    )
  }

  const lagre = async () => {
    setJobber(true)
    setMelding(null)
    const { error } = await supabase.from('attestanter')
      .update({ navn: navn.trim() || null, verv: verv.trim() || null, telefon: telefon.trim() || null, signatur })
      .eq('id', meg.id)
    setJobber(false)
    setMelding(error ? { t: 'warn', s: 'Kunne ikke lagre: ' + error.message } : { t: 'ok', s: 'Innstillingene er lagret.' })
  }

  const gmailHandling = async (handling: 'start' | 'koble_fra') => {
    try {
      const r = await funksjon<{ url?: string }>('gmail-connect', { org_slug: org.slug, handling })
      if (r.url) window.location.href = r.url
      else setGmail(await funksjon<GmailStatus>('gmail-connect', { org_slug: org.slug, handling: 'status' }))
    } catch (e) {
      setMelding({ t: 'warn', s: e instanceof ApiFeil ? e.message : 'Noe gikk galt.' })
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <p className="m-0 text-sm"><Link to={`/${org.slug}/attestant`}>← Til søknadene</Link></p>
      <h1 className="mt-2 text-[clamp(32px,5vw,48px)] font-extrabold leading-none tracking-tight">Mine innstillinger</h1>
      <p className="mt-2 text-muted">Opplysningene og signaturen brukes på alle fraværserklæringer du sender fra {org.navn}.</p>

      <section className="mt-8 flex flex-col gap-4" aria-labelledby="h-prof">
        <Overskrift><span id="h-prof">Profil</span></Overskrift>
        <Felt label="Navn" autoComplete="name" value={navn} onChange={(e) => setNavn(e.target.value)} />
        <Felt label="Verv" placeholder="F.eks. Leder" value={verv} onChange={(e) => setVerv(e.target.value)} />
        <Felt label="Telefon" type="tel" autoComplete="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
        <Felt label="E-post" value={meg.e_post} disabled hint="Svar på fraværserklæringene sendes hit. Endres av administrator." />
      </section>

      <section className="mt-10 flex flex-col gap-4" aria-labelledby="h-sig">
        <Overskrift><span id="h-sig">Signatur</span></Overskrift>
        <SignaturFelt verdi={signatur} onChange={setSignatur} />
      </section>

      <div className="mt-8 flex flex-col gap-3">
        {melding && <Varsel type={melding.t}>{melding.s}</Varsel>}
        <Knapp onClick={lagre} disabled={jobber} className="self-start">{jobber ? 'Lagrer …' : 'Lagre innstillinger'}</Knapp>
      </div>

      {gmail?.tilgjengelig && (
        <section className="mt-12 flex flex-col gap-3" aria-labelledby="h-gm">
          <Overskrift><span id="h-gm">Send fra din egen Gmail-konto</span></Overskrift>
          {params.get('gmail') === 'ok' && <Varsel type="ok">Gmail er koblet til.</Varsel>}
          {params.get('gmail') === 'feil' && <Varsel type="warn">Kunne ikke koble til Gmail. Prøv igjen.</Varsel>}
          <Boks>
            <p className="m-0 text-sm text-muted">
              Valgfritt. Når Gmail er koblet til, sendes fraværserklæringene fra din egen adresse. Hvis tilkoblingen feiler,
              sender vi via vanlig e-posttjeneste i stedet. Loggen viser alltid hvilken kanal som ble brukt.
            </p>
            {gmail.tilkoblet ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="font-semibold text-ok">✓ Koblet til {gmail.google_epost}</span>
                <Knapp variant="spoekelse" onClick={() => gmailHandling('koble_fra')}>Koble fra</Knapp>
              </div>
            ) : (
              <Knapp className="mt-3" onClick={() => gmailHandling('start')}>Koble til Gmail</Knapp>
            )}
          </Boks>
        </section>
      )}
    </main>
  )
}
