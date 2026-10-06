import type { ConditionInfo } from '../data/types'
import type { Prediction } from '../ml/classify'
import { ISSUE_TEXT, type QualityReport } from '../ml/qualityGate'

export type Outcome =
  | { kind: 'quality'; report: QualityReport }
  | { kind: 'prediction'; pred: Prediction; info?: ConditionInfo; cropMismatch?: boolean; cropName: string }
  | { kind: 'error'; message: string }

const pct = (p: number) => `${Math.round(p * 100)}%`

interface Props {
  photo: string
  outcome: Outcome
  onRetake: () => void
  onHome: () => void
  displayName: (label: string) => string
}

export default function Result({ photo, outcome, onRetake, onHome, displayName }: Props) {
  return (
    <section className="screen result">
      <header className="bar">
        <button className="link" onClick={onHome}>← Home</button>
      </header>
      <img className="result-photo" src={photo} alt="Analyzed leaf" />

      {outcome.kind === 'quality' && (
        <div className="card warn" role="alert">
          <p className="eyebrow">Not analyzed</p>
          <h1>Photo quality too low</h1>
          <ul className="list">{outcome.report.issues.map((i) => <li key={i}>{ISSUE_TEXT[i]}</li>)}</ul>
        </div>
      )}

      {outcome.kind === 'error' && (
        <div className="card warn" role="alert">
          <h1>Analysis failed</h1>
          <p>{outcome.message}</p>
          <p className="muted">No result was produced. Nothing was guessed.</p>
        </div>
      )}

      {outcome.kind === 'prediction' && outcome.pred.status === 'uncertain' && (
        <div className="card warn">
          <p className="eyebrow">{outcome.cropName} leaf</p>
          <h1>Uncertain result</h1>
          <p>
            {outcome.cropMismatch
              ? `This doesn't closely match the ${outcome.cropName.toLowerCase()} conditions the model was trained on.`
              : 'The image does not provide enough evidence for a reliable classification.'}
          </p>
          <ul className="list">
            <li>Retake the photo</li>
            <li>Improve lighting: natural light, no harsh shadows</li>
            <li>Place one leaf in the frame</li>
            <li>Move closer so the leaf fills most of the frame</li>
            <li>Avoid heavily cluttered backgrounds</li>
          </ul>
          <details>
            <summary>What the model considered</summary>
            <ol className="ranked">
              {outcome.pred.top.map((t) => (
                <li key={t.index}><span>{displayName(t.label)}</span><span>{pct(t.confidence)}</span></li>
              ))}
            </ol>
          </details>
        </div>
      )}

      {outcome.kind === 'prediction' && outcome.pred.status === 'confident' && (
        <>
          <div className="card">
            <p className="eyebrow">{outcome.cropName} leaf</p>
            <p className="label-sm">Possible condition</p>
            <h1>{outcome.info?.name ?? displayName(outcome.pred.top[0].label)}</h1>
            <div className="conf">
              <span className="label-sm">Model confidence</span>
              <span className="conf-val">{pct(outcome.pred.top[0].confidence)}</span>
            </div>
            <div className="meter" aria-hidden><span style={{ width: pct(outcome.pred.top[0].confidence) }} /></div>
            {outcome.info?.severity === 'regulated' && (
              <p className="flag">Regulated in California: see next steps</p>
            )}
          </div>

          {outcome.info && (
            <>
              <div className="card">
                <h3>What this means</h3>
                <p>{outcome.info.shortDescription}</p>
                {outcome.info.note && <p className="muted">{outcome.info.note}</p>}
                <h3>Signs to look for</h3>
                <ul className="list">{outcome.info.visualSigns.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div className="card">
                <h3>What to do next</h3>
                <ul className="list">{outcome.info.generalNextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            </>
          )}

          <details className="card">
            <summary>Other possibilities</summary>
            <ol className="ranked">
              {outcome.pred.top.slice(1).map((t) => (
                <li key={t.index}><span>{displayName(t.label)}</span><span>{pct(t.confidence)}</span></li>
              ))}
            </ol>
          </details>
        </>
      )}

      <p className="disclaimer">
        This is an AI screening result, not a professional diagnosis. Model confidence is not a probability that the condition is present.
      </p>
      {outcome.kind === 'prediction' && (
        <p className="meta">
          {outcome.pred.modelVersion} · analyzed on this device in {Math.round(outcome.pred.inferenceMs)} ms · saved to history
        </p>
      )}
      <div className="actions">
        <button className="btn primary" onClick={onRetake}>Scan another leaf</button>
      </div>
    </section>
  )
}
