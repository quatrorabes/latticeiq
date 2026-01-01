
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@lib/supabaseClient'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let mounted = true

    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) {
        setSession(session)
        setUser(session?.user || null)
        setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setSession(session)
        setUser(session?.user || null)
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  return { session, loading, user, logout }
}