import { useEffect, useRef, useState } from 'react'
import About from './components/About'
import Capture from './components/Capture'
import History from './components/History'
import Home, { type Pick } from './components/Home'
import Result, { type Outcome } from './components/Result'
import { lemonInfo } from './data/lemonDiseases'
import { PLANTVILLAGE_CONDITIONS, plantVillageInfo } from './data/plantVillageDiseases'
import { makeThumbnail, saveScan } from './db/history'
import { useModels } from './hooks/useModels'
import { classifyLemon } from './ml/lemonClassifier'
import { classifyPlantVillage, cropOf, PV_CROPS } from './ml/plantVillageClassifier'
import { checkQuality } from './ml/qualityGate'
import { allModelsCached } from './utils/offlineCheck'

const PER_CROP = Object.keys(PLANTVILLAGE_CONDITIONS).reduce<Record<string, number>>((acc, l) => {
  const c = cropOf(l)
  acc[c] = (acc[c] ?? 0) + 1
  return acc
}, {})
const historyName = (crop: string, label: string) => (crop === 'Lemon' ? lemonName(label) : pvName(label))
const LEMON_TIPS = ['Daylight, out of harsh sun', 'One leaf, filling the square', 'Hold still until it’s sharp']
const PV_TIPS = ['Daylight, out of harsh sun', 'One leaf, filling the square', 'A plain background helps']

type Mode = Pick
type Screen =
  | { s: 'home' }
  | { s: 'capture'; mode: Mode }
  | { s: 'processing'; mode: Mode; photo: string }
  | { s: 'result'; mode: Mode; photo: string; outcome: Outcome }
  | { s: 'history' }
  | { s: 'about' }

const pvName = (label: string) => {
  const info = plantVillageInfo(label)
  if (!info) return label.replace(/_+/g, ' ')
  const crop = PV_CROPS.find((c) => c.key === cropOf(label))?.name ?? info.crop
  return `${crop}: ${info.name}`
}
const lemonName = (label: string) => lemonInfo(label)?.name ?? label

export default function App() {
  const { models, state } = useModels()
  const [screen, setScreen] = useState<Screen>({ s: 'home' })
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(false)

  // Release the full-resolution photo once no screen shows it any more.
  const lastPhoto = useRef<string | null>(null)
  useEffect(() => {
    const photo = 'photo' in screen ? screen.photo : null
    if (lastPhoto.current && lastPhoto.current !== photo) URL.revokeObjectURL(lastPhoto.current)
    lastPhoto.current = photo
  }, [screen])

  // Each new screen starts at the top.
  useEffect(() => { window.scrollTo(0, 0) }, [screen.s])

  // Phone back button / back swipe: return to Home instead of leaving the app.
  useEffect(() => {
    if (screen.s !== 'home' && history.state?.cg !== true) history.pushState({ cg: true }, '')
    if (screen.s === 'home' && history.state?.cg === true) history.back()
  }, [screen.s])
  useEffect(() => {
    const onPop = () => setScreen((cur) => (cur.s === 'processing' ? cur : { s: 'home' }))
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => { removeEventListener('online', on); removeEventListener('offline', off) }
  }, [])

  // poll the cache until the service worker has stored every model shard
  useEffect(() => {
    if (state['lemon-v1'].status !== 'ready' || state['plantvillage-v2'].status !== 'ready') return
    let stop = false
    const tick = async () => {
      const ok = await allModelsCached().catch(() => false)
      if (stop) return
      setOfflineReady(ok)
      if (!ok) setTimeout(tick, 1500)
    }
    tick()
    return () => { stop = true }
  }, [state])

  const analyze = async (mode: Mode, img: HTMLImageElement) => {
    setScreen({ s: 'processing', mode, photo: img.src })
    await new Promise((r) => setTimeout(r, 30)) // let "Processing locally" paint
    let outcome: Outcome
    try {
      const q = checkQuality(img)
      if (!q.ok) {
        outcome = { kind: 'quality', report: q }
      } else if (mode.kind === 'lemon') {
        const m = models['lemon-v1']
        if (!m) throw new Error('Lemon AI unavailable: the model is not loaded.')
        const pred = await classifyLemon(m, img)
        outcome = { kind: 'prediction', pred, info: lemonInfo(pred.top[0].label), cropName: 'Lemon', threshold: m.meta.thresholds.confidence }
      } else {
        const m = models['plantvillage-v2']
        if (!m) throw new Error('PlantVillage AI unavailable: the model is not loaded.')
        const pred = await classifyPlantVillage(m, img, mode.cropKey)
        outcome = { kind: 'prediction', pred, info: plantVillageInfo(pred.top[0].label), cropMismatch: pred.cropMismatch, cropName: mode.cropName, threshold: m.meta.thresholds.confidence }
      }
      if (outcome.kind === 'prediction') {
        const p = outcome.pred
        // a storage failure must not turn a valid result into an error
        try {
          await saveScan({
            crop: outcome.cropName,
            modelVersion: p.modelVersion,
            prediction: p.status === 'confident' ? p.top[0].label : 'Uncertain',
            status: p.status,
            confidence: p.top[0].confidence,
            thumbnail: await makeThumbnail(img),
          })
          outcome.saved = true
        } catch (e) {
          console.warn('[cropguard] history save failed', e)
          outcome.saved = false
        }
      }
    } catch (e) {
      outcome = { kind: 'error', message: e instanceof Error ? e.message : String(e) }
    }
    setScreen({ s: 'result', mode, photo: img.src, outcome })
  }

  switch (screen.s) {
    case 'home':
      return (
        <Home
          online={online}
          offlineReady={offlineReady}
          conditionsPerCrop={PER_CROP}
          onPick={(mode) => setScreen({ s: 'capture', mode })}
          onHistory={() => setScreen({ s: 'history' })}
          onAbout={() => setScreen({ s: 'about' })}
          displayName={historyName}
        />
      )
    case 'capture': {
      const lemon = screen.mode.kind === 'lemon'
      return (
        <Capture
          crop={lemon ? 'Lemon' : screen.mode.kind === 'pv' ? screen.mode.cropName : ''}
          tips={lemon ? LEMON_TIPS : PV_TIPS}
          onBack={() => setScreen({ s: 'home' })}
          onAnalyze={(img) => analyze(screen.mode, img)}
        />
      )
    }
    case 'processing':
      return (
        <section className="screen analysing" aria-live="polite">
          <div className="topbar"><span className="caption">{screen.mode.kind === 'lemon' ? 'Lemon' : screen.mode.cropName}</span></div>
          <img src={screen.photo} alt="" />
          <p className="status wait"><span className="spinner" aria-hidden />Checking the leaf on this phone…</p>
        </section>
      )
    case 'result':
      return (
        <Result
          photo={screen.photo}
          outcome={screen.outcome}
          displayName={screen.mode.kind === 'lemon' ? lemonName : pvName}
          onHome={() => setScreen({ s: 'home' })}
          onRetake={() => setScreen({ s: 'capture', mode: screen.mode })}
        />
      )
    case 'about':
      return <About onBack={() => setScreen({ s: 'home' })} />
    case 'history':
      return <History onBack={() => setScreen({ s: 'home' })} displayName={historyName} />
  }
}
