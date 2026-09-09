import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub?.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return <NotConfigured />
  }

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return children
}

export function NotConfigured() {
  const navigate = useNavigate()
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2>⚠️ Supabase not configured</h2>
        <p>
          Add your <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to <code>client/.env</code>, then
          restart the dev server. See <code>client/README.md</code>.
        </p>
        <button
          className="login-btn"
          onClick={() => navigate('/')}
          style={{ width: '100%', marginTop: 8 }}
        >
          Back to booth
        </button>
      </div>
    </div>
  )
}