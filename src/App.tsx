import { useEffect, useState } from 'react'
import Capture from './components/Capture'
import CropPicker from './components/CropPicker'
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
import { allModelsCached } from './utils/offlineCheck'

type Mode = { kind: 'lemon' } | { kind: 'pv'; cropKey: string; cropName: string }
type Screen =
  | { s: 'home' }
  | { s: 'pick' }
  | { s: 'capture'; mode: Mode }
  | { s: 'processing'; mode: Mode; photo: string }
  | { s: 'result'; mode: Mode; photo: string; outcome: Outcome }
  | { s: 'history' }

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

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => { removeEventListener('online', on); removeEventListener('offline', off) }
  }, [])

  // poll the cache until the service worker has stored every model shard
  useEffect(() => {
    if (state['lemon-v1'].status !== 'ready' || state['plantvillage-v1'].status !== 'ready') return
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
        outcome = { kind: 'prediction', pred, info: lemonInfo(pred.top[0].label), cropName: 'Lemon' }
      } else {
        const m = models['plantvillage-v1']
        if (!m) throw new Error('PlantVillage AI unavailable: the model is not loaded.')
        const pred = await classifyPlantVillage(m, img, mode.cropKey)
        outcome = { kind: 'prediction', pred, info: plantVillageInfo(pred.top[0].label), cropMismatch: pred.cropMismatch, cropName: mode.cropName }
      }
      if (outcome.kind === 'prediction') {
        const p = outcome.pred
        await saveScan({
          crop: outcome.cropName,
          modelVersion: p.modelVersion,
          prediction: p.status === 'confident' ? p.top[0].label : 'Uncertain',
          status: p.status,
          confidence: p.top[0].confidence,
          thumbnail: await makeThumbnail(img),
        })
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
          onLemon={() => setScreen({ s: 'capture', mode: { kind: 'lemon' } })}
          onOther={() => setScreen({ s: 'pick' })}
          onHistory={() => setScreen({ s: 'history' })}
        />
      )
    case 'pick':
      return <CropPicker onBack={() => setScreen({ s: 'home' })} onPick={(cropKey, cropName) => setScreen({ s: 'capture', mode: { kind: 'pv', cropKey, cropName } })} />
    case 'capture': {
      const lemon = screen.mode.kind === 'lemon'
      return (
        <Capture
          title={lemon ? 'Scan Lemon Leaf' : `Scan ${screen.mode.kind === 'pv' ? screen.mode.cropName : ''} Leaf`}
          hint={lemon ? 'Place one leaf in frame. Natural light, leaf centered, fill most of the frame.' : 'Place one leaf in frame.'}
          onBack={() => setScreen({ s: 'home' })}
          onAnalyze={(img) => analyze(screen.mode, img)}
        />
      )
    }
    case 'processing':
      return (
        <section className="screen processing" aria-live="polite">
          <img className="result-photo" src={screen.photo} alt="" />
          <p className="processing-text"><span className="spinner" aria-hidden /> Processing locally…</p>
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
    case 'history':
      return <History onBack={() => setScreen({ s: 'home' })} displayName={(crop, label) => (crop === 'Lemon' ? lemonName(label) : pvName(label))} />
  }
}
