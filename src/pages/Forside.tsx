import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Laster } from '../ui'

export function Forside() {
  const [orger, setOrger] = useState<{ slug: string; navn: string }[] | null>(null)
  useEffect(() => {
    document.title = 'Politisk fravær'
    supabase.rpc('aktive_organisasjoner').then(({ data }) => setOrger((data as { slug: string; navn: string }[]) ?? []))
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-[clamp(38px,8vw,64px)] font-extrabold leading-[0.98] tracking-tight">Politisk fravær</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-muted">
        Her kan du som tillitsvalgt søke om dokumentasjon på politisk fravær fra organisasjonen din. En attestant
        godkjenner søknaden og sender fraværserklæringen på e-post.
      </p>

      <h2 className="mt-12 border-b-2 border-fg pb-2.5 text-[23px] font-bold">Finn organisasjonen din</h2>
      {orger === null ? (
        <Laster />
      ) : orger.length === 0 ? (
        <p className="mt-4 text-muted">Ingen organisasjoner er åpnet ennå.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 p-0">
          {orger.map((o) => (
            <li key={o.slug} className="list-none">
              <Link
                to={`/${o.slug}`}
                className="flex min-h-12 items-center justify-between rounded-lg border-[1.5px] border-line bg-surface px-4 py-3 font-semibold text-fg no-underline hover:border-fg"
              >
                {o.navn}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-muted">
        Attestant eller administrator? <Link to="/logg-inn">Logg inn</Link>.
      </p>
    </main>
  )
}
