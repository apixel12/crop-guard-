import { useEffect, useState } from 'react'
import { deleteScan, listScans, type ScanRecord } from '../db/history'

function Thumb({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img src={url} alt="" /> : null
}

export default function History({ onBack, displayName }: { onBack: () => void; displayName: (crop: string, label: string) => string }) {
  const [scans, setScans] = useState<ScanRecord[] | null>(null)
  const refresh = () => listScans().then(setScans).catch(() => setScans([]))
  useEffect(() => { refresh() }, [])

  return (
    <section className="screen">
      <header className="bar">
        <button className="link" onClick={onBack}>← Back</button>
        <h2>Scan history</h2>
      </header>
      <p className="muted">Stored only on this device.</p>
      {scans === null && <p className="muted">Loading…</p>}
      {scans?.length === 0 && <p className="empty">No scans yet.</p>}
      <ul className="history">
        {scans?.map((s) => (
          <li key={s.id}>
            <Thumb blob={s.thumbnail} />
            <div className="h-body">
              <strong>{s.status === 'uncertain' ? 'Uncertain' : displayName(s.crop, s.prediction)}</strong>
              <span className="muted">
                {s.crop} · {Math.round(s.confidence * 100)}% · {new Date(s.timestamp).toLocaleString()}
              </span>
              <span className="meta">{s.modelVersion}</span>
            </div>
            <button className="link danger" aria-label="Delete scan" onClick={() => deleteScan(s.id).then(refresh)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
