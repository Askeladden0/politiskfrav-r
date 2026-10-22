import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiFeil, funksjon } from '../lib/supabase'
import { EPOST_RE } from '../../supabase/functions/_shared/mal'
import { Felt, Knapp, Overskrift, Segment, Tekstomrade, Varsel, Velg } from '../ui'
import { TYPE_ETIKETT } from '../lib/types'
import { useOrg } from './OrgLayout'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

type Skjema = {
  navn: string; skole: string; e_post: string; telefon: string; arrangor_id: string
  type_arrangement: string; arrangement: string; har_vaert: 'ja' | 'nei'
  dato_fra: string; tid_fra: string; dato_til: string; tid_til: string; sted: string; kommentar: string
  nettside: string
}
const TOM: Skjema = {
  navn: '', skole: '', e_post: '', telefon: '', arrangor_id: '', type_arrangement: '', arrangement: '', har_vaert: 'ja',
  dato_fra: '', tid_fra: '', dato_til: '', tid_til: '', sted: '', kommentar: '', nettside: '',
}

function valider(s: Skjema): Record<string, string> {
  const f: Record<string, string> = {}
  if (!s.navn.trim()) f.navn = 'Skriv inn navnet ditt.'
  if (!s.skole.trim()) f.skole = 'Skriv inn skolen din.'
  if (!EPOST_RE.test(s.e_post.trim())) f.e_post = 'Skriv inn en gyldig e-postadresse.'
  if (!s.arrangor_id) f.arrangor_id = 'Velg arrangør.'
  if (!s.type_arrangement) f.type_arrangement = 'Velg type arrangement.'
  if (!s.arrangement.trim()) f.arrangement = 'Skriv inn navn eller beskrivelse av arrangementet.'
  if (!s.dato_fra) f.dato_fra = 'Velg startdato.'
  if (!s.tid_fra) f.tid_fra = 'Skriv inn starttidspunkt.'
  if (!s.dato_til) f.dato_til = 'Velg sluttdato.'
  if (!s.tid_til) f.tid_til = 'Skriv inn sluttidspunkt.'
  if (!f.dato_fra && !f.tid_fra && !f.dato_til && !f.tid_til && `${s.dato_til}T${s.tid_til}` <= `${s.dato_fra}T${s.tid_fra}`) {
    f.tid_til = 'Sluttidspunktet må være etter starttidspunktet.'
  }
  return f
}

