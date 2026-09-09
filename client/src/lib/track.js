import { supabase, isSupabaseConfigured } from './supabase'

function det(ua, patterns) {
  for (const [k, p] of Object.entries(patterns)) {
    if (p.test(ua)) return k
  }
  return 'Unknown'
}

export function detectDevice(ua) {
  return det(ua, {
    iPhone: /iPhone/,
    iPad: /iPad/,
    Android: /Android/,
    Windows: /Windows/,
    Mac: /Macintosh/,
  })
}

export function detectBrowser(ua) {
  return det(ua, {
    'Chrome iOS': /CriOS/,
    'Firefox iOS': /FxiOS/,
    'Edge Android': /EdgA/,
    Chrome: /Chrome/,
    Firefox: /Firefox/,
    Safari: /Safari/,
    Edge: /Edge/,
  })
}

/** Fire-and-forget visit log. Runs once per page load. */
export function trackVisit() {
  if (!isSupabaseConfigured) return
  if (sessionStorage.getItem('be_visit_tracked')) return
  sessionStorage.setItem('be_visit_tracked', '1')

  const ua = navigator.userAgent
  supabase
    .from('visits')
    .insert({
      device: detectDevice(ua),
      browser: detectBrowser(ua),
      language: navigator.language,
      referer: document.referrer || 'direct',
    })
    .then(() => {})
    .catch(() => {})
}

export function uid() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function nowStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}