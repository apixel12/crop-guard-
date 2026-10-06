import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Gallery, Retake } from './Icons'

interface Props {
  crop: string
  tips: string[]
  onBack: () => void
  onAnalyze: (img: HTMLImageElement) => void
}

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => res(img) // browsers apply EXIF orientation for <img>
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}

export default function Capture({ crop, tips, onBack, onAnalyze }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const alive = useRef(true)
  const shotUrl = useRef<string | null>(null) // revoked on unmount unless handed to Analyze
  const [cam, setCam] = useState<'starting' | 'live' | 'unavailable'>('starting')
  const [shot, setShot] = useState<HTMLImageElement | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [square, setSquare] = useState<CSSProperties>({ inset: '12.5% 0%' })

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

  const pick = async (f: File | undefined) => {
    if (!f) return
    try {
      setErr(null)
      const img = await loadImage(f)
      if (shot) URL.revokeObjectURL(shot.src)
      shotUrl.current = img.src
      setShot(img)
      stop()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      if (fileInput.current) fileInput.current.value = '' // allow re-picking the same file
    }
  }

  const retake = () => {
    if (shot) URL.revokeObjectURL(shot.src)
    shotUrl.current = null
    setShot(null)
    start()
  }

  return (
    <section className="screen capture">
      <div className="topbar">
        <button className="back" onClick={() => { stop(); onBack() }}><ArrowLeft /> Home</button>
        <span className="crumb">{crop}<i>/</i>{shot ? 'Review' : 'Capture'}</span>
      </div>

      <div className="viewfinder">
        {shot ? (
          <>
            <img src={shot.src} alt="Your leaf photo" onLoad={(e) => fit(e.currentTarget, shot.naturalWidth, shot.naturalHeight)} />
            <div className="brackets analyzed" style={square} aria-hidden><span /><span /><span /><span /></div>
          </>
        ) : (
          <>
            <video ref={video} playsInline muted aria-label="Camera preview" onLoadedMetadata={measure} />
            {cam === 'live' && (
              <>
                <div className="brackets" style={square} aria-hidden><span /><span /><span /><span /></div>
                <span className="vf-chip"><span className="dot ready" aria-hidden /> one leaf · inside the square</span>
              </>
            )}
            {cam === 'starting' && <div className="vf-msg"><span className="spinner" aria-hidden /><p>Starting camera…</p></div>}
            {cam === 'unavailable' && (
              <div className="vf-msg">
                <span className="display">Camera unavailable</span>
                <p>Choose a photo of the leaf from your gallery instead.</p>
              </div>
            )}
          </>
        )}
      </div>

      {err && <p className="notice error" role="alert"><b>Couldn’t open that file.</b> {err}</p>}

      {shot ? (
        <>
          <p className="lede">Is the leaf sharp, well lit, and filling most of the square? Only the square is analyzed.</p>
          <div className="actions row">
            <button className="button ghost" onClick={retake}><Retake /> Retake</button>
            <button className="button primary" onClick={() => { shotUrl.current = null; onAnalyze(shot) }}>Analyze <ArrowRight /></button>
          </div>
        </>
      ) : (
        <>
          <ul className="list tips">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
          {cam === 'live' ? (
            <div className="shutter-row">
              <button className="side-button" onClick={() => fileInput.current?.click()}><Gallery />Gallery</button>
              <button className="shutter" onClick={capture} aria-label="Capture photo" />
              <span />
            </div>
          ) : (
            <button className="button primary big" onClick={() => fileInput.current?.click()}>
              <Gallery /> Choose from gallery
            </button>
          )}
        </>
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </section>
  )
}
