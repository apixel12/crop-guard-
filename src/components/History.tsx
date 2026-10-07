import { ArrowLeft, Trash } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { deleteScan, listScans, type ScanRecord } from '../db/history'

function Thumb({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img className="thumb" src={url} alt="" /> : <span className="thumb" />
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
  const name = uncertain ? 'Not sure' : displayName(s.crop, s.prediction)
  return (
    <div className="list-row">
      <Thumb blob={s.thumbnail} />
      <span className="grow">
        <span className="title">{name}</span>
        <br />
        <span className="sub">
          {s.crop} · {when(s.timestamp)}
          {!uncertain && ` · ${Math.min(99, Math.round(s.confidence * 100))}%`}
        </span>
      </span>
      {onDelete && (
        <button className="icon-btn" aria-label={`Delete ${name} from ${when(s.timestamp)}`} onClick={() => onDelete(s.id)}>
          <Trash size={20} aria-hidden />
        </button>
      )}
    </div>
  )
}

export default function History({ onBack, displayName }: { onBack: () => void; displayName: RowProps['displayName'] }) {
  const [scans, setScans] = useState<ScanRecord[] | null>(null)
  const refresh = () => listScans().then(setScans).catch(() => setScans([]))
  useEffect(() => { refresh() }, [])

  return (
    <section className="screen">
      <div className="topbar">
        <button className="icon-btn back" onClick={onBack}><ArrowLeft size={20} aria-hidden />Back</button>
      </div>
      <div style={{ display: 'grid', gap: 'var(--s2)' }}>
        <h1>History</h1>
        <p className="lede">Saved only on this phone. Each check records which model version made it.</p>
      </div>
      {scans === null && <p className="caption">Loading…</p>}
      {scans?.length === 0 && (
        <div className="callout">
          <div><b>No checks yet.</b> When you check a leaf, the result is kept here so you can compare over time.</div>
        </div>
      )}
      {!!scans?.length && (
        <div className="list-card">
          {scans.map((s) => (
            <ScanRow key={s.id} s={s} displayName={displayName} onDelete={(id) => deleteScan(id).then(refresh)} />
          ))}
        </div>
      )}
    </section>
  )
}
