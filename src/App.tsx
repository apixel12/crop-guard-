import { useEffect, useRef, useState } from 'react'
import About from './components/About'
import Capture from './components/Capture'
import ChoosePlant from './components/ChoosePlant'
import History from './components/History'
import Home from './components/Home'
import Result, { type Outcome } from './components/Result'
import { lemonInfo } from './data/lemonDiseases'
import { plantVillageInfo } from './data/plantVillageDiseases'
import { makeThumbnail, saveScan } from './db/history'
import { useModels } from './hooks/useModels'
import { classifyLemon } from './ml/lemonClassifier'
import { classifyPlantVillage, cropOf, PV_CROPS } from './ml/plantVillageClassifier'
import { checkQuality } from './ml/qualityGate'
import { identifyPlant, plantName, type Plant } from './ml/router'
import { allModelsCached } from './utils/offlineCheck'

type Screen =
  | { s: 'home' }
  | { s: 'capture' }
  | { s: 'processing'; photo: string; step: string }
  | { s: 'choose'; photo: string; suggestions: Plant[]; reason: 'unsure' | 'change' }
  | { s: 'result'; photo: string; plant: Plant | null; suggestions: Plant[]; outcome: Outcome }
  | { s: 'history' }
  | { s: 'about' }

const pvName = (label: string) => {
  const info = plantVillageInfo(label)
  if (!info) return label.replace(/_+/g, ' ')
  const crop = PV_CROPS.find((c) => c.key === cropOf(label))?.name ?? info.crop
  return `${crop}: ${info.name}`
}
const lemonName = (label: string) => lemonInfo(label)?.name ?? label
const historyName = (crop: string, label: string) => (crop === 'Lemon' ? lemonName(label) : pvName(label))
const TIPS = ['Daylight, out of harsh sun', 'One leaf, filling the square', 'Hold still until it’s sharp']
const paint = () => new Promise((r) => setTimeout(r, 30)) // let the progress text render

export default function App() {
  const { models, state } = useModels()
  const [screen, setScreen] = useState<Screen>({ s: 'home' })
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(false)
  const img = useRef<HTMLImageElement | null>(null) // the photo being checked (kept for "Change plant")

  // Release the full-resolution photo once no screen shows it any more.
  const lastPhoto = useRef<string | null>(null)
  useEffect(() => {
    const photo = 'photo' in screen ? screen.photo : null
    if (lastPhoto.current && lastPhoto.current !== photo) URL.revokeObjectURL(lastPhoto.current)
    lastPhoto.current = photo
    if (!photo) img.current = null
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

  const allReady = (['router-v1', 'lemon-v1', 'garden-v1'] as const).every((id) => state[id].status === 'ready')
  // poll the cache until the service worker has stored every model shard
  useEffect(() => {
    if (!allReady) return
    let stop = false
    const tick = async () => {
      const ok = await allModelsCached().catch(() => false)
      if (stop) return
      setOfflineReady(ok)
      if (!ok) setTimeout(tick, 1500)
    }
    tick()
    return () => { stop = true }
  }, [allReady])

  /** Run the disease model for a known plant, save, show the result. */
  const check = async (photo: string, plant: Plant, suggestions: Plant[]) => {
    const image = img.current
    if (!image) return setScreen({ s: 'home' })
    setScreen({ s: 'processing', photo, step: `Checking the ${plantName(plant).toLowerCase()} leaf…` })
    await paint()
    let outcome: Outcome
    try {
      if (plant.kind === 'lemon') {
        const m = models['lemon-v1']
        if (!m) throw new Error('The lemon model isn’t loaded.')
        const pred = await classifyLemon(m, image)
        outcome = { kind: 'prediction', pred, info: lemonInfo(pred.top[0].label), cropName: 'Lemon', threshold: m.meta.thresholds.confidence }
      } else {
        const m = models['garden-v1']
        if (!m) throw new Error('The garden model isn’t loaded.')
        const pred = await classifyPlantVillage(m, image, plant.cropKey)
        outcome = { kind: 'prediction', pred, info: plantVillageInfo(pred.top[0].label), cropMismatch: pred.cropMismatch, cropName: plant.cropName, threshold: m.meta.thresholds.confidence }
      }
      const p = outcome.pred
      // a storage failure must not turn a valid result into an error
      try {
        await saveScan({
          crop: outcome.cropName,
          modelVersion: p.modelVersion,
          prediction: p.status === 'confident' ? p.top[0].label : 'Uncertain',
          status: p.status,
          confidence: p.top[0].confidence,
          thumbnail: await makeThumbnail(image),
        })
        outcome.saved = true
      } catch (e) {
        console.warn('[cropguard] history save failed', e)
        outcome.saved = false
      }
    } catch (e) {
      outcome = { kind: 'error', message: e instanceof Error ? e.message : String(e) }
    }
    setScreen({ s: 'result', photo, plant, suggestions, outcome })
  }

  /** New photo: quality check → identify the plant → check, or ask which plant. */
  const analyze = async (image: HTMLImageElement) => {
    img.current = image
    const photo = image.src
    setScreen({ s: 'processing', photo, step: 'Looking at the photo…' })
    await paint()
    try {
      const q = checkQuality(image)
      if (!q.ok) return setScreen({ s: 'result', photo, plant: null, suggestions: [], outcome: { kind: 'quality', report: q } })
      const router = models['router-v1']
      if (!router) return setScreen({ s: 'choose', photo, suggestions: [], reason: 'unsure' })
      setScreen({ s: 'processing', photo, step: 'Working out which plant this is…' })
      await paint()
      const id = await identifyPlant(router, image)
      if (id.plant) await check(photo, id.plant, id.suggestions)
      else setScreen({ s: 'choose', photo, suggestions: id.suggestions, reason: 'unsure' })
    } catch (e) {
      setScreen({ s: 'result', photo, plant: null, suggestions: [], outcome: { kind: 'error', message: e instanceof Error ? e.message : String(e) } })
    }
  }

  switch (screen.s) {
    case 'home':
      return (
        <Home
          online={online}
          offlineReady={offlineReady}
          onScan={() => setScreen({ s: 'capture' })}
          onHistory={() => setScreen({ s: 'history' })}
          onAbout={() => setScreen({ s: 'about' })}
          displayName={historyName}
        />
      )
    case 'capture':
      return <Capture tips={TIPS} onBack={() => setScreen({ s: 'home' })} onAnalyze={analyze} />
    case 'processing':
      return (
        <section className="screen analysing" aria-live="polite">
          <div className="topbar" />
          <img src={screen.photo} alt="" />
          <p className="status wait"><span className="spinner" aria-hidden />{screen.step}</p>
        </section>
      )
    case 'choose':
      return (
        <ChoosePlant
          photo={screen.photo}
          suggestions={screen.suggestions}
          reason={screen.reason}
          onPick={(p) => check(screen.photo, p, screen.suggestions)}
          onBack={() => setScreen({ s: 'home' })}
        />
      )
    case 'result':
      return (
        <Result
          photo={screen.photo}
          outcome={screen.outcome}
          plant={screen.plant}
          displayName={screen.plant?.kind === 'lemon' ? lemonName : pvName}
          onChangePlant={screen.plant ? () => setScreen({ s: 'choose', photo: screen.photo, suggestions: screen.suggestions, reason: 'change' }) : undefined}
          onHome={() => setScreen({ s: 'home' })}
          onRetake={() => setScreen({ s: 'capture' })}
        />
      )
    case 'about':
      return <About onBack={() => setScreen({ s: 'home' })} />
    case 'history':
      return <History onBack={() => setScreen({ s: 'home' })} displayName={historyName} />
  }
}
