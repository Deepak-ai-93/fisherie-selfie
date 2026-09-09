import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import logoUrl from '../assets/fisheries.svg'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const next = new URLSearchParams(location.search).get('next') || '/gallery'

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message || 'Invalid email or password.')
      return
    }
    navigate(next, { replace: true })
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img className="login-logo" src={logoUrl} alt="Gujarat Fisheries" />
        <h2>Team Sign in</h2>
        <p>I Support Blue Economy — Gujarat Fisheries.<br />Marketing team access only.</p>
        {error && <div className="err">{error}</div>}
        <form onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button
          className="link-back"
          onClick={() => navigate('/')}
          style={{ width: '100%', marginTop: 12 }}
        >
          ← Back to booth
        </button>
      </div>
    </div>
  )
}