import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { AuthProvider } from './lib/auth'
import { MANGLER_KONFIG } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {MANGLER_KONFIG ? (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-3xl font-extrabold">Appen er ikke ferdig satt opp</h1>
        <p className="mt-3 text-muted">
          Miljøvariablene <code>VITE_SUPABASE_URL</code> og <code>VITE_SUPABASE_ANON_KEY</code> mangler i bygget. Legg dem
          inn i hostingtjenesten (Vercel → Settings → Environment Variables) og bygg på nytt.
        </p>
      </main>
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
)
