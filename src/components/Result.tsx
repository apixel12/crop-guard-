import { ArrowLeft, CaretDown, CheckCircle, Question, WarningCircle, WarningOctagon } from '@phosphor-icons/react'
import type { ConditionInfo } from '../data/types'
import type { Prediction } from '../ml/classify'
import { ISSUE_TEXT, type QualityReport } from '../ml/qualityGate'

export type Outcome =
  | { kind: 'quality'; report: QualityReport }
  | { kind: 'prediction'; pred: Prediction; info?: ConditionInfo; cropMismatch?: boolean; cropName: string; threshold: number; saved?: boolean }
  | { kind: 'error'; message: string }

/** Never show 100%: softmax confidence is not certainty. */
export const pct = (p: number) => `${Math.min(99, Math.round(p * 100))}%`

const SEVERITY: Record<ConditionInfo['severity'], { text: string; cls: string }> = {
  none: { text: 'Looks healthy', cls: 'healthy' },
  low: { text: 'Usually minor', cls: '' },
  moderate: { text: 'Worth keeping an eye on', cls: 'attention' },
  high: { text: 'Act soon', cls: 'attention' },
  regulated: { text: 'Must be reported in California', cls: 'attention' },
}

import type { Plant } from '../ml/router'

interface Props {
  photo: string
  outcome: Outcome
  plant: Plant | null
  onChangePlant?: () => void
  onRetake: () => void
  onHome: () => void
  displayName: (label: string) => string
}

function PlantLine({ name, onChange }: { name: string; onChange?: () => void }) {
  return (
    <span className="plant-line">
      <span className="crop">{name} leaf</span>
      {onChange && <button className="text-link" onClick={onChange}>Not {name.toLowerCase()}? Change plant</button>}
    </span>
  )
}

function Ranked({ top, displayName }: { top: Prediction['top']; displayName: (l: string) => string }) {
  return (
    <ol className="ranked">
      {top.map((t) => (
        <li key={t.index}>
          <div className="r"><span>{displayName(t.label)}</span><span>{pct(t.confidence)}</span></div>
          <div className="bar"><span style={{ width: `${Math.max(2, t.confidence * 100)}%` }} /></div>
        </li>
      ))}
    </ol>
  )
}

export default function Result({ photo, outcome, onRetake, onHome, displayName, onChangePlant }: Props) {
  const p = outcome.kind === 'prediction' ? outcome : null
  const confident = p?.pred.status === 'confident'
  const info = p?.info
  const healthy = confident && info?.severity === 'none'
  const sev = info ? SEVERITY[info.severity] : null

  return (
    <section className="screen">
      <div className="topbar">
        <button className="icon-btn back" onClick={onHome}><ArrowLeft size={20} aria-hidden />Home</button>
        {p && <span className="caption">{p.pred.modelVersion} · on this phone</span>}
      </div>
      <img className="result-photo" src={photo} alt="The leaf that was checked" />

      {outcome.kind === 'quality' && (
        <div className="verdict">
          <span className="pill uncertain"><Question size={16} aria-hidden />Not checked</span>
          <h1>The photo needs retaking</h1>
          <ul className="bullets lede">{outcome.report.issues.map((i) => <li key={i}>{ISSUE_TEXT[i]}</li>)}</ul>
        </div>
      )}

      {outcome.kind === 'error' && (
        <div className="callout attention" role="alert">
          <WarningCircle size={20} aria-hidden />
          <div><b>Something went wrong.</b> {outcome.message} No result was made up.</div>
        </div>
      )}

      {p && !confident && (
        <div className="verdict">
          <PlantLine name={p.cropName} onChange={onChangePlant} />
          <h1>Not sure about this one</h1>
          <span className="pill uncertain"><Question size={16} aria-hidden />Not confident enough to name a problem</span>
          <p className="lede">
            {p.cropMismatch
              ? `This doesn’t look like the ${p.cropName.toLowerCase()} leaves the model knows. It may be a different plant, or the photo may need retaking.`
              : 'Rather than guess, CropGuard only names a problem when it’s confident. A clearer photo usually helps.'}
          </p>
          <ul className="bullets lede">
            <li>Shoot in daylight, out of harsh sun</li>
            <li>One leaf, filling the square</li>
            <li>Hold still so it’s sharp</li>
          </ul>
        </div>
      )}

      {p && confident && (
        <div className="verdict">
          <PlantLine name={p.cropName} onChange={onChangePlant} />
          <h1>{healthy ? 'No problems spotted' : info?.name ?? displayName(p.pred.top[0].label)}</h1>
          {sev && (
            <span className={`pill ${sev.cls}`}>
              {healthy ? <CheckCircle size={16} weight="fill" aria-hidden /> : <WarningCircle size={16} aria-hidden />}
              {sev.text}
            </span>
          )}
          <div>
            <div className="meter-row"><span>Model confidence</span><b>{pct(p.pred.top[0].confidence)}</b></div>
            <div className="meter" aria-hidden>
              <span style={{ width: `${p.pred.top[0].confidence * 100}%` }} />
              <i style={{ left: `${p.threshold * 100}%` }} />
            </div>
            <p className="caption" style={{ marginTop: 'var(--s2)' }}>
              How closely this matches what the model learned, not the chance it’s right. Below the line ({pct(p.threshold)}) CropGuard says it isn’t sure.
            </p>
          </div>
        </div>
      )}

      {p && confident && info?.severity === 'regulated' && (
        <div className="callout attention">
          <WarningOctagon size={20} aria-hidden />
          <div><b>This is a regulated citrus disease in California.</b> Don’t move leaves, fruit or cuttings off your property. Report it to the CDFA Pest Hotline: 1-800-491-1899.</div>
        </div>
      )}

      {p && confident && info && (
        <div className="panel">
          <section>
            <h3>{healthy ? 'What this means' : 'About this problem'}</h3>
            <p>{info.shortDescription}</p>
            {info.note && <p className="caption">{info.note}</p>}
          </section>
          <section>
            <h3>{healthy ? 'What healthy looks like' : 'What to look for'}</h3>
            <ul className="bullets">{info.visualSigns.map((s) => <li key={s}>{s}</li>)}</ul>
          </section>
          <section>
            <h3>What to do next</h3>
            {/* the CDFA reporting step is shown in its own callout */}
            <ul className="bullets">{info.generalNextSteps.filter((s) => !s.includes('CDFA')).map((s) => <li key={s}>{s}</li>)}</ul>
          </section>
        </div>
      )}

      {p && (
        <details className="panel">
          <summary>{confident ? 'Other possibilities' : 'What the model was considering'}<CaretDown size={18} aria-hidden /></summary>
          <Ranked top={confident ? p.pred.top.slice(1) : p.pred.top} displayName={displayName} />
        </details>
      )}

      <p className="fine-print">
        A screening aid, not a diagnosis. {p && (p.saved ? 'Saved to your history.' : 'Not saved: this phone’s storage is unavailable.')}
        {p && ` Checked in ${Math.round(p.pred.inferenceMs)} ms.`}
      </p>
      <div className="sticky-cta">
        <button className="btn primary full" onClick={onRetake}>Check another leaf</button>
      </div>
    </section>
  )
}