export function Soknad() {
  const org = useOrg()
  const nav = useNavigate()
  const [s, setS] = useState<Skjema>(TOM)
  const [feil, setFeil] = useState<Record<string, string>>({})
  const [toppfeil, setToppfeil] = useState('')
  const [jobber, setJobber] = useState(false)
  const [token, setToken] = useState('')
  const turnstileEl = useRef<HTMLDivElement>(null)

  const sett = (k: keyof Skjema, v: string) => {
    setS((x) => {
      const ny = { ...x, [k]: v }
      if (k === 'dato_fra' && (!x.dato_til || x.dato_til < v)) ny.dato_til = v // sluttdato følger startdato
      return ny
    })
    if (feil[k]) setFeil((f) => ({ ...f, [k]: '' }))
  }

  // Cloudflare Turnstile, bare hvis nøkkel er satt.
  useEffect(() => {
    if (!SITE_KEY || !turnstileEl.current) return
    const w = window as unknown as { turnstile?: { render: (el: HTMLElement, o: object) => void } }
    const tegn = () => w.turnstile?.render(turnstileEl.current!, { sitekey: SITE_KEY, callback: (t: string) => setToken(t), language: 'nb' })
    if (w.turnstile) return tegn()
    const sc = document.createElement('script')
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    sc.async = true
    sc.onload = tegn
    document.head.appendChild(sc)
  }, [])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    setToppfeil('')
    const f = valider(s)
    setFeil(f)
    if (Object.keys(f).length) {
      setToppfeil('Sjekk feltene som er merket.')
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setJobber(true)
    try {
      const r = await funksjon<{ id: string; status_token: string }>('sok', {
        org_slug: org.slug, ...s, har_vaert: s.har_vaert === 'ja', turnstile_token: token,
      }, false)
      try { sessionStorage.setItem(`status-${r.id}`, r.status_token) } catch { /* ignorer */ }
      nav(`/${org.slug}/kvittering/${r.id}`)
    } catch (err) {
      if (err instanceof ApiFeil) {
        if (err.felter) setFeil(err.felter)
        setToppfeil(err.message)
      } else setToppfeil('Noe gikk galt. Prøv igjen.')
    } finally {
      setJobber(false)
    }
  }

  const p = org.profil
  const skalVaere = s.har_vaert === 'nei'
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <h1 className="text-[clamp(34px,7vw,60px)] font-extrabold leading-[0.98] tracking-tight [text-wrap:balance]">
        {p.pageTitle || 'Politisk fravær'}
      </h1>
      {p.intro && <p className="mt-3 max-w-[62ch] text-lg text-muted">{p.intro}</p>}

      <form onSubmit={send} noValidate className="mt-10 flex flex-col gap-10">
        <section aria-labelledby="h-deg" className="flex flex-col gap-4">
          <Overskrift><span id="h-deg">Om deg</span></Overskrift>
          <Felt label="Navn" autoComplete="name" value={s.navn} onChange={(e) => sett('navn', e.target.value)} feil={feil.navn} />
          <Felt label="Skole" autoComplete="organization" value={s.skole} onChange={(e) => sett('skole', e.target.value)} feil={feil.skole} />
          <Felt label="E-post" type="email" autoComplete="email" inputMode="email" value={s.e_post} onChange={(e) => sett('e_post', e.target.value)} feil={feil.e_post}
            hint="Her får du dokumentasjonen tilsendt." />
          <Felt label="Telefon" type="tel" autoComplete="tel" inputMode="tel" valgfri value={s.telefon} onChange={(e) => sett('telefon', e.target.value)} />
        </section>

        <section aria-labelledby="h-arr" className="flex flex-col gap-4">
          <Overskrift><span id="h-arr">Arrangementet</span></Overskrift>
          <Velg label="Arrangør" value={s.arrangor_id} onChange={(e) => sett('arrangor_id', e.target.value)} feil={feil.arrangor_id}>
            <option value="">Velg arrangør</option>
            {org.arrangorer.map((a) => <option key={a.id} value={a.id}>{a.navn}</option>)}
          </Velg>
          <Velg label="Type arrangement" value={s.type_arrangement} onChange={(e) => sett('type_arrangement', e.target.value)} feil={feil.type_arrangement}>
            <option value="">Velg type</option>
            {Object.entries(TYPE_ETIKETT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Velg>
          <Felt label="Navn eller beskrivelse av arrangementet" value={s.arrangement} onChange={(e) => sett('arrangement', e.target.value)}
            feil={feil.arrangement} placeholder="F.eks. Skolebesøk på Eksempel vgs" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold" id="l-tidsform">Arrangementet</span>
            <div aria-labelledby="l-tidsform">
              <Segment label="Har arrangementet vært?" valgt={s.har_vaert} onChange={(v) => sett('har_vaert', v)}
                verdier={[{ v: 'ja', l: 'Har vært' }, { v: 'nei', l: 'Skal være' }]} />
            </div>
          </div>
          <fieldset className="m-0 grid grid-cols-2 gap-3 border-0 p-0">
            <legend className="mb-1.5 text-[13px] font-semibold">Fra {skalVaere ? '(planlagt)' : ''}</legend>
            <Felt label="Dato" type="date" value={s.dato_fra} onChange={(e) => sett('dato_fra', e.target.value)} feil={feil.dato_fra} />
            <Felt label="Klokkeslett" type="time" value={s.tid_fra} onChange={(e) => sett('tid_fra', e.target.value)} feil={feil.tid_fra} />
          </fieldset>
          <fieldset className="m-0 grid grid-cols-2 gap-3 border-0 p-0">
            <legend className="mb-1.5 text-[13px] font-semibold">Til</legend>
            <Felt label="Dato" type="date" value={s.dato_til} min={s.dato_fra || undefined} onChange={(e) => sett('dato_til', e.target.value)} feil={feil.dato_til} />
            <Felt label="Klokkeslett" type="time" value={s.tid_til} onChange={(e) => sett('tid_til', e.target.value)} feil={feil.tid_til} />
          </fieldset>
          <Felt label="Sted" valgfri value={s.sted} onChange={(e) => sett('sted', e.target.value)} />
          <Tekstomrade label="Kommentar til attestanten" valgfri rows={3} value={s.kommentar} onChange={(e) => sett('kommentar', e.target.value)} />
        </section>

        {/* Honeypot: skjult for mennesker, roboter fyller det ut */}
        <div className="sr-only-hp" aria-hidden="true">
          <label>Nettside <input tabIndex={-1} autoComplete="off" value={s.nettside} onChange={(e) => sett('nettside', e.target.value)} /></label>
        </div>
        {SITE_KEY && <div ref={turnstileEl} />}

        <div className="flex flex-col gap-3">
          {toppfeil && <Varsel type="warn">{toppfeil}</Varsel>}
          <Knapp type="submit" disabled={jobber} className="!min-h-14 !text-lg">{jobber ? 'Sender …' : 'Søk'}</Knapp>
        </div>
      </form>
    </main>
  )
}
