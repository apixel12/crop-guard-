import { CaretDown, CaretRight, CheckCircle, ClockCounterClockwise, CloudArrowDown, Leaf, OrangeSlice, Plant, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { listScans, type ScanRecord } from '../db/history'
import { useModels } from '../hooks/useModels'
import { PV_CROPS } from '../ml/plantVillageClassifier'
import { ScanRow } from './History'

export type Pick = { kind: 'lemon' } | { kind: 'pv'; cropKey: string; cropName: string }

const MOST_GROWN = 6 // first N of PV_CROPS (ordered by NGA survey popularity)

interface Props {
  onPick: (p: Pick) => void
  onHistory: () => void
  onAbout: () => void
  online: boolean
  offlineReady: boolean
  conditionsPerCrop: Record<string, number>
  displayName: (crop: string, label: string) => string
}

function CropRow({ name, sub, lemon, disabled, onClick }: { name: string; sub: string; lemon?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="list-row" onClick={onClick} disabled={disabled}>
      <span className={`crop-icon ${lemon ? 'lemon' : ''}`} aria-hidden>
        {lemon ? <OrangeSlice size={22} /> : <Plant size={22} />}
      </span>
      <span className="grow">
        <span className="title">{name}</span>
        <br />
        <span className="sub">{sub}</span>
      </span>
      <CaretRight className="chev" size={18} aria-hidden />
    </button>
  )
}

export default function Home({ onPick, onHistory, onAbout, online, offlineReady, conditionsPerCrop, displayName }: Props) {
  const { state, retry } = useModels()
  const lemon = state['lemon-v1']
  const pv = state['plantvillage-v2']
  const allReady = lemon.status === 'ready' && pv.status === 'ready'
  const anyError = lemon.status === 'error' || pv.status === 'error'
  const [recent, setRecent] = useState<ScanRecord[]>([])
  useEffect(() => { listScans().then((s) => setRecent(s.slice(0, 3))).catch(() => {}) }, [])

  const status = anyError
    ? { cls: 'bad', icon: <WarningCircle size={18} aria-hidden />, text: 'Some plant models could not load' }
    : allReady && offlineReady
      ? { cls: 'ok', icon: <CheckCircle size={18} weight="fill" aria-hidden />, text: online ? 'Ready, and works offline' : 'Offline. Everything still works' }
      : allReady
        ? { cls: 'wait', icon: <CloudArrowDown size={18} aria-hidden />, text: 'Ready. Saving for offline use…' }
        : { cls: 'wait', icon: <span className="spinner" aria-hidden />, text: 'Getting ready…' }

  const sub = (key: string) => {
    const n = conditionsPerCrop[key] ?? 0
    return `${n} ${n === 1 ? 'condition' : 'conditions'}`
  }
  const crops = PV_CROPS.map((c) => (
    <CropRow key={c.key} name={c.name} sub={sub(c.key)} disabled={pv.status !== 'ready'}
      onClick={() => onPick({ kind: 'pv', cropKey: c.key, cropName: c.name })} />
  ))

  return (
    <section className="screen">
      <div className="topbar">
        <span className="wordmark"><Leaf size={24} weight="fill" aria-hidden />CropGuard</span>
        <button className="icon-btn" onClick={onHistory}><ClockCounterClockwise size={20} aria-hidden />History</button>
      </div>

      <div style={{ display: 'grid', gap: 'var(--s2)' }}>
        <h1>What are you checking today?</h1>
        <p className="lede">Pick the plant, then photograph one leaf. The check runs on this phone, and your photos never leave it.</p>
        <p className={`status ${status.cls}`} aria-live="polite">{status.icon}{status.text}</p>
      </div>

      {lemon.status === 'error' && (
        <div className="callout attention" role="alert">
          <WarningCircle size={20} aria-hidden />
          <div>
            <b>The lemon model couldn’t load.</b> Connect to the internet once so it can download, or check that your phone has free storage.
            <button className="btn" onClick={() => retry('lemon-v1')}>Try again</button>
          </div>
        </div>
      )}
      {pv.status === 'error' && (
        <div className="callout attention" role="alert">
          <WarningCircle size={20} aria-hidden />
          <div>
            <b>The garden model couldn’t load.</b>
            <button className="btn" onClick={() => retry('plantvillage-v2')}>Try again</button>
          </div>
        </div>
      )}

      <div>
        <h2 className="section-title">Most grown</h2>
        <div className="list-card">
          <CropRow name="Lemon" sub="18 conditions" lemon disabled={lemon.status !== 'ready'} onClick={() => onPick({ kind: 'lemon' })} />
          {crops.slice(0, MOST_GROWN)}
        </div>
      </div>

      <details className="more">
        <summary className="section-title">More plants ({crops.length - MOST_GROWN})<CaretDown size={16} aria-hidden /></summary>
        <div className="list-card">{crops.slice(MOST_GROWN)}</div>
      </details>

      {recent.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="section-title">Recent checks</h2>
            <button className="text-link" onClick={onHistory}>See all</button>
          </div>
          <div className="list-card">
            {recent.map((s) => <ScanRow key={s.id} s={s} displayName={displayName} />)}
          </div>
        </div>
      )}

      <div>
        <button className="text-link" onClick={onAbout}>How CropGuard works</button>
        <p className="fine-print">A screening aid, not a diagnosis. Confirm anything serious with your local extension office or a garden centre.</p>
      </div>
    </section>
  )
}
