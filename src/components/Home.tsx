import { useEffect, useState } from 'react'
import { listScans, type ScanRecord } from '../db/history'
import { useModels } from '../hooks/useModels'
import type { ModelState } from '../ml/modelLoader'
import { ArrowRight, Leaf, Lock } from './Icons'
import { ScanRow } from './History'
import { PV_CROPS } from '../ml/plantVillageClassifier'

function ReadyRow({ s, label, count }: { s: ModelState; label: string; count?: number }) {
  return (
    <div className="ready-row">
      <span className={`dot ${s.status}`} aria-hidden />
      <span>{label}</span>
      <span className="fig">{s.status === 'ready' ? `${count} conditions` : s.status === 'loading' ? 'loading' : 'unavailable'}</span>
    </div>
  )
}

interface Props {
  onLemon: () => void
  onOther: () => void
  onHistory: () => void
  onAbout: () => void
  online: boolean
  offlineReady: boolean
  displayName: (crop: string, label: string) => string
}

export default function Home({ onLemon, onOther, onHistory, onAbout, online, offlineReady, displayName }: Props) {
  const { state, models, retry } = useModels()
  const lemon = state['lemon-v1']
  const pv = state['plantvillage-v2']
  const allReady = lemon.status === 'ready' && pv.status === 'ready'
  const anyError = lemon.status === 'error' || pv.status === 'error'
  const [recent, setRecent] = useState<ScanRecord[]>([])
  useEffect(() => { listScans().then((s) => setRecent(s.slice(0, 3))).catch(() => {}) }, [])

  const head = allReady && offlineReady
    ? { cls: 'ok', text: 'AI ready offline' }
    : anyError
      ? { cls: 'bad', text: 'Some models unavailable' }
      : allReady
        ? { cls: 'wait', text: 'AI ready · caching for offline' }
        : { cls: 'wait', text: 'Preparing on-device AI' }

  return (
    <section className="screen home">
      <div className="hull">
        <div className="brand">
          <Leaf />
          <span className="brand-name">Crop<b>Guard</b></span>
        </div>
        <h1 className="display hero-title">Scan a leaf.<br /><span>Know sooner.</span></h1>
        <p className="hero-sub">A pocket plant doctor for home gardeners. Check a sick-looking leaf on your tomatoes, peppers, beans, lemon tree and more. It runs entirely on your phone, even with no signal.</p>

        <div className="hero-actions">
          <button className="button primary big" onClick={onLemon} disabled={lemon.status !== 'ready'}>
            Scan a lemon leaf <ArrowRight />
          </button>
          <button className="button ghost" onClick={onOther} disabled={pv.status !== 'ready'}>
            Scan another garden crop
          </button>
        </div>

        <div className="readiness" aria-live="polite">
          <p className={`ready-head ${head.cls}`}>
            {head.cls === 'ok' && <span className="dot ready" aria-hidden />}
            {head.text}
            {!online && <span className="pill">offline</span>}
          </p>
          <ReadyRow s={lemon} label="Lemon model" count={models['lemon-v1']?.meta.classCount} />
          <ReadyRow s={pv} label="PlantVillage model" count={models['plantvillage-v2']?.meta.classCount} />
        </div>
      </div>

      {lemon.status === 'error' && (
        <div className="notice error" role="alert">
          <b>Lemon AI unavailable.</b> The model could not be loaded on this device.
          <ul className="list">
            <li>Reconnect once so the model can download</li>
            <li>Reopen CropGuard</li>
            <li>Check available storage</li>
          </ul>
          <div className="actions"><button className="button ghost" onClick={() => retry('lemon-v1')}>Try again</button></div>
        </div>
      )}
      {pv.status === 'error' && (
        <div className="notice error" role="alert">
          <b>PlantVillage AI unavailable.</b>{' '}
          <button className="text-button" onClick={() => retry('plantvillage-v2')}>Try again</button>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat"><span className="stat-value">{models['lemon-v1']?.meta.classCount ?? 18}</span><span className="stat-label">Lemon conditions</span></div>
        <div className="stat"><span className="stat-value">{PV_CROPS.length + 1}</span><span className="stat-label">Garden crops</span></div>
        <div className="stat"><span className="stat-value">0</span><span className="stat-label">Photos uploaded</span></div>
      </div>

      <p className="notice">
        <b><Lock /> Your photos stay on this device.</b> Analysis runs in your browser. No uploads, no account, no analytics.
      </p>

      {recent.length > 0 && (
        <>
          <div className="section-row">
            <span className="kicker">Recent scans</span>
            <button className="text-button" onClick={onHistory}>All history</button>
          </div>
          <ul className="history">
            {recent.map((s) => <ScanRow key={s.id} s={s} displayName={displayName} />)}
          </ul>
        </>
      )}
      {recent.length === 0 && (
        <button className="text-button" onClick={onHistory} style={{ justifySelf: 'start' }}>Scan history</button>
      )}

      <button className="text-button" onClick={onAbout} style={{ justifySelf: 'center' }}>How it works · data · credits</button>
      <p className="foot">AI screening, not a diagnosis · confirm with a local extension office</p>
    </section>
  )
}
