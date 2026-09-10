import { useCallback, useEffect, useRef, useState } from 'react'
import {
  supabase,
  isSupabaseConfigured,
  CAMPAIGN,
  CONSENT_TEXT,
  CAPTION,
} from '../lib/supabase'
import { trackVisit, detectDevice, detectBrowser, uid, nowStamp } from '../lib/track'
import frameUrl from '../assets/fisheries-frame-v2.png'
import logoUrl from '../assets/fisheries.svg'

const W = 1080
const H = 1350

export default function Booth() {
  // ── refs ──────────────────────────────────────────────
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const frameRef = useRef(null)
  const toastTimer = useRef(null)

  // ── state ─────────────────────────────────────────────
  const [phase, setPhase] = useState('gate') // gate | camera | blocked
  const [consent, setConsent] = useState(false)
  const [facing, setFacing] = useState('user')
  const [startLabel, setStartLabel] = useState('Start camera')
  const [shotUrl, setShotUrl] = useState(null) // preview blob url
  const [lastBlob, setLastBlob] = useState(null)
  const [lastDataURL, setLastDataURL] = useState(null)
  const [uploaded, setUploaded] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [saveMsg, setSaveMsg] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState('')

  // ── visit tracking on load ────────────────────────────
  useEffect(() => {
    trackVisit()
  }, [])

  // ── stop stream on unmount ────────────────────────────
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const showToast = useCallback((msg, dur = 2600) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), dur)
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const openCamera = useCallback(
    async (face) => {
      stopStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: face }, width: { ideal: 1080 }, height: { ideal: 1350 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.classList.toggle('mirror', face === 'user')
        await new Promise((resolve) => {
          const done = () => {
            videoRef.current?.removeEventListener('canplay', done)
            videoRef.current?.removeEventListener('loadedmetadata', done)
            resolve()
          }
          videoRef.current?.addEventListener('canplay', done)
          videoRef.current?.addEventListener('loadedmetadata', done)
          videoRef.current?.play().catch(resolve)
          setTimeout(resolve, 3000)
        })
      }
    },
    [stopStream]
  )

  async function startCamera() {
    if (!consent) return
    setStartLabel('Starting camera…')
    try {
      await openCamera('user')
      setPhase('camera')
    } catch (e) {
      setPhase('blocked')
      setStartLabel('Try again')
    }
  }

  async function flip() {
    if (!streamRef.current) return
    const next = facing === 'user' ? 'environment' : 'user'
    try {
      setFacing(next)
      await openCamera(next)
    } catch (e) {
      setFacing(facing)
      showToast('No second camera found')
      try {
        await openCamera(facing)
      } catch (_) {}
    }
  }

  // ── SVG-safe frame loader ─────────────────────────────
  async function loadFrameForCanvas() {
    const test = document.createElement('canvas')
    test.width = 1
    test.height = 1
    try {
      test.getContext('2d').drawImage(frameRef.current, 0, 0, 1, 1)
      test.toDataURL()
      return frameRef.current
    } catch (_) {
      const resp = await fetch(frameUrl)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      return new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = rej
        img.src = url
      })
    }
  }

  // ── compose 4:5 canvas ────────────────────────────────
  async function compose() {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    const vw = video.videoWidth
    const vh = video.videoHeight
    const scale = Math.max(W / vw, H / vh)
    const dw = vw * scale
    const dh = vh * scale
    ctx.save()
    if (facing === 'user') {
      ctx.translate(W, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh)
    ctx.restore()

    try {
      const fi = await loadFrameForCanvas()
      ctx.drawImage(fi, 0, 0, W, H)
    } catch (e) {
      console.warn('Frame composite failed:', e)
    }

    ctx.save()
    ctx.translate(38, H / 2 + 100)
    ctx.rotate(-Math.PI / 2)
    ctx.font = 'bold 22px -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(255,255,255,.75)'
    ctx.strokeText('Created@Topclues', 0, 0)
    ctx.fillStyle = '#000'
    ctx.fillText('Created@Topclues', 0, 0)
    ctx.restore()

    return new Promise((res, rej) => {
      try {
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('empty blob'))), 'image/png', 0.95)
      } catch (err) {
        rej(err)
      }
    })
  }

  // ── upload to supabase ────────────────────────────────
  async function uploadToServer(blobToUpload) {
    const targetBlob = blobToUpload || lastBlob
    if (uploaded || !targetBlob) return true
    if (!isSupabaseConfigured || !supabase) {
      console.error('Supabase not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
      setSaveState('error')
      setSaveMsg('✗ Supabase not configured')
      return false
    }
    setSaveState('saving')
    setSaveMsg('Saving to campaign gallery…')
    try {
      const id = uid()
      const filename = `selfie_${nowStamp()}_${id}.png`

      // 1. Upload image to Supabase storage bucket
      const { error: upErr } = await supabase.storage
        .from('selfies')
        .upload(filename, targetBlob, { contentType: 'image/png', upsert: false })
      if (upErr) {
        console.error('Storage upload error:', upErr)
        throw upErr
      }

      // 2. Insert consent record into database
      const ua = navigator.userAgent
      const { error: insErr } = await supabase.from('consents').insert({
        photo_id: id,
        storage_path: filename,
        consent: true,
        consent_text: CONSENT_TEXT,
        campaign: CAMPAIGN,
        device: detectDevice(ua),
        browser: detectBrowser(ua),
        language: navigator.language,
        referer: document.referrer || 'direct',
        user_agent: ua.slice(0, 300),
        file_size_kb: Math.round((targetBlob.size / 1024) * 10) / 10,
      })
      if (insErr) {
        console.error('Database insert error:', insErr)
        throw insErr
      }

      setUploaded(true)
      setSaveState('saved')
      setSaveMsg('✓ Saved to campaign gallery')
      showToast('Photo saved to campaign database ✓')
      return true
    } catch (e) {
      console.error('Upload failed:', e)
      setSaveState('error')
      setSaveMsg('✗ Server save failed — ' + (e.message || 'unknown error'))
      showToast('Save failed: ' + (e.message || 'Error'))
      return false
    }
  }

  // ── shutter ───────────────────────────────────────────
  async function capture() {
    if (!streamRef.current) return
    try {
      const blob = await compose()
      const dataUrl = await new Promise((r) => {
        const fr = new FileReader()
        fr.onload = () => r(fr.result)
        fr.readAsDataURL(blob)
      })
      setLastBlob(blob)
      setLastDataURL(dataUrl)
      setShotUrl(URL.createObjectURL(blob))
      setUploaded(false)
      setSaveState('idle')
      showToast('Photo captured ✓')
      if (consent) {
        uploadToServer(blob)
      }
    } catch (e) {
      console.error(e)
      showToast('Capture failed — try again')
    }
  }

  function retake() {
    setShotUrl(null)
    setLastBlob(null)
    setLastDataURL(null)
    setUploaded(false)
    setSaveState('idle')
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    try {
      document.execCommand('copy')
      showToast('Caption copied — paste it in your post ✓')
    } catch (e) {
      showToast('Copy: ' + text)
    }
    document.body.removeChild(ta)
  }

  async function copyCaption() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(CAPTION).catch(() => fallbackCopy(CAPTION))
    } else {
      fallbackCopy(CAPTION)
    }
    showToast('Caption copied — paste it in your post ✓', 3500)
    setSheetOpen(false)
  }

  async function sharePhoto() {
    setSheetOpen(false)
    const file = new File([lastBlob], 'i-support-blue-economy.png', { type: 'image/png' })
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(CAPTION).catch(() => fallbackCopy(CAPTION))
    } else {
      fallbackCopy(CAPTION)
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'I Support Blue Economy', text: CAPTION })
        .then(() => {
          if (isIOS) showToast('Caption copied — paste it in your Instagram post ✓', 4000)
        })
        .catch(() => {})
    } else {
      const a = document.createElement('a')
      a.href = lastDataURL
      a.download = 'i-support-blue-economy.png'
      a.click()
      showToast('Caption copied & photo saved — paste in Instagram ✓', 4000)
    }
  }

  function downloadPhoto() {
    const a = document.createElement('a')
    a.href = lastDataURL
    a.download = 'i-support-blue-economy.png'
    a.click()
    showToast('Saved to your phone ✓')
    setSheetOpen(false)
  }

  const hasShot = Boolean(shotUrl)

  return (
    <div id="app">
      {!isSupabaseConfigured && (
        <div className="config-banner">
          ⚠️ Supabase not configured — add <code>VITE_SUPABASE_URL</code> &amp;{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to <code>client/.env</code>.
        </div>
      )}

      <div id="stage">
        <video id="video" className="mirror" ref={videoRef} autoPlay playsInline muted />
        <img id="frame" ref={frameRef} src={frameUrl} alt="Blue Economy frame" crossOrigin="anonymous" />
        {hasShot && <img id="shot" src={shotUrl} alt="Captured selfie" />}
        <div id="credit">Created@Topclues</div>

        <div id="saveBadge" className={saveState === 'saved' ? 'show' : saveState === 'error' ? 'show error' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {saveState === 'saved' ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            )}
          </svg>
          <span id="badgeText">
            {saveState === 'saved' ? '✓ Saved to campaign' : saveState === 'error' ? '✗ Save failed' : ''}
          </span>
        </div>

        {phase === 'camera' && (
          <button id="flip" onClick={flip} aria-label="Flip camera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}

        <div id="gate" className={phase === 'camera' ? 'hidden' : ''}>
          <img className="gate-logo" src={logoUrl} alt="Gujarat Fisheries" />
          <h1>{phase === 'blocked' ? 'Camera blocked' : 'I Support Blue Economy'}</h1>
          <p>
            {phase === 'blocked'
              ? 'Enable camera in your browser settings and reload.'
              : 'Take your selfie with the Gujarat Fisheries frame.'}
          </p>
          <label className="gate-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I consent to my photo being stored and used by the Gujarat Fisheries campaign.</span>
          </label>
          <button id="startBtn" disabled={!consent} onClick={startCamera}>
            {startLabel}
          </button>
        </div>
      </div>

      {phase === 'camera' && (
        <div id="bar">
          <button className="btn" onClick={retake} disabled={!hasShot}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
            </svg>
            Retake
          </button>
          <button id="shutter" onClick={capture} aria-label="Capture" />
          <button className="btn" onClick={() => setSheetOpen(true)} disabled={!hasShot}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <path d="M16 6l-4-4-4 4" /><path d="M12 2v13" />
            </svg>
            Share
          </button>
        </div>
      )}

      {sheetOpen && (
        <div id="sheet" className="open">
          <div className="sheet-card">
            <h2>Save &amp; share your selfie</h2>
            <p>Your photo is ready. Tag <strong>https://isupportblueeconomy.click</strong></p>
            <div className={`server-status ${saveState === 'saved' ? 'saved' : saveState === 'error' ? 'failed' : 'saving'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {saveState === 'saved' ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : saveState === 'error' ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                )}
              </svg>
              <span>{saveMsg || 'Saving to campaign gallery…'}</span>
            </div>
            <div className="sheet-actions">
              <button className="action primary" onClick={sharePhoto}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
                </svg>
                <span>Share photo<small>Pick Instagram Feed or Stories in the share sheet</small></span>
              </button>
              <button className="action" onClick={copyCaption}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>Copy caption<small>Paste in your Instagram caption or story</small></span>
              </button>
              <button className="action" onClick={downloadPhoto}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
                </svg>
                <span>Save to my phone</span>
              </button>
            </div>
            <button className="sheet-cancel" onClick={() => setSheetOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {toast && <div id="toast" className="show">{toast}</div>}
    </div>
  )
}