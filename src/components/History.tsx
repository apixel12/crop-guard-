import { useEffect, useState } from 'react'
import { deleteScan, listScans, type ScanRecord } from '../db/history'
import { ArrowLeft, Trash } from './Icons'

function Thumb({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img src={url} alt="" /> : <span />
}

const when = (t: number) =>
  new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

interface RowProps {
  s: ScanRecord
  displayName: (crop: string, label: string) => string
  onDelete?: (id: string) => void
}

export function ScanRow({ s, displayName, onDelete }: RowProps) {
  const uncertain = s.status === 'uncertain'
  return (
    <li>
      <Thumb blob={s.thumbnail} />
      <div>
        <div className="h-title">{uncertain ? 'Uncertain result' : displayName(s.crop, s.prediction)}</div>
        <div className="h-meta">
          <span className={`tag ${uncertain ? 'amber' : ''}`}>{s.crop}</span>
          {!uncertain && <span className="fig">{Math.min(99, Math.round(s.confidence * 100))}%</span>}
          <span>{when(s.timestamp)}</span>
        </div>
      </div>
      {onDelete ? (
        <button className="side-button" aria-label={`Delete scan from ${when(s.timestamp)}`} onClick={() => onDelete(s.id)}>
          <Trash />
        </button>
      ) : <span />}
    </li>
  )
}

export default function History({ onBack, displayName }: { onBack: () => void; displayName: RowProps['displayName'] }) {
  const [scans, setScans] = useState<ScanRecord[] | null>(null)
  const refresh = () => listScans().then(setScans).catch(() => setScans([]))
  useEffect(() => { refresh() }, [])

  return (
    <section className="screen">
      <div className="topbar">
        <button className="back" onClick={onBack}><ArrowLeft /> Home</button>
        <span className="crumb">Stored on this device</span>
      </div>
      <div>
        <p className="kicker">History</p>
        <h1 className="display page-title">Your scans</h1>
      </div>
      {scans === null && <p className="muted">Loading…</p>}
      {scans?.length === 0 && (
        <div className="empty">
          <span className="display">No scans yet</span>
          <p>Results you analyze are saved here, on this device only.</p>
        </div>
      )}
      {!!scans?.length && (
        <ul className="history">
          {scans.map((s) => (
            <ScanRow key={s.id} s={s} displayName={displayName} onDelete={(id) => deleteScan(id).then(refresh)} />
          ))}
        </ul>
      )}
      {!!scans?.length && <p className="foot">{scans.length} saved · each stores the model version used</p>}
    </section>
  )
}
