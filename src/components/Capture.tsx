import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowClockwise, ArrowLeft, ImageSquare, VideoCamera } from '@phosphor-icons/react'
import { chooseFrames, framesFromStream, framesFromVideoFile, type Source } from '../ml/frames'

/** What the user captured: one photo, or frames sampled from a video. */
export type Captured = { kind: 'photo'; img: HTMLImageElement } | { kind: 'video'; frames: Source[]; preview: HTMLImageElement }

interface Props {
  tips: string[]
  onBack: () => void
  onAnalyze: (c: Captured) => void
}

/** A still to show for a video: the sharpest sampled frame. */
async function previewOf(frames: HTMLCanvasElement[]): Promise<HTMLImageElement> {
  const best = chooseFrames(frames, 1).best[0] ?? frames[0]
  const blob = await new Promise<Blob>((res, rej) => (best as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('preview failed'))), 'image/jpeg', 0.9))
  return loadImage(blob)
}

/** Larger than any phone camera (200 MP); guards against decompression-bomb files. */
export const MAX_IMAGE_PIXELS = 200_000_000
const MAX_FILE_BYTES = 60 * 1024 * 1024

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  if (blob.size > MAX_FILE_BYTES) return Promise.reject(new Error('That file is too large. Choose a normal photo.'))
  if (blob.type && !blob.type.startsWith('image/')) return Promise.reject(new Error('That file isn’t a photo.'))
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      // browsers apply EXIF orientation for <img>
      if (img.naturalWidth * img.naturalHeight > MAX_IMAGE_PIXELS || !img.naturalWidth) {
        URL.revokeObjectURL(url)
        rej(new Error('That image is too large or empty. Choose a normal photo.'))
      } else res(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}

