import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logoUrl, supabase } from '../lib/supabase'
import { applyTheme } from '../lib/theme'
import {
  EKSTRA_PLASSHOLDERE, EPOST_RE, PLASSHOLDERE, STANDARD_INNSTILLINGER, medStandard,
  type Innstillinger,
} from '../../supabase/functions/_shared/mal'
import type { Arrangor, Attestant, Utsending } from '../lib/types'
import { Boks, Felt, Knapp, Laster, Overskrift, Tekstomrade, Varsel, Velg, fmtDatoTid } from '../ui'
import { useOrg } from './OrgLayout'

type OrgRad = { id: string; navn: string; kontakt_epost: string | null; innstillinger: unknown; gmail_aktivert: boolean }
type Fane = 'arrangorer' | 'attestanter' | 'utseende' | 'maltekster' | 'logg'
const FANER: [Fane, string][] = [
  ['arrangorer', 'Arrangører'], ['attestanter', 'Attestanter'], ['utseende', 'Logo og farger'],
  ['maltekster', 'Maltekster'], ['logg', 'Sendte e-poster'],
]

export function Admin() {
  const org = useOrg()
  const [fane, setFane] = useState<Fane>('arrangorer')
  useEffect(() => { document.title = `Administrasjon – ${org.navn}` }, [org.navn])
  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-8">
      <p className="m-0 text-sm"><Link to={`/${org.slug}/attestant`}>← Til søknadene</Link></p>
      <h1 className="mt-2 text-[clamp(32px,5vw,48px)] font-extrabold leading-none tracking-tight">Administrer {org.navn}</h1>
      <div role="tablist" aria-label="Administrasjon" className="mt-6 flex flex-wrap gap-1 rounded-[9px] bg-soft p-1">
        {FANER.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={fane === v} onClick={() => setFane(v)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-md px-3 text-[15px] font-semibold ${fane === v ? 'bg-surface shadow' : ''}`}>{l}</button>
        ))}
      </div>
      <div className="mt-8">
        {fane === 'arrangorer' && <Arrangorer orgId={org.id} />}
        {fane === 'attestanter' && <Attestanter orgId={org.id} />}
        {fane === 'utseende' && <Utseende orgId={org.id} />}
        {fane === 'maltekster' && <Maltekster orgId={org.id} />}
        {fane === 'logg' && <Logg orgId={org.id} />}
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------

function Arrangorer({ orgId }: { orgId: string }) {
  const [arr, setArr] = useState<Arrangor[] | null>(null)
  const [att, setAtt] = useState<Attestant[]>([])
  const [kobl, setKobl] = useState<Set<string>>(new Set())
  const [ny, setNy] = useState('')
  const [melding, setMelding] = useState<string>('')

  const hent = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('arrangorer').select('*').eq('organisasjon_id', orgId).order('navn'),
      supabase.from('attestanter').select('*').eq('organisasjon_id', orgId).order('e_post'),
      supabase.from('arrangor_attestant').select('arrangor_id, attestant_id'),
    ])
    setArr((a.data as Arrangor[]) ?? [])
    setAtt((b.data as Attestant[]) ?? [])
    setKobl(new Set(((c.data as { arrangor_id: string; attestant_id: string }[]) ?? []).map((k) => `${k.arrangor_id}|${k.attestant_id}`)))
  }, [orgId])
  useEffect(() => { hent() }, [hent])

  const leggTil = async () => {
    if (!ny.trim()) return
    const { error } = await supabase.from('arrangorer').insert({ organisasjon_id: orgId, navn: ny.trim() })
    setMelding(error ? (error.code === '23505' ? 'Den arrangøren finnes allerede.' : error.message) : '')
    if (!error) setNy('')
    hent()
  }
  const endre = async (id: string, felt: Partial<Arrangor>) => {
    const { error } = await supabase.from('arrangorer').update(felt).eq('id', id)
    if (error) setMelding(error.message)
    hent()
  }
  const veksleKobling = async (arrId: string, attId: string) => {
    const na = kobl.has(`${arrId}|${attId}`)
    const { error } = na
      ? await supabase.from('arrangor_attestant').delete().eq('arrangor_id', arrId).eq('attestant_id', attId)
      : await supabase.from('arrangor_attestant').insert({ arrangor_id: arrId, attestant_id: attId })
    if (error) setMelding(error.message)
    hent()
  }

  if (!arr) return <Laster />
  return (
    <section className="flex flex-col gap-5">
      <Overskrift meta={`${arr.length}`}>Arrangører og koblinger</Overskrift>
      <p className="m-0 text-muted">Søkere velger en arrangør i skjemaet. Kryss av hvilke attestanter som skal få søknadene. En arrangør uten attestant vises ikke i skjemaet.</p>
      {melding && <Varsel type="warn">{melding}</Varsel>}
      {arr.map((a) => (
        <Boks key={a.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1"><Felt label="Navn" defaultValue={a.navn} key={a.navn}
              onBlur={(e) => e.target.value.trim() && e.target.value !== a.navn && endre(a.id, { navn: e.target.value.trim() })} /></div>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5" checked={a.aktiv} onChange={(e) => endre(a.id, { aktiv: e.target.checked })} /> Aktiv
            </label>
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1 text-[13px] font-semibold">Attestanter som får søknadene</legend>
            {att.length === 0 && <p className="m-0 text-sm text-muted">Legg til attestanter under «Attestanter» først.</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {att.map((x) => (
                <label key={x.id} className="flex min-h-9 items-center gap-2 text-[15px]">
                  <input type="checkbox" className="size-5" checked={kobl.has(`${a.id}|${x.id}`)} onChange={() => veksleKobling(a.id, x.id)} />
                  {x.navn || x.e_post}
                </label>
              ))}
            </div>
          </fieldset>
        </Boks>
      ))}
      <div className="flex items-end gap-3">
        <div className="flex-1"><Felt label="Ny arrangør" value={ny} placeholder="F.eks. Oslo fylkeslag" onChange={(e) => setNy(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && leggTil()} /></div>
        <Knapp onClick={leggTil}>Legg til</Knapp>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Attestanter({ orgId }: { orgId: string }) {
  const [att, setAtt] = useState<Attestant[] | null>(null)
  const [epost, setEpost] = useState('')
  const [navn, setNavn] = useState('')
  const [rolle, setRolle] = useState<'attestant' | 'admin'>('attestant')
  const [melding, setMelding] = useState('')
  const hent = useCallback(async () => {
    const { data } = await supabase.from('attestanter').select('*').eq('organisasjon_id', orgId).order('e_post')
    setAtt((data as Attestant[]) ?? [])
  }, [orgId])
  useEffect(() => { hent() }, [hent])

  const leggTil = async () => {
    const e = epost.trim().toLowerCase()
    if (!EPOST_RE.test(e)) return setMelding('Skriv inn en gyldig e-postadresse.')
    const { error } = await supabase.from('attestanter').insert({ organisasjon_id: orgId, e_post: e, navn: navn.trim() || null, rolle })
    if (error) return setMelding(error.code === '23505' ? 'Den e-postadressen er allerede registrert.' : error.message)
    setMelding(''); setEpost(''); setNavn(''); setRolle('attestant'); hent()
  }
  const endreRolle = async (id: string, r: 'attestant' | 'admin') => {
    const { error } = await supabase.from('attestanter').update({ rolle: r }).eq('id', id)
    if (error) setMelding(error.message)
    hent()
  }
  const fjern = async (a: Attestant) => {
    if (!window.confirm(`Fjerne ${a.navn || a.e_post}? Personen mister tilgangen.`)) return
    const { error } = await supabase.from('attestanter').delete().eq('id', a.id)
    if (error) setMelding(error.message)
    hent()
  }

  if (!att) return <Laster />
  return (
    <section className="flex flex-col gap-5">
      <Overskrift meta={`${att.length}`}>Attestanter</Overskrift>
      <p className="m-0 text-muted">Alle med en e-postadresse her kan logge inn (Google eller innloggingslenke). Admin kan i tillegg administrere organisasjonen.</p>
      {melding && <Varsel type="warn">{melding}</Varsel>}
      <div className="overflow-x-auto rounded-lg border-[1.5px] border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
          <thead><tr className="border-b border-line text-sm text-muted"><th className="p-3">E-post</th><th className="p-3">Navn</th><th className="p-3">Rolle</th><th className="p-3">Innlogget før</th><th className="p-3" /></tr></thead>
          <tbody>
            {att.map((a) => (
              <tr key={a.id} className="border-b border-soft last:border-0">
                <td className="p-3 [overflow-wrap:anywhere]">{a.e_post}</td>
                <td className="p-3">{a.navn || <span className="text-muted">–</span>}</td>
                <td className="p-3">
                  <select aria-label={`Rolle for ${a.e_post}`} className="rounded-md border-[1.5px] border-line bg-surface px-2 py-2" value={a.rolle}
                    onChange={(e) => endreRolle(a.id, e.target.value as 'attestant' | 'admin')}>
                    <option value="attestant">Attestant</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td className="p-3 text-sm">{a.bruker_id ? 'Ja' : 'Nei'}</td>
                <td className="p-3 text-right"><Knapp variant="fare" onClick={() => fjern(a)}>Fjern</Knapp></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Boks className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
        <Felt label="E-post" type="email" value={epost} onChange={(e) => setEpost(e.target.value)} />
        <Felt label="Navn" valgfri value={navn} onChange={(e) => setNavn(e.target.value)} />
        <Velg label="Rolle" value={rolle} onChange={(e) => setRolle(e.target.value as 'attestant' | 'admin')}>
          <option value="attestant">Attestant</option><option value="admin">Admin</option>
        </Velg>
        <Knapp onClick={leggTil}>Legg til</Knapp>
      </Boks>
    </section>
  )
}

// ---------------------------------------------------------------------------

function useOrgRad(orgId: string) {
  const [rad, setRad] = useState<OrgRad | null>(null)
  const hent = useCallback(async () => {
    const { data } = await supabase.from('organisasjoner').select('id, navn, kontakt_epost, innstillinger, gmail_aktivert').eq('id', orgId).single()
    setRad(data as OrgRad)
  }, [orgId])
  useEffect(() => { hent() }, [hent])
  return { rad, hent }
}

/** Rasteriserer en bildefil (også SVG) til PNG, maks 800 px bred. */
async function tilPng(f: File): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(f)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Kunne ikke lese bildet')); i.src = url
    })
    const nw = img.naturalWidth || 400, nh = img.naturalHeight || 100
    const k = Math.min(1, 800 / nw)
    const c = document.createElement('canvas')
    c.width = Math.round(nw * k); c.height = Math.round(nh * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Kunne ikke lage PNG'))), 'image/png'))
    return { blob, w: c.width, h: c.height }
  } finally { URL.revokeObjectURL(url) }
}

function Utseende({ orgId }: { orgId: string }) {
  const { rad, hent } = useOrgRad(orgId)
  const [navn, setNavn] = useState('')
  const [kontakt, setKontakt] = useState('')
  const [innst, setInnst] = useState<Innstillinger | null>(null)
  const [melding, setMelding] = useState<{ t: 'ok' | 'warn'; s: string } | null>(null)
  useEffect(() => {
    if (!rad) return
    setNavn(rad.navn); setKontakt(rad.kontakt_epost ?? ''); setInnst(medStandard(rad.innstillinger))
  }, [rad])
  if (!rad || !innst) return <Laster />

  const farge = (k: 'bg' | 'fg' | 'accent', v: string) => {
    const ny = { ...innst, colors: { ...innst.colors, [k]: v } }
    setInnst(ny)
    applyTheme(ny.colors) // forhåndsvis direkte
  }
  const lagre = async (ny: Innstillinger = innst) => {
    const { error } = await supabase.from('organisasjoner')
      .update({ navn: navn.trim(), kontakt_epost: kontakt.trim() || null, innstillinger: ny }).eq('id', orgId)
    setMelding(error ? { t: 'warn', s: 'Kunne ikke lagre: ' + error.message } : { t: 'ok', s: 'Lagret.' })
    hent()
  }
  const lastOppLogo = async (f: File | undefined) => {
    if (!f) return
    try {
      const { blob, w, h } = await tilPng(f)
      const sti = `${orgId}/logo-${Date.now()}.png`
      const { error } = await supabase.storage.from('logoer').upload(sti, blob, { contentType: 'image/png', upsert: true })
      if (error) return setMelding({ t: 'warn', s: 'Kunne ikke laste opp logoen: ' + error.message })
      const gammel = innst.logo
      const ny = { ...innst, logo: sti, logoW: w, logoH: h }
      setInnst(ny)
      await lagre(ny)
      if (gammel) await supabase.storage.from('logoer').remove([gammel])
    } catch (e) { setMelding({ t: 'warn', s: e instanceof Error ? e.message : 'Feil ved opplasting.' }) }
  }
  const fjernLogo = async () => {
    const gammel = innst.logo
    const ny = { ...innst, logo: '', logoW: 0, logoH: 0 }
    setInnst(ny)
    await lagre(ny)
    if (gammel) await supabase.storage.from('logoer').remove([gammel])
  }
  const logo = logoUrl(innst.logo)

  return (
    <section className="flex flex-col gap-5">
      <Overskrift>Logo, farger og tekster på siden</Overskrift>
      <Felt label="Organisasjonsnavn" value={navn} onChange={(e) => setNavn(e.target.value)} />
      <Felt label="Kontakt-e-post" type="email" value={kontakt} onChange={(e) => setKontakt(e.target.value)}
        hint="Brukes som svaradresse på kvitteringer til søkerne." />
      <Felt label="Overskrift på søknadsskjemaet" value={innst.pageTitle} onChange={(e) => setInnst({ ...innst, pageTitle: e.target.value })} />
      <Tekstomrade label="Ingress" rows={3} value={innst.intro} onChange={(e) => setInnst({ ...innst, intro: e.target.value })} />

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Logo</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-40 items-center justify-center rounded-lg border-[1.5px] border-dashed border-line bg-surface p-1.5 text-xs text-muted">
            {logo ? <img src={logo} alt="Gjeldende logo" className="max-h-full max-w-full object-contain" /> : 'Ingen logo'}
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[7px] border-[1.5px] border-line px-4 text-[15px] font-semibold hover:border-fg">
            Last opp logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => lastOppLogo(e.target.files?.[0])} />
          </label>
          {innst.logo && <Knapp variant="spoekelse" onClick={fjernLogo}>Fjern</Knapp>}
        </div>
      </div>

      <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-3">
        <legend className="mb-1 text-[13px] font-semibold">Farger</legend>
        {([['bg', 'Bakgrunn'], ['fg', 'Tekst'], ['accent', 'Aksent']] as const).map(([k, l]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold" htmlFor={`f-${k}`}>{l}</label>
            <div className="flex gap-1.5">
              <input type="color" aria-label={`${l} (fargevelger)`} value={innst.colors[k]} onChange={(e) => farge(k, e.target.value)}
                className="size-11 shrink-0 cursor-pointer rounded-md border-[1.5px] border-line bg-surface p-0.5" />
              <input id={`f-${k}`} value={innst.colors[k]} onChange={(e) => farge(k, e.target.value)}
                className="w-full rounded-md border-[1.5px] border-line bg-surface px-2.5 font-mono text-sm uppercase" />
            </div>
          </div>
        ))}
      </fieldset>
      <p className="m-0 text-sm text-muted">Tekstfargen på knapper og lenker justeres automatisk så de er lesbare.</p>

      {melding && <Varsel type={melding.t}>{melding.s}</Varsel>}
      <Knapp onClick={() => lagre()} className="self-start">Lagre</Knapp>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Chips() {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Tilgjengelige plassholdere">
      {[...PLASSHOLDERE, ...EKSTRA_PLASSHOLDERE].map((p) => (
        <code key={p} className="rounded bg-soft px-1.5 py-0.5 font-mono text-[12.5px]">{`{${p}}`}</code>
      ))}
    </div>
  )
}

function Maltekster({ orgId }: { orgId: string }) {
  const { rad, hent } = useOrgRad(orgId)
  const [innst, setInnst] = useState<Innstillinger | null>(null)
  const [melding, setMelding] = useState<{ t: 'ok' | 'warn'; s: string } | null>(null)
  useEffect(() => { if (rad) setInnst(medStandard(rad.innstillinger)) }, [rad])
  if (!rad || !innst) return <Laster />

  const pdf = (k: keyof Innstillinger['pdf'], v: string | boolean) => setInnst({ ...innst, pdf: { ...innst.pdf, [k]: v } })
  const mail = (t: keyof Innstillinger['mail'], k: 'subject' | 'body', v: string) =>
    setInnst({ ...innst, mail: { ...innst.mail, [t]: { ...innst.mail[t], [k]: v } } })
  const lagre = async () => {
    const { error } = await supabase.from('organisasjoner').update({ innstillinger: innst }).eq('id', orgId)
    setMelding(error ? { t: 'warn', s: 'Kunne ikke lagre: ' + error.message } : { t: 'ok', s: 'Malene er lagret.' })
    hent()
  }
  const MAILER: [keyof Innstillinger['mail'], string, string][] = [
    ['kvittering', 'Kvittering til søkeren', 'Sendes når søknaden er mottatt.'],
    ['varsel', 'Varsel til attestanten', 'Sendes til attestantene for valgt arrangør.'],
    ['fravaer', 'E-post med fraværserklæringen', 'PDF-en legges ved.'],
    ['avslag', 'Avslag til søkeren', '{begrunnelse} fylles inn fra attestantens begrunnelse.'],
  ]
  return (
    <section className="flex flex-col gap-8">
      <Overskrift>Maltekster</Overskrift>
      <div className="flex flex-col gap-2"><span className="text-sm font-semibold">Plassholdere (skriv dem med krøllparenteser)</span><Chips /></div>

      <div className="flex flex-col gap-4">
        <h3 className="m-0 text-lg font-bold">Fraværserklæringen (PDF)</h3>
        <Felt label="Tittel" value={innst.pdf.title} onChange={(e) => pdf('title', e.target.value)} />
        <Tekstomrade label="Brødtekst" rows={14} value={innst.pdf.body} onChange={(e) => pdf('body', e.target.value)}
          hint="Tomme linjer deler teksten i avsnitt." />
        <Felt label="Hilsen" value={innst.pdf.greeting} onChange={(e) => pdf('greeting', e.target.value)} />
        <Felt label="Filnavn" value={innst.pdf.fileName} onChange={(e) => pdf('fileName', e.target.value)} hint=".pdf legges til automatisk." />
        <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" className="size-5" checked={innst.pdf.showLogo} onChange={(e) => pdf('showLogo', e.target.checked)} /> Vis logo øverst i PDF-en</label>
        <Knapp variant="spoekelse" className="self-start" onClick={() => setInnst({ ...innst, pdf: STANDARD_INNSTILLINGER.pdf })}>Tilbakestill til standardtekst</Knapp>
      </div>

      {MAILER.map(([t, tittel, hint]) => (
        <div key={t} className="flex flex-col gap-4">
          <h3 className="m-0 text-lg font-bold">{tittel}</h3>
          <p className="m-0 text-sm text-muted">{hint}</p>
          <Felt label="Emne" value={innst.mail[t].subject} onChange={(e) => mail(t, 'subject', e.target.value)} />
          <Tekstomrade label="Tekst" rows={9} value={innst.mail[t].body} onChange={(e) => mail(t, 'body', e.target.value)} />
          <Knapp variant="spoekelse" className="self-start" onClick={() => setInnst({ ...innst, mail: { ...innst.mail, [t]: STANDARD_INNSTILLINGER.mail[t] } })}>Tilbakestill</Knapp>
        </div>
      ))}

      {melding && <Varsel type={melding.t}>{melding.s}</Varsel>}
      <Knapp onClick={lagre} className="self-start">Lagre maltekster</Knapp>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Logg({ orgId }: { orgId: string }) {
  const [rader, setRader] = useState<Utsending[] | null>(null)
  const [apen, setApen] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('utsendinger').select('*').eq('organisasjon_id', orgId).order('opprettet', { ascending: false }).limit(200)
      .then(({ data }) => setRader((data as Utsending[]) ?? []))
  }, [orgId])
  if (!rader) return <Laster />
  const typeEtikett = { kvittering: 'Kvittering', varsel: 'Varsel', fravaer: 'Fraværserklæring', avslag: 'Avslag' }
  return (
    <section className="flex flex-col gap-4">
      <Overskrift meta={`${rader.length}`}>Sendte e-poster</Overskrift>
      <Varsel>Kanalen «dev» betyr at e-posten bare er logget her og ikke sendt. Se README for hva som trengs for ekte e-post.</Varsel>
      <ul className="m-0 flex flex-col gap-2 p-0">
        {rader.length === 0 && <li className="list-none text-muted">Ingen e-poster ennå.</li>}
        {rader.map((u) => (
          <li key={u.id} className="list-none">
            <Boks className="!p-3">
              <button type="button" className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left" aria-expanded={apen === u.id}
                onClick={() => setApen(apen === u.id ? null : u.id)}>
                <span className="font-semibold">{typeEtikett[u.type]} → {u.mottaker}</span>
                <span className="text-sm text-muted">
                  <b className={u.status === 'feilet' ? 'text-warn' : u.kanal === 'dev' ? '' : 'text-ok'}>{u.kanal}</b> · {u.status} · {fmtDatoTid(u.opprettet)}
                </span>
              </button>
              {apen === u.id && (
                <div className="mt-3 border-t border-soft pt-3 text-sm">
                  <p className="m-0 text-muted">Fra: {u.avsender}</p>
                  <p className="m-0 font-semibold">{u.emne}</p>
                  <pre className="mb-0 mt-2 whitespace-pre-wrap font-[inherit] [overflow-wrap:anywhere]">{u.tekst}</pre>
                  {u.vedlegg && <p className="mb-0 mt-2 font-semibold">📎 {u.vedlegg}</p>}
                  {u.feil && <p className="mb-0 mt-2 font-semibold text-warn">Feil: {u.feil}</p>}
                </div>
              )}
            </Boks>
          </li>
        ))}
      </ul>
    </section>
  )
}
