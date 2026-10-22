import { Route, Routes } from 'react-router-dom'
import { OrgLayout, Krev } from './pages/OrgLayout'
import { Forside } from './pages/Forside'
import { LoggInn, IngenTilgang } from './pages/LoggInn'
import { Soknad } from './pages/Soknad'
import { Kvittering, StatusSide } from './pages/Kvittering'
import { Dashboard } from './pages/Dashboard'
import { Innstillinger } from './pages/Innstillinger'
import { Admin } from './pages/Admin'
import { Superadmin } from './pages/Superadmin'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Forside />} />
      <Route path="/logg-inn" element={<LoggInn />} />
      <Route path="/ingen-tilgang" element={<IngenTilgang />} />
      <Route path="/superadmin" element={<Superadmin />} />
      <Route path="/:org" element={<OrgLayout />}>
        <Route index element={<Soknad />} />
        <Route path="kvittering/:id" element={<Kvittering />} />
        <Route path="status/:token" element={<StatusSide />} />
        <Route path="attestant" element={<Krev rolle="attestant" />}>
          <Route index element={<Dashboard />} />
          <Route path="innstillinger" element={<Innstillinger />} />
        </Route>
        <Route path="admin" element={<Krev rolle="admin" />}>
          <Route index element={<Admin />} />
        </Route>
        <Route path="*" element={<p className="py-10 text-center">Fant ikke siden.</p>} />
      </Route>
    </Routes>
  )
}
