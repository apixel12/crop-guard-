import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  hint: string
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
      rej(new Error('Could not read this image'))
    }
    img.src = url
  })
}

export default function Capture({ title, hint, onBack, onAnalyze }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [cam, setCam] = useState<'starting' | 'live' | 'unavailable'>('starting')
  const [shot, setShot] = useState<HTMLImageElement | null>(null)
  const [err, setErr] = useState<string | null>(null)

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
      stream.current = s
      if (video.current) {
        video.current.srcObject = s
        await video.current.play()
      }
      setCam('live')
    } catch (e) {
      console.warn('[cropguard] camera unavailable', e)
      setCam('unavailable')
    }
  }

  useEffect(() => {
    start()
    return stop
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
      setShot(await loadImage(b))
      stop()
    }, 'image/jpeg', 0.92)
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    try {
      setErr(null)
      setShot(await loadImage(f))
      stop()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const retake = () => {
    if (shot) URL.revokeObjectURL(shot.src)
    setShot(null)
    start()
  }

  return (
    <section className="screen capture">
      <header className="bar">
        <button className="link" onClick={() => { stop(); onBack() }}>← Back</button>
        <h2>{title}</h2>
      </header>

      <div className="viewfinder">
        {shot ? (
          <img src={shot.src} alt="Captured leaf" />
        ) : (
          <>
            <video ref={video} playsInline muted aria-label="Camera preview" />
            {cam === 'live' && <div className="frame" aria-hidden />}
            {cam === 'starting' && <p className="vf-msg">Starting camera…</p>}
            {cam === 'unavailable' && (
              <div className="vf-msg">
                <strong>Camera unavailable</strong>
                <span>Choose a photo from your gallery instead.</span>
              </div>
            )}
          </>
        )}
      </div>

      <p className="hint">{shot ? 'Is the leaf clear and in focus?' : hint}</p>
      {err && <p className="error-text">{err}</p>}

      <div className="actions">
        {shot ? (
          <>
            <button className="btn secondary" onClick={retake}>Retake</button>
            <button className="btn primary" onClick={() => onAnalyze(shot)}>Analyze</button>
          </>
        ) : (
          <>
            {cam === 'live' && <button className="btn primary" onClick={capture}>Capture</button>}
            <button className={cam === 'live' ? 'btn secondary' : 'btn primary'} onClick={() => fileInput.current?.click()}>
              Choose from gallery
            </button>
          </>
        )}
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </section>
  )
}
