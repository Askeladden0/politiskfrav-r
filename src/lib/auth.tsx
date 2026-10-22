import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { MinOrg } from './types'

type AuthState = {
  session: Session | null
  laster: boolean
  mineOrg: MinOrg[]
  lasterOrg: boolean
  loggUt: () => Promise<void>
}

const Ctx = createContext<AuthState>({ session: null, laster: true, mineOrg: [], lasterOrg: false, loggUt: async () => {} })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [laster, setLaster] = useState(true)
  const [mineOrg, setMineOrg] = useState<MinOrg[]>([])
  const [lasterOrg, setLasterOrg] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLaster(false)
    })
    const { data: lytter } = supabase.auth.onAuthStateChange((_hendelse, s) => setSession(s))
    return () => lytter.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setMineOrg([])
      return
    }
    let avbrutt = false
    setLasterOrg(true)
    ;(async () => {
      // Knytter innloggingen til attestantrader med samme e-post (første innlogging).
      await supabase.rpc('koble_innlogget_bruker')
      const { data } = await supabase.rpc('mine_organisasjoner')
      if (!avbrutt) {
        setMineOrg((data as MinOrg[]) ?? [])
        setLasterOrg(false)
      }
    })()
    return () => {
      avbrutt = true
    }
  }, [session?.user.id])

  const loggUt = async () => {
    await supabase.auth.signOut()
  }

  return <Ctx.Provider value={{ session, laster, mineOrg, lasterOrg, loggUt }}>{children}</Ctx.Provider>
}
