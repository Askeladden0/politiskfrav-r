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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-[clamp(34px,7vw,56px)] font-extrabold leading-tight tracking-tight">Søknaden er sendt</h1>
      <p className="mt-3 text-lg text-muted">
        Takk! En attestant i {org.navn} får beskjed om søknaden din. Når den er behandlet, får du fraværserklæringen
        (eller et svar) på e-post.
      </p>
      <Boks className="mt-8">
        <p className="m-0 font-semibold">Følg med på statusen</p>
        {token ? (
          <p className="mt-2">
            Vi har også sendt deg en kvittering på e-post. Du kan se status her uten å logge inn:{' '}
            <Link to={`/${org.slug}/status/${token}`}>Se status for søknaden</Link>
          </p>
        ) : (
          <p className="mt-2 text-muted">Statuslenken står i kvitterings-e-posten vi har sendt til deg.</p>
        )}
      </Boks>
      <p className="mt-8"><Link to={`/${org.slug}`}>Send en ny søknad</Link></p>
    </main>
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
