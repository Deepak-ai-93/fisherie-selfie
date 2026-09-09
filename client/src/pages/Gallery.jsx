import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PER_PAGE = 24

function fmtDate(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default function Gallery() {
  const navigate = useNavigate()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'auto'
    document.body.style.background = '#f0f4f8'
    return () => {
      document.body.style.overflow = prev
      document.body.style.background = ''
    }
  }, [])

  const filtered = photos.filter((p) =>
    (p.date + ' ' + p.storage_path).toLowerCase().includes(query.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  const today = new Date().toDateString()
  const stats = {
    total: photos.length,
    today: photos.filter((p) => new Date(p.created_at).toDateString() === today).length,
    week: photos.filter(
      (p) => Date.now() - new Date(p.created_at).getTime() <= 7 * 24 * 3600 * 1000
    ).length,
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('consents')
        .select('id, created_at, storage_path, photo_id, file_size_kb')
        .order('created_at', { ascending: false })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      const withUrls = await Promise.all(
        data.map(async (c) => {
          let url = ''
          if (c.storage_path) {
            const { data: signed } = await supabase.storage
              .from('selfies')
              .createSignedUrl(c.storage_path, 3600)
            url = signed?.signedUrl || ''
          }
          return {
            ...c,
            url,
            date: fmtDate(c.created_at),
            size: c.file_size_kb ? Math.round(c.file_size_kb) + ' KB' : '—',
          }
        })
      )
      setPhotos(withUrls)
      setLoading(false)
    }
    load()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div>
      <div className="header">
        <div className="header-left">
          <h1>Campaign Gallery — I Support Blue Economy</h1>
          <small>Gujarat Fisheries</small>
        </div>
        <div className="header-right">
          <span className="badge-count">{photos.length} selfies</span>
          <button className="logout-btn" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="num">{stats.total}</div><div className="lbl">Total selfies</div></div>
        <div className="stat"><div className="num">{stats.today}</div><div className="lbl">Today</div></div>
        <div className="stat"><div className="num">{stats.week}</div><div className="lbl">This week</div></div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search by date or filename…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
        />
      </div>

      {loading && <div className="empty">Loading photos…</div>}
      {error && <div className="empty" style={{ color: '#b42828' }}>Error: {error}</div>}

      {!loading && !error && slice.length > 0 && (
        <>
          <div className="grid">
            {slice.map((p) => (
              <div className="card" key={p.id}>
                <img src={p.url} alt="Selfie" loading="lazy" onClick={() => setLightbox(p)} />
                <div className="card-info">
                  <div className="card-date">{p.date}</div>
                  <div className="card-size">{p.size}</div>
                  <a className="card-dl" href={p.url} download>↓ Download</a>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pages">
              {safePage > 1 && <a href="#" onClick={(e) => { e.preventDefault(); setPage(safePage - 1) }}>← Prev</a>}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n >= safePage - 2 && n <= safePage + 2)
                .map((n) =>
                  n === safePage ? (
                    <span key={n}>{n}</span>
                  ) : (
                    <a key={n} href="#" onClick={(e) => { e.preventDefault(); setPage(n) }}>{n}</a>
                  )
                )}
              {safePage < totalPages && <a href="#" onClick={(e) => { e.preventDefault(); setPage(safePage + 1) }}>Next →</a>}
            </div>
          )}
        </>
      )}

      {!loading && !error && slice.length === 0 && (
        <div className="empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#789" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <p>No photos yet. They'll appear here once people use the filter.</p>
        </div>
      )}

      {lightbox && (
        <div id="lightbox" className="show" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null) }}>
          <button className="lb-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox.url} alt="Selfie" />
          <div id="lb-date">{lightbox.date}</div>
          <div className="lb-bar">
            <a id="lb-dl" href={lightbox.url} download>↓ Download</a>
          </div>
        </div>
      )}
    </div>
  )
}