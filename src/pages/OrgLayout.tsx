import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { logoUrl, supabase } from '../lib/supabase'
import { applyTheme } from '../lib/theme'
import { useAuth } from '../lib/auth'
import type { OrgProfil } from '../lib/types'
import { Laster } from '../ui'

export type OrgKontekst = { org: OrgProfil }
export const useOrg = () => useOutletContext<OrgKontekst>().org

/** Laster organisasjonens offentlige profil, setter fargene og viser topplinjen. */
export function OrgLayout() {
  const { org: slug = '' } = useParams()
  const [org, setOrg] = useState<OrgProfil | null | undefined>(undefined)
  const { session, loggUt } = useAuth()

  useEffect(() => {
    let avbrutt = false
    setOrg(undefined)
    supabase.rpc('organisasjon_profil', { p_slug: slug }).then(({ data }) => {
      if (avbrutt) return
      const o = (data as OrgProfil | null) ?? null
      setOrg(o)
      applyTheme(o?.profil.colors)
      document.title = o ? `${o.profil.pageTitle ?? 'Politisk fravær'} – ${o.navn}` : 'Politisk fravær'
    })
    return () => {
      avbrutt = true
      applyTheme(undefined)
    }
  }, [slug])

  if (org === undefined) return <Laster />
  if (org === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-3xl font-extrabold">Fant ikke organisasjonen</h1>
        <p className="mt-3 text-muted">Sjekk adressen, eller <Link to="/">finn organisasjonen din i listen</Link>.</p>
      </main>
    )
  }

  const logo = logoUrl(org.profil.logo)
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link to={`/${org.slug}`} className="flex min-w-0 items-center gap-3 font-bold text-fg no-underline">
            {logo && <img src={logo} alt="" className="h-[34px] max-w-[180px] object-contain" />}
            <span>{org.navn}</span>
          </Link>
          <nav aria-label="Hovedmeny" className="flex items-center gap-4 text-sm font-semibold">
            {session ? (
              <>
                <Link to={`/${org.slug}/attestant`}>Dashboard</Link>
                <button type="button" className="text-muted underline" onClick={loggUt}>Logg ut</button>
              </>
            ) : (
              <Link to={`/logg-inn?next=${encodeURIComponent(`/${org.slug}/attestant`)}`}>Attestant? Logg inn</Link>
            )}
          </nav>
        </div>
      </header>
      <Outlet context={{ org } satisfies OrgKontekst} />
    </>
  )
}

/** Krever innlogging og riktig rolle i organisasjonen. */
export function Krev({ rolle }: { rolle: 'attestant' | 'admin' }) {
  const { org } = useOutletContext<OrgKontekst>()
  const { session, laster, mineOrg, lasterOrg } = useAuth()
  const sted = useLocation()
  if (laster || (session && lasterOrg)) return <Laster />
  if (!session) return <Navigate to={`/logg-inn?next=${encodeURIComponent(sted.pathname + sted.search)}`} replace />
  const mine = mineOrg.filter((m) => m.slug === org.slug)
  const ok = mine.some((m) => m.rolle === 'superadmin' || m.rolle === 'admin' || (rolle === 'attestant' && m.rolle === 'attestant'))
  if (!ok) return <Navigate to={`/ingen-tilgang?org=${org.slug}`} replace />
  return <Outlet context={{ org } satisfies OrgKontekst} />
}
