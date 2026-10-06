import type { ConditionInfo } from '../data/types'
import type { Prediction } from '../ml/classify'
import { ISSUE_TEXT, type QualityReport } from '../ml/qualityGate'
import { ArrowLeft, ArrowRight } from './Icons'

export type Outcome =
  | { kind: 'quality'; report: QualityReport }
  | { kind: 'prediction'; pred: Prediction; info?: ConditionInfo; cropMismatch?: boolean; cropName: string; threshold: number }
  | { kind: 'error'; message: string }

/** Never show 100%: softmax confidence is not certainty. */
export const pct = (p: number) => `${Math.min(99, Math.round(p * 100))}%`

const SEVERITY: Record<ConditionInfo['severity'], { label: string; cls: string }> = {
  none: { label: 'No action needed', cls: '' },
  low: { label: 'Usually minor', cls: 'muted' },
  moderate: { label: 'Worth attention', cls: 'amber' },
  high: { label: 'Act promptly', cls: 'amber' },
  regulated: { label: 'Regulated in CA', cls: 'amber' },
}

interface Props {
  photo: string
  outcome: Outcome
  onRetake: () => void
  onHome: () => void
  displayName: (label: string) => string
}

function Ranked({ top, displayName }: { top: Prediction['top']; displayName: (l: string) => string }) {
  return (
    <ol className="ranked">
      {top.map((t) => (
        <li key={t.index}>
          <div className="row"><span>{displayName(t.label)}</span><span className="fig">{pct(t.confidence)}</span></div>
          <div className="bar"><span style={{ width: `${Math.max(2, t.confidence * 100)}%` }} /></div>
        </li>
      ))}
    </ol>
  )
}

export default function Result({ photo, outcome, onRetake, onHome, displayName }: Props) {
  const p = outcome.kind === 'prediction' ? outcome : null
  const confident = p?.pred.status === 'confident'
  const info = p?.info
  const healthy = confident && info?.severity === 'none'

  return (
    <section className="screen result">
      <div className="topbar">
        <button className="back" onClick={onHome}><ArrowLeft /> Home</button>
        <span className="crumb">{p ? p.cropName : 'Scan'}<i>/</i>Result</span>
      </div>
      <img className="result-photo" src={photo} alt="The leaf that was analyzed" />

      {outcome.kind === 'quality' && (
        <div className="panel verdict uncertain" role="alert">
          <p className="kicker">Not analyzed</p>
          <h1 className="display">Photo quality too low</h1>
          <p>The photo was checked before analysis and isn’t usable yet:</p>
          <ul className="list" style={{ marginTop: 'var(--s3)' }}>{outcome.report.issues.map((i) => <li key={i}>{ISSUE_TEXT[i]}</li>)}</ul>
        </div>
      )}

      {outcome.kind === 'error' && (
        <div className="notice error" role="alert">
          <b>Analysis failed.</b> {outcome.message} No result was produced, and nothing was guessed.
        </div>
      )}

      {p && !confident && (
        <div className="panel verdict uncertain">
          <p className="kicker">{p.cropName} leaf · screening</p>
          <h1 className="display">Uncertain result</h1>
          <p>
            {p.cropMismatch
              ? `This doesn’t closely match the ${p.cropName.toLowerCase()} conditions the model was trained on. It may be another plant, or the photo may need retaking.`
              : 'The image doesn’t provide enough evidence for a reliable classification, so CropGuard won’t guess.'}
          </p>
          <ul className="list" style={{ marginTop: 'var(--s4)' }}>
            <li>Retake in natural light, without harsh shadows</li>
            <li>Put one leaf in the frame and move closer</li>
            <li>Hold steady so the leaf is sharp</li>
            <li>Avoid busy backgrounds</li>
          </ul>
        </div>
      )}

      {p && confident && (
        <div className={`panel verdict ${healthy ? 'healthy' : ''}`}>
          <p className="kicker">{p.cropName} leaf · {healthy ? 'result' : 'possible condition'}</p>
          <h1 className="display">{healthy ? 'No disease pattern detected' : info?.name ?? displayName(p.pred.top[0].label)}</h1>
          {info && (
            <div className="verdict-meta">
              <span className={`tag ${SEVERITY[info.severity].cls}`}>{SEVERITY[info.severity].label}</span>
              {info.note && <span className="tag muted">Broad label</span>}
            </div>
          )}
          <div className="confidence">
            <div className="confidence-row">
              <span className="panel-label" style={{ margin: 0 }}>Model confidence</span>
              <span className="confidence-value">{pct(p.pred.top[0].confidence)}</span>
            </div>
            <div className="meter" aria-hidden>
              <span style={{ width: `${p.pred.top[0].confidence * 100}%` }} />
              <i style={{ left: `${p.threshold * 100}%` }} />
            </div>
            <p className="meter-caption">
              How strongly the photo matched the model’s training data. This is not the chance the condition is present. Below the mark ({pct(p.threshold)}), CropGuard reports “uncertain”.
            </p>
          </div>
        </div>
      )}

      {p && confident && info?.severity === 'regulated' && (
        <div className="notice warn">
          <b>Regulated citrus disease in California.</b> Don’t move leaves, fruit or cuttings off the property. Report suspicions to the CDFA Pest Hotline, 1-800-491-1899.
        </div>
      )}

      {p && confident && info && (
        <div className="panel">
          <p className="panel-label">What this means</p>
          <p>{info.shortDescription}</p>
          {info.note && <p className="note">{info.note}</p>}
          <p className="panel-label">{healthy ? 'What healthy looks like' : 'Signs to look for'}</p>
          <ul className="list">{info.visualSigns.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="panel-label" style={{ marginTop: 'var(--s5)' }}>What to do next</p>
          {/* the CDFA reporting step is shown in its own notice above */}
          <ul className="list">{info.generalNextSteps.filter((s) => !s.includes('CDFA')).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}

      {p && (
        <details className="panel">
          <summary><span className="panel-label">{confident ? 'Other possibilities' : 'What the model considered'}</span></summary>
          <Ranked top={confident ? p.pred.top.slice(1) : p.pred.top} displayName={displayName} />
        </details>
      )}

      <p className="disclaimer">
        This is an AI screening result, not a professional diagnosis. Confirm with a local agricultural extension office or plant specialist before acting.
      </p>
      {p && (
        <p className="run-meta">
          {p.pred.modelVersion} · on-device · {Math.round(p.pred.inferenceMs)} ms · saved to history
        </p>
      )}
      <button className="button primary big" onClick={onRetake}>Scan another leaf <ArrowRight /></button>
    </section>
  )
}
