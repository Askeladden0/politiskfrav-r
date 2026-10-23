import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiFeil, funksjon, funksjonFil, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tidTekst } from '../../supabase/functions/_shared/mal'
import { TYPE_ETIKETT, type Attestant, type Soknad, type SoknadStatus } from '../lib/types'
import { Boks, Felt, Knapp, Laster, Overskrift, StatusMerke, Tekstomrade, Varsel, Velg, fmtDatoTid } from '../ui'
import { useOrg } from './OrgLayout'

type Fane = SoknadStatus | 'alle'
const FANER: { v: Fane; l: string }[] = [
  { v: 'venter', l: 'Venter' }, { v: 'sendt', l: 'Sendt' }, { v: 'avslatt', l: 'Avslått' }, { v: 'alle', l: 'Alle' },
]
type Resultat = { soknad_id: string; navn?: string; ok: boolean; allerede_sendt?: boolean; kanal?: string; feil?: string }

export function Dashboard() {
  const org = useOrg()
  const { session, mineOrg } = useAuth()
  const [params, setParams] = useSearchParams()
  const [soknader, setSoknader] = useState<Soknad[] | null>(null)
  const [meg, setMeg] = useState<Attestant | null>(null)
  const [feil, setFeil] = useState('')
  const [fane, setFane] = useState<Fane>('venter')
  const [sok, setSok] = useState('')
  const [arrFilter, setArrFilter] = useState('')
  const [fraDato, setFraDato] = useState('')
  const [valgt, setValgt] = useState<Set<string>>(new Set())
  const [bekreft, setBekreft] = useState(false)
  const [sender, setSender] = useState<{ i: number; n: number } | null>(null)
  const [resultater, setResultater] = useState<Resultat[] | null>(null)
  const apen = params.get('soknad')

  const hent = useCallback(async () => {
    const { data, error } = await supabase
      .from('soknader')
      .select('*, arrangorer(navn)')
      .eq('organisasjon_id', org.id)
      .order('opprettet', { ascending: false })
    if (error) setFeil('Kunne ikke hente søknader: ' + error.message)
    else setSoknader(data as Soknad[])
  }, [org.id])

  useEffect(() => { hent() }, [hent])
  useEffect(() => {
    const epost = session?.user.email?.toLowerCase()
    if (!epost) return
    supabase.from('attestanter').select('*').eq('organisasjon_id', org.id).eq('e_post', epost).maybeSingle()
      .then(({ data }) => setMeg(data as Attestant | null))
  }, [org.id, session?.user.email])
  useEffect(() => { document.title = `Dashboard – ${org.navn}` }, [org.navn])

  const arrangorer = useMemo(() => {
    const m = new Map<string, string>()
    soknader?.forEach((s) => m.set(s.arrangor_id, s.arrangorer?.navn ?? ''))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'nb'))
  }, [soknader])

  const filtrert = useMemo(() => {
    const q = sok.trim().toLowerCase()
    return (soknader ?? []).filter((s) =>
      (fane === 'alle' || s.status === fane) &&
      (!arrFilter || s.arrangor_id === arrFilter) &&
      (!fraDato || s.dato_fra >= fraDato) &&
      (!q || [s.navn, s.skole, s.arrangement].some((t) => t.toLowerCase().includes(q))),
    )
  }, [soknader, fane, sok, arrFilter, fraDato])

  const antall = (f: Fane) => (soknader ?? []).filter((s) => f === 'alle' || s.status === f).length
  const venterIFilter = filtrert.filter((s) => s.status === 'venter')
  const valgteVenter = venterIFilter.filter((s) => valgt.has(s.id))
  const alleValgt = venterIFilter.length > 0 && venterIFilter.every((s) => valgt.has(s.id))
  const flereOrg = mineOrg.filter((m) => m.rolle !== 'superadmin')
  const erAdmin = mineOrg.some((m) => m.slug === org.slug && (m.rolle === 'admin' || m.rolle === 'superadmin'))

  const veksle = (id: string) => setValgt((v) => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n })
  const veksleAlle = () => setValgt(alleValgt ? new Set() : new Set(venterIFilter.map((s) => s.id)))

  const sendValgte = async () => {
    setBekreft(false)
    const ider = valgteVenter.map((s) => s.id)
    const ut: Resultat[] = []
    setResultater([])
    for (let i = 0; i < ider.length; i++) {
      setSender({ i: i + 1, n: ider.length })
      try {
        const r = await funksjon<{ resultater: Resultat[] }>('send-fravaer', { soknad_ids: [ider[i]] })
        ut.push(...r.resultater)
      } catch (e) {
        ut.push({ soknad_id: ider[i], ok: false, feil: e instanceof ApiFeil ? e.message : 'Ukjent feil' })
      }
      setResultater([...ut])
    }
    setSender(null)
    setValgt(new Set())
    await hent()
  }

  if (soknader === null && !feil) return <Laster />
  const navnPaa = (id: string) => soknader?.find((s) => s.id === id)?.navn ?? ''

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[clamp(28px,5vw,44px)] font-black leading-none tracking-tight">Innboks</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          {flereOrg.length > 1 && (
            <label className="flex items-center gap-2">Organisasjon
              <select className="rounded-md border-[1.5px] border-line bg-surface px-2 py-2" value={org.slug}
                onChange={(e) => { window.location.href = `/${e.target.value}/attestant` }}>
                {flereOrg.map((m) => <option key={m.slug} value={m.slug}>{m.navn}</option>)}
              </select>
            </label>
          )}
          <Link to={`/${org.slug}/attestant/innstillinger`}>Mine innstillinger</Link>
          {erAdmin && <Link to={`/${org.slug}/admin`}>Administrer organisasjonen</Link>}
        </div>
      </div>

      {feil && <div className="mt-4"><Varsel type="warn">{feil}</Varsel></div>}

      <div role="tablist" aria-label="Status" className="-mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-line px-4">
        {FANER.map((f) => (
          <button key={f.v} role="tab" aria-selected={fane === f.v} onClick={() => setFane(f.v)}
            className={`min-h-12 flex-none whitespace-nowrap px-3 text-base font-bold ${fane === f.v ? 'text-ink shadow-[inset_0_-3px_0_var(--accent)]' : 'text-muted'}`}>
            {f.l} <span className="text-muted">({antall(f.v)})</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Felt label="Søk" type="search" placeholder="Navn, skole eller arrangement" value={sok} onChange={(e) => setSok(e.target.value)} />
        <Velg label="Arrangør" value={arrFilter} onChange={(e) => setArrFilter(e.target.value)}>
          <option value="">Alle</option>
          {arrangorer.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </Velg>
        <Felt label="Arrangement fra og med" type="date" value={fraDato} onChange={(e) => setFraDato(e.target.value)} />
      </div>

      {fane !== 'sendt' && fane !== 'avslatt' && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Knapp disabled={!valgteVenter.length || !!sender} onClick={() => setBekreft(true)}>
            Send fravær{valgteVenter.length ? ` (${valgteVenter.length})` : ''}
          </Knapp>
          <span className="text-sm text-muted">Merk søknader som venter, og send dokumentasjonen samlet.</span>
        </div>
      )}

      {bekreft && (
        <Boks className="mt-4 !border-2 !border-ink" >
          <div role="alertdialog" aria-label="Bekreft utsending" className="flex flex-col gap-3">
            <p className="m-0">
              Du sender <b>{valgteVenter.length} fraværserklæring{valgteVenter.length === 1 ? '' : 'er'}</b> som{' '}
              <b>{meg?.navn || session?.user.email}</b> (svar går til {meg?.e_post || session?.user.email}).
              {!meg?.signatur && <span className="font-semibold text-warn"> Du har ikke lagt inn signatur ennå.{' '}
                <Link to={`/${org.slug}/attestant/innstillinger`}>Legg inn signatur</Link>.</span>}
            </p>
            <div className="flex gap-2"><Knapp onClick={sendValgte}>Send nå</Knapp><Knapp variant="spoekelse" onClick={() => setBekreft(false)}>Avbryt</Knapp></div>
          </div>
        </Boks>
      )}

      {sender && <div className="mt-4"><Varsel>Sender {sender.i} av {sender.n} …</Varsel></div>}
      {resultater && resultater.length > 0 && (
        <Boks className="mt-4">
          <p className="m-0 font-semibold">Resultat</p>
          <ul className="mb-0 mt-2 flex flex-col gap-1 p-0 text-sm">
            {resultater.map((r) => (
              <li key={r.soknad_id} className={`list-none ${r.ok ? 'text-ok' : 'text-warn'}`}>
                {r.ok ? '✓' : '✗'} {r.navn ?? navnPaa(r.soknad_id)} –{' '}
                {r.allerede_sendt ? 'allerede sendt (ikke sendt på nytt)' : r.ok ? `sendt (${r.kanal})` : r.feil}
              </li>
            ))}
          </ul>
          {!sender && <button type="button" className="mt-2 text-sm underline" onClick={() => setResultater(null)}>Lukk</button>}
        </Boks>
      )}

      <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0 md:hidden">
        {filtrert.length === 0 && <li className="p-10 text-center text-muted">Ingen søknader her.</li>}
        {filtrert.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0"><strong className="block text-lg">{s.navn}</strong><span className="text-[15px] text-muted">{s.skole}</span></div>
              <StatusMerke status={s.status} />
            </div>
            <div className="flex flex-col gap-1">
              <strong className="text-base leading-tight">{s.arrangement}</strong>
              <span className="text-[15px] text-muted">{TYPE_ETIKETT[s.type_arrangement]} · {tidTekst(s)} · {s.arrangorer?.navn}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              {s.status === 'venter'
                ? <Knapp className="!min-h-12" disabled={!!sender} onClick={() => { setValgt(new Set([s.id])); setBekreft(true); window.scrollTo(0, 0) }}>Send fravær</Knapp>
                : <span />}
              <Knapp variant="spoekelse" className="!min-h-12" onClick={() => setParams({ soknad: s.id })}>Detaljer</Knapp>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
        <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th className="w-12 p-3">
                <input type="checkbox" className="size-5" aria-label="Velg alle som venter" checked={alleValgt} disabled={!venterIFilter.length} onChange={veksleAlle} />
              </th>
              <th className="p-3">Søker</th><th className="p-3">Arrangement</th><th className="p-3">Tid</th>
              <th className="p-3">Arrangør</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrert.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Ingen søknader her.</td></tr>}
            {filtrert.map((s) => (
              <tr key={s.id} className="border-b border-soft last:border-0 hover:bg-soft/50">
                <td className="p-3">
                  <input type="checkbox" className="size-5" aria-label={`Velg ${s.navn}`} disabled={s.status !== 'venter'}
                    checked={valgt.has(s.id)} onChange={() => veksle(s.id)} />
                </td>
                <td className="p-3"><button type="button" className="text-left font-bold underline-offset-2 hover:underline" onClick={() => setParams({ soknad: s.id })}>{s.navn}</button>
                  <div className="text-sm text-muted">{s.skole}</div></td>
                <td className="p-3">{s.arrangement}<div className="text-sm text-muted">{TYPE_ETIKETT[s.type_arrangement]}</div></td>
                <td className="p-3 text-sm">{tidTekst(s)}</td>
                <td className="p-3 text-sm">{s.arrangorer?.navn}</td>
                <td className="p-3"><StatusMerke status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {apen && soknader?.find((s) => s.id === apen) && (
        <Detalj
          soknad={soknader.find((s) => s.id === apen)!}
          onLukk={() => setParams({})}
          onEndret={hent}
        />
      )}
    </main>
  )
}

function Detalj({ soknad, onLukk, onEndret }: { soknad: Soknad; onLukk: () => void; onEndret: () => Promise<void> }) {
  const [rediger, setRediger] = useState(false)
  const [kladd, setKladd] = useState(soknad)
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfFeil, setPdfFeil] = useState('')
  const [melding, setMelding] = useState<{ t: 'ok' | 'warn'; s: string } | null>(null)
  const [avslaar, setAvslaar] = useState(false)
  const [begrunnelse, setBegrunnelse] = useState('')
  const [jobber, setJobber] = useState(false)
  const kanBehandles = soknad.status === 'venter'

  useEffect(() => { setKladd(soknad) }, [soknad])

  // Forhåndsvisning: samme serverkode som lager PDF-en som sendes.
  useEffect(() => {
    let url = ''
    let avbrutt = false
    setPdfFeil('')
    const t = setTimeout(() => {
      funksjonFil('pdf', {
        soknad_id: soknad.id,
        overstyr: rediger ? pick(kladd) : undefined,
      }).then(({ blob }) => {
        if (avbrutt) return
        url = URL.createObjectURL(blob)
        setPdfUrl(url)
      }).catch((e) => !avbrutt && setPdfFeil(e instanceof ApiFeil ? e.message : 'Kunne ikke lage forhåndsvisning.'))
    }, 350)
    return () => { avbrutt = true; clearTimeout(t); if (url) URL.revokeObjectURL(url) }
  }, [soknad, kladd, rediger])

  const lagre = async () => {
    setJobber(true)
    const { error } = await supabase.from('soknader').update(pick(kladd)).eq('id', soknad.id)
    setJobber(false)
    if (error) return setMelding({ t: 'warn', s: 'Kunne ikke lagre: ' + error.message })
    setRediger(false)
    setMelding({ t: 'ok', s: 'Endringene er lagret.' })
    await onEndret()
  }
  const send = async () => {
    setJobber(true)
    try {
      const r = await funksjon<{ resultater: Resultat[] }>('send-fravaer', { soknad_ids: [soknad.id] })
      const x = r.resultater[0]
      setMelding(x.ok ? { t: 'ok', s: x.allerede_sendt ? 'Var allerede sendt.' : `Fraværserklæringen er sendt (${x.kanal}).` } : { t: 'warn', s: x.feil ?? 'Feilet.' })
    } catch (e) { setMelding({ t: 'warn', s: e instanceof ApiFeil ? e.message : 'Feilet.' }) }
    setJobber(false)
    await onEndret()
  }
  const avsla = async () => {
    setJobber(true)
    try {
      await funksjon('avsla', { soknad_id: soknad.id, begrunnelse })
      setMelding({ t: 'ok', s: 'Søknaden er avslått, og søkeren har fått beskjed.' })
      setAvslaar(false)
    } catch (e) { setMelding({ t: 'warn', s: e instanceof ApiFeil ? e.message : 'Feilet.' }) }
    setJobber(false)
    await onEndret()
  }
  const sett = <K extends keyof Soknad>(k: K, v: Soknad[K]) => setKladd((x) => ({ ...x, [k]: v }))

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onLukk} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label={`Søknad fra ${soknad.navn}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col overflow-y-auto bg-bg shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="m-0 text-xl font-extrabold">{soknad.navn} <StatusMerke status={soknad.status} /></h2>
          <Knapp variant="spoekelse" onClick={onLukk}>Lukk</Knapp>
        </div>
        <div className="flex flex-col gap-6 p-5">
          {melding && <Varsel type={melding.t}>{melding.s}</Varsel>}

          {!rediger ? (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              <Rad k="Skole" v={soknad.skole} /><Rad k="E-post" v={soknad.e_post} /><Rad k="Telefon" v={soknad.telefon} />
              <Rad k="Arrangør" v={soknad.arrangorer?.navn} /><Rad k="Type" v={TYPE_ETIKETT[soknad.type_arrangement]} />
              <Rad k="Arrangement" v={`${soknad.arrangement} (${soknad.har_vaert ? 'har vært' : 'skal være'})`} />
              <Rad k="Tid" v={tidTekst(soknad)} /><Rad k="Sted" v={soknad.sted} /><Rad k="Kommentar" v={soknad.kommentar} />
              <Rad k="Mottatt" v={fmtDatoTid(soknad.opprettet)} />
              {soknad.behandlet_tid && <Rad k="Behandlet" v={fmtDatoTid(soknad.behandlet_tid)} />}
              {soknad.avslag_begrunnelse && <Rad k="Begrunnelse" v={soknad.avslag_begrunnelse} />}
            </dl>
          ) : (
            <div className="flex flex-col gap-3">
              <Felt label="Navn" value={kladd.navn} onChange={(e) => sett('navn', e.target.value)} />
              <Felt label="Skole" value={kladd.skole} onChange={(e) => sett('skole', e.target.value)} />
              <Felt label="E-post" type="email" value={kladd.e_post} onChange={(e) => sett('e_post', e.target.value)} />
              <Felt label="Arrangement" value={kladd.arrangement} onChange={(e) => sett('arrangement', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Felt label="Fra dato" type="date" value={kladd.dato_fra} onChange={(e) => sett('dato_fra', e.target.value)} />
                <Felt label="Fra kl." type="time" value={kladd.tid_fra.slice(0, 5)} onChange={(e) => sett('tid_fra', e.target.value)} />
                <Felt label="Til dato" type="date" value={kladd.dato_til} onChange={(e) => sett('dato_til', e.target.value)} />
                <Felt label="Til kl." type="time" value={kladd.tid_til.slice(0, 5)} onChange={(e) => sett('tid_til', e.target.value)} />
              </div>
              <Felt label="Sted" value={kladd.sted ?? ''} onChange={(e) => sett('sted', e.target.value)} />
              <div className="flex gap-2"><Knapp onClick={lagre} disabled={jobber}>Lagre endringer</Knapp>
                <Knapp variant="spoekelse" onClick={() => { setRediger(false); setKladd(soknad) }}>Avbryt</Knapp></div>
            </div>
          )}

          {kanBehandles && !rediger && !avslaar && (
            <div className="flex flex-wrap gap-2">
              <Knapp onClick={send} disabled={jobber}>{jobber ? 'Sender …' : 'Send fravær'}</Knapp>
              <Knapp variant="linje" onClick={() => setRediger(true)}>Rediger</Knapp>
              <Knapp variant="fare" onClick={() => setAvslaar(true)}>Avslå</Knapp>
            </div>
          )}
          {avslaar && (
            <Boks className="flex flex-col gap-3">
              <Tekstomrade label="Begrunnelse som sendes til søkeren" valgfri rows={3} value={begrunnelse} onChange={(e) => setBegrunnelse(e.target.value)} />
              <div className="flex gap-2"><Knapp variant="fare" onClick={avsla} disabled={jobber}>Avslå og send svar</Knapp>
                <Knapp variant="spoekelse" onClick={() => setAvslaar(false)}>Avbryt</Knapp></div>
            </Boks>
          )}

          <section aria-label="Forhåndsvisning av fraværserklæringen" className="flex flex-col gap-2">
            <Overskrift>Fraværserklæring</Overskrift>
            {pdfFeil ? <Varsel type="warn">{pdfFeil}</Varsel> : pdfUrl ? (
              <iframe title="Forhåndsvisning av PDF" src={pdfUrl} className="h-[70vh] w-full rounded-lg border-[1.5px] border-line bg-white" />
            ) : <Laster tekst="Lager forhåndsvisning …" />}
          </section>
        </div>
      </aside>
    </>
  )
}

const pick = (s: Soknad) => ({
  navn: s.navn, skole: s.skole, e_post: s.e_post, arrangement: s.arrangement, sted: s.sted,
  dato_fra: s.dato_fra, tid_fra: s.tid_fra, dato_til: s.dato_til, tid_til: s.tid_til,
})

function Rad({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null
  return (<><dt className="text-muted">{k}</dt><dd className="m-0 [overflow-wrap:anywhere]">{v}</dd></>)
}