export default function Capture({ tips, onBack, onAnalyze }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const alive = useRef(true)
  const shotUrl = useRef<string | null>(null) // revoked on unmount unless handed to Analyze
  const [cam, setCam] = useState<'starting' | 'live' | 'unavailable'>('starting')
  const [shot, setShot] = useState<HTMLImageElement | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [square, setSquare] = useState<CSSProperties>({ inset: '12.5% 0%' })
  const [frames, setFrames] = useState<HTMLCanvasElement[] | null>(null) // set when the capture is a video
  const [recording, setRecording] = useState<number | null>(null) // 0..1 progress while sampling video
  const [busy, setBusy] = useState(false)

  // Outline exactly the center square the model analyzes. The preview uses
  // object-fit: contain, so nothing the model sees is hidden off-screen.
  const fit = (el: HTMLElement, w: number, h: number) => {
    const box = el.getBoundingClientRect()
    const scale = Math.min(box.width / w, box.height / h) // object-fit: contain
    const side = Math.min(w, h) * scale
    setSquare({ left: (box.width - side) / 2, top: (box.height - side) / 2, width: side, height: side })
  }
  const measure = () => {
    const v = video.current
    if (v?.videoWidth) fit(v, v.videoWidth, v.videoHeight)
  }

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }

  const start = async () => {
    setCam('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera API')
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      })
      if (!alive.current) { s.getTracks().forEach((t) => t.stop()); return } // left the screen meanwhile
      stream.current = s
      if (video.current) {
        video.current.srcObject = s
        await video.current.play()
        measure()
      }
      setCam('live')
    } catch (e) {
      console.warn('[cropguard] camera unavailable', e)
      if (alive.current) setCam('unavailable')
    }
  }

  // Privacy: release the camera whenever the app is hidden (app switch, lock
  // screen), and turn it back on when the user returns to the viewfinder.
  const shotRef = useRef<HTMLImageElement | null>(null)
  shotRef.current = shot
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stop()
      else if (!shotRef.current && !stream.current && alive.current) start()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    alive.current = true
    start()
    return () => {
      alive.current = false
      stop()
      if (shotUrl.current) URL.revokeObjectURL(shotUrl.current)
    }
  }, [])

  const capture = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob(async (b) => {
      if (!b) return
      const img = await loadImage(b)
      shotUrl.current = img.src
      setShot(img)
      stop()
    }, 'image/jpeg', 0.92)
  }

  const record = async () => {
    const v = video.current
    if (!v || !v.videoWidth || recording !== null) return
    setErr(null)
    setRecording(0)
    try {
      const fr = await framesFromStream(v, setRecording)
      if (!fr.length) throw new Error('No frames were captured. Try again.')
      const img = await previewOf(fr)
      shotUrl.current = img.src
      setFrames(fr)
      setShot(img)
      stop()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setRecording(null)
    }
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    try {
      setErr(null)
      let img: HTMLImageElement
      if (f.type.startsWith('video/')) {
        setBusy(true)
        const fr = await framesFromVideoFile(f)
        img = await previewOf(fr)
        setFrames(fr)
      } else {
        img = await loadImage(f)
        setFrames(null)
      }
      if (shot) URL.revokeObjectURL(shot.src)
      shotUrl.current = img.src
      setShot(img)
      stop()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = '' // allow re-picking the same file
    }
  }

  const retake = () => {
    if (shot) URL.revokeObjectURL(shot.src)
    shotUrl.current = null
    setShot(null)
    setFrames(null)
    start()
  }

  return (
    <section className="screen capture">
      <div className="topbar">
        <button className="icon-btn back" onClick={() => { stop(); onBack() }}><ArrowLeft size={20} aria-hidden />Back</button>
      </div>

      <div className="viewfinder">
        {shot ? (
          <>
            <img src={shot.src} alt={frames ? 'Sharpest frame from your video' : 'Your leaf photo'} onLoad={(e) => fit(e.currentTarget, shot.naturalWidth, shot.naturalHeight)} />
            <div className="brackets analyzed" style={square} aria-hidden><span /><span /><span /><span /></div>
          </>
        ) : (
          <>
            <video ref={video} playsInline muted aria-label="Camera preview" onLoadedMetadata={measure} />
            {cam === 'live' && <div className="brackets" style={square} aria-hidden><span /><span /><span /><span /></div>}
            {cam === 'starting' && <div className="vf-msg"><span className="spinner" aria-hidden /><p>Starting camera…</p></div>}
            {recording !== null && (
              <div className="rec-chip" role="status"><span className="rec-dot" aria-hidden />Recording… hold steady<span className="rec-bar"><span style={{ transform: `scaleX(${recording})` }} /></span></div>
            )}
            {busy && <div className="vf-msg"><span className="spinner" aria-hidden /><p>Reading the video…</p></div>}
            {cam === 'unavailable' && (
              <div className="vf-msg">
                <b>Camera not available</b>
                <p>You can still choose a photo or video of the leaf from your library.</p>
              </div>
            )}
          </>
        )}
      </div>

      {err && <div className="callout attention" role="alert"><div><b>That didn’t work.</b> {err}</div></div>}

      {shot ? (
        <>
          <p className="hint">
            {frames
              ? `${frames.length} frames captured. CropGuard checks the sharpest ones and combines them. Only the square is analyzed.`
              : 'Only the area inside the square is checked. Is the leaf sharp and filling most of it?'}
          </p>
          <div className="row-actions">
            <button className="btn" onClick={retake}><ArrowClockwise size={20} aria-hidden />Retake</button>
            <button className="btn primary" onClick={() => { shotUrl.current = null; onAnalyze(frames ? { kind: 'video', frames, preview: shot } : { kind: 'photo', img: shot }) }}>Check this leaf</button>
          </div>
        </>
      ) : (
        <>
          <ul className="bullets hint">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
          {cam === 'live' ? (
            <div className="capture-bar">
              <button className="gallery-btn" onClick={() => fileInput.current?.click()}><ImageSquare size={24} aria-hidden />Library</button>
              <button className="shutter" onClick={capture} aria-label="Take photo" disabled={recording !== null} />
              <button className="gallery-btn video-btn" onClick={record} disabled={recording !== null}><VideoCamera size={24} aria-hidden />Video</button>
            </div>
          ) : (
            <button className="btn primary full" onClick={() => fileInput.current?.click()}><ImageSquare size={20} aria-hidden />Choose a photo or video</button>
          )}
        </>
      )}
      <input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </section>
  )
}
