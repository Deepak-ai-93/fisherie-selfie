import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function fmtDate(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default function Logs() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'auto'
    document.body.style.background = '#f0f4f8'
    return () => {
      document.body.style.overflow = prev
      document.body.style.background = ''
    }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('consents')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setEntries(
        data.map((e) => ({
          ...e,
          _date: fmtDate(e.created_at),
          _search: (e.device + ' ' + e.browser + ' ' + e.ip + ' ' + fmtDate(e.created_at)).toLowerCase(),
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  const filtered = entries.filter((e) => e._search.includes(query.toLowerCase()))

  const total = entries.length
  const topOf = (key) => {
    const counts = {}
    entries.forEach((e) => { if (e[key]) counts[e[key]] = (counts[e[key]] || 0) + 1 })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? `${top[0]} (${top[1]})` : '—'
  }
  const latest = total > 0 ? entries[0]._date : '—'

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div>
      <div className="header">
        <div>
          <h1>Consent Log — I Support Blue Economy</h1>
          <small>Gujarat Fisheries Campaign</small>
        </div>
        <button className="logout-btn" onClick={logout}>Log out</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="num">{total}</div><div className="lbl">Total consents</div></div>
        <div className="stat"><div className="num" style={{ fontSize: 16 }}>{latest}</div><div className="lbl">Latest entry</div></div>
        <div className="stat"><div className="num" style={{ fontSize: 16 }}>{topOf('device')}</div><div className="lbl">Top device</div></div>
        <div className="stat"><div className="num" style={{ fontSize: 16 }}>{topOf('browser')}</div><div className="lbl">Top browser</div></div>
      </div>

      <div className="search">
        <input
          type="text"
          placeholder="Search by IP, device, date…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date &amp; Time</th>
              <th>Consent</th>
              <th>Device</th>
              <th>Browser</th>
              <th>Language</th>
              <th>IP</th>
              <th>File</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={e.id}>
                <td>{total - entries.indexOf(e)}</td>
                <td>{e._date}</td>
                <td><span className="badge yes">✓ Given</span></td>
                <td>{e.device || '—'}</td>
                <td>{e.browser || '—'}</td>
                <td>{(e.language || '—').slice(0, 8)}</td>
                <td className="ip">{e.ip || '—'}</td>
                <td className="file">{e.photo_id || '—'}</td>
                <td>{e.file_size_kb ? Math.round(e.file_size_kb) + ' KB' : '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 32, color: '#789' }}>
                {loading ? 'Loading…' : 'No entries yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <div className="empty" style={{ color: '#b42828' }}>Error: {error}</div>}
    </div>
  )
}