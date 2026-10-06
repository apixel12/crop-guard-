import { useModels } from '../hooks/useModels'
import type { ModelState } from '../ml/modelLoader'

function Status({ s, label, count }: { s: ModelState; label: string; count?: number }) {
  return (
    <li className={`status ${s.status}`}>
      <span className="dot" aria-hidden />
      <span>{label}</span>
      <span className="status-val">
        {s.status === 'ready' ? `${count} conditions` : s.status === 'loading' ? 'Loading…' : 'Unavailable'}
      </span>
    </li>
  )
}

interface Props {
  onLemon: () => void
  onOther: () => void
  onHistory: () => void
  online: boolean
  offlineReady: boolean
}

export default function Home({ onLemon, onOther, onHistory, online, offlineReady }: Props) {
  const { state, models, retry } = useModels()
  const lemon = state['lemon-v1']
  const pv = state['plantvillage-v1']
  const allReady = lemon.status === 'ready' && pv.status === 'ready'

  return (
    <section className="screen home">
      <div className="brand">
        <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden>
          <path d="M6 26C6 13 14 6 27 5c0 13-7 21-20 21z" fill="var(--leaf)" />
          <path d="M7 25C12 19 17 14 23 10" stroke="var(--paper)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
        <div>
          <h1>CropGuard</h1>
          <p className="muted">Offline plant disease screening</p>
        </div>
      </div>

      <div className="actions stack">
        <button className="btn primary big" onClick={onLemon} disabled={lemon.status !== 'ready'}>
          Scan a Lemon Leaf
        </button>
        <button className="btn secondary big" onClick={onOther} disabled={pv.status !== 'ready'}>
          Scan another crop
        </button>
      </div>

      <div className={`readiness ${allReady && offlineReady ? 'ok' : ''}`}>
        <p className="readiness-head">
          {allReady && offlineReady ? 'AI READY OFFLINE' : allReady ? 'AI ready · caching for offline…' : 'Preparing on-device AI…'}
          {!online && <span className="pill">No connection</span>}
        </p>
        <ul>
          <Status s={lemon} label="Lemon model" count={models['lemon-v1']?.meta.classCount} />
          <Status s={pv} label="PlantVillage model" count={models['plantvillage-v1']?.meta.classCount} />
        </ul>
        {lemon.status === 'error' && (
          <div className="card warn" role="alert">
            <h3>Lemon AI unavailable</h3>
            <p>The model could not be loaded on this device.</p>
            <ul className="list"><li>Reconnect once</li><li>Reopen CropGuard</li><li>Check available storage</li></ul>
            <button className="btn secondary" onClick={() => retry('lemon-v1')}>Try again</button>
          </div>
        )}
        {pv.status === 'error' && (
          <p className="error-text">PlantVillage model unavailable. <button className="link" onClick={() => retry('plantvillage-v1')}>Retry</button></p>
        )}
      </div>

      <p className="privacy">
        <strong>Your photos stay on this device.</strong> Analysis runs in your browser. No uploads, no account, no analytics.
      </p>
      <button className="link" onClick={onHistory}>Scan history</button>
    </section>
  )
}
