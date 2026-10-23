import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiFeil, funksjon } from '../lib/supabase'
import { Boks, Laster, StatusMerke, Varsel, fmtDatoTid } from '../ui'
import type { SoknadStatus } from '../lib/types'
import { useOrg } from './OrgLayout'

export function Kvittering() {
  const org = useOrg()
  const { id = '' } = useParams()
  let token = ''
  try { token = sessionStorage.getItem(`status-${id}`) ?? '' } catch { /* ignorer */ }
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-10 pt-5">
      <div aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-accent text-[32px] font-extrabold text-on-accent">✓</div>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[clamp(34px,9vw,44px)] font-black leading-none tracking-tight">Søknaden er sendt</h1>
        <p className="m-0 text-[17px] text-muted">
          Takk! En attestant i {org.navn} får beskjed om søknaden din. Når den er behandlet, får du fraværserklæringen
          (eller et svar) på e-post.
        </p>
      </div>
      <Boks className="!p-5">
        <strong className="mb-3.5 block text-lg">Hva skjer nå</strong>
        <ol className="m-0 grid list-none grid-cols-[28px_1fr] gap-x-3 p-0">
          <Steg ferdig linje tittel="Mottatt" tekst="Søknaden din er registrert." />
          <Steg aktiv linje tittel={`Bekreftes av ${org.navn}`} tekst="De sjekker at du var der." />
          <Steg tittel="PDF på e-post" tekst="Du får fraværserklæringen tilsendt." />
        </ol>
        <p className="m-0 mt-4 border-t border-line pt-3.5 text-[15px] font-semibold">Vanligvis innen 2 dager.</p>
      </Boks>
      {token ? (
        <>
          <p className="m-0">Vi har også sendt deg en kvittering på e-post.</p>
          <Link to={`/${org.slug}/status/${token}`}
            className="flex min-h-14 items-center justify-center rounded-xl border-2 border-fg bg-surface text-[17px] font-bold text-fg no-underline">
            Se status for søknaden
          </Link>
        </>
      ) : (
        <p className="m-0 text-muted">Statuslenken står i kvitterings-e-posten vi har sendt til deg.</p>
      )}
      <Link to={`/${org.slug}`} className="flex min-h-11 items-center justify-center font-bold underline underline-offset-4">Send en søknad til</Link>
    </main>
  )
}

function Steg({ tittel, tekst, ferdig, aktiv, linje }: { tittel: string; tekst: string; ferdig?: boolean; aktiv?: boolean; linje?: boolean }) {
  return (
    <>
      <li aria-hidden="true" className="col-start-1 flex list-none flex-col items-center">
        <span className={`flex size-7 flex-none items-center justify-center rounded-full text-[15px] font-extrabold ${ferdig ? 'bg-accent text-on-accent' : aktiv ? 'box-border border-[3px] border-accent' : 'box-border border-2 border-line'}`}>
          {ferdig && '✓'}
        </span>
        {linje && <span className={`min-h-5 w-0.5 flex-1 ${ferdig ? 'bg-accent' : 'bg-line'}`} />}
      </li>
      <li className={`col-start-2 list-none ${linje ? 'pb-4' : ''}`}>
        <strong className="text-[17px]">{tittel}</strong>
        <div className="text-[15px] text-muted">{tekst}</div>
      </li>
    </>
  )
}

type StatusSvar = {
  organisasjon: { navn: string; kontakt_epost: string | null }
  soknad: { navn: string; arrangement: string; arrangor: string; tid: string; status: SoknadStatus; opprettet: string; behandlet_tid: string | null; avslag_begrunnelse: string | null }
}

export function StatusSide() {
  const org = useOrg()
  const { token = '' } = useParams()
  const [data, setData] = useState<StatusSvar | null | undefined>(undefined)

  useEffect(() => {
    funksjon<StatusSvar>('status', { token }, false)
      .then(setData)
      .catch((e) => setData(e instanceof ApiFeil && e.status === 404 ? null : null))
  }, [token])

  if (data === undefined) return <Laster />
  if (data === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-4xl font-extrabold">Fant ikke søknaden</h1>
        <p className="mt-3 text-muted">Sjekk at du har brukt hele lenken fra e-posten.</p>
      </main>
    )
  }
  const s = data.soknad
  const tekst: Record<SoknadStatus, string> = {
    venter: 'Søknaden venter på behandling hos en attestant.',
    sendt: 'Fraværserklæringen er sendt til e-postadressen din. Sjekk også søppelposten.',
    avslatt: 'Søknaden ble dessverre avslått.',
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-[clamp(32px,6vw,52px)] font-extrabold leading-tight tracking-tight">Status for søknaden</h1>
      <Boks className="mt-6 flex flex-col gap-4">
        <div className="flex items-center gap-3"><StatusMerke status={s.status} /><span className="font-semibold">{tekst[s.status]}</span></div>
        {s.status === 'avslatt' && s.avslag_begrunnelse && <Varsel type="warn">Begrunnelse: {s.avslag_begrunnelse}</Varsel>}
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
          <dt className="text-muted">Navn</dt><dd className="m-0">{s.navn}</dd>
          <dt className="text-muted">Arrangement</dt><dd className="m-0">{s.arrangement}</dd>
          <dt className="text-muted">Tid</dt><dd className="m-0">{s.tid}</dd>
          <dt className="text-muted">Arrangør</dt><dd className="m-0">{s.arrangor}</dd>
          <dt className="text-muted">Sendt inn</dt><dd className="m-0">{fmtDatoTid(s.opprettet)}</dd>
          {s.behandlet_tid && (<><dt className="text-muted">Behandlet</dt><dd className="m-0">{fmtDatoTid(s.behandlet_tid)}</dd></>)}
        </dl>
      </Boks>
      {data.organisasjon.kontakt_epost && (
        <p className="mt-6 text-sm text-muted">
          Spørsmål? Kontakt {org.navn}: <a href={`mailto:${data.organisasjon.kontakt_epost}`}>{data.organisasjon.kontakt_epost}</a>
        </p>
      )}
    </main>
  )
}
