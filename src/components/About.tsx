import { useModels } from '../hooks/useModels'
import type { ModelId } from '../ml/modelRegistry'
import { ArrowLeft } from './Icons'

const pctOf = (v: unknown) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—')

function ModelCard({ id, title }: { id: ModelId; title: string }) {
  const { models } = useModels()
  const meta = models[id]?.meta
  return (
    <div className="panel">
      <p className="panel-label">{title} <span>{id}</span></p>
      {meta ? (
        <>
          <div className="stat-grid">
            <div className="stat"><span className="stat-value">{pctOf(meta.metrics.accuracy)}</span><span className="stat-label">Test accuracy</span></div>
            <div className="stat"><span className="stat-value">{pctOf(meta.metrics.macroF1)}</span><span className="stat-label">Macro F1</span></div>
            <div className="stat"><span className="stat-value">{pctOf(meta.thresholds.testPrecisionAccepted)}</span><span className="stat-label">Right when confident</span></div>
          </div>
          <p className="note">
            Measured on {String(meta.metrics.testImages ?? 'held-out')} held-out images from the same dataset, never seen in training.
            Confident answers need ≥ {Math.round(meta.thresholds.confidence * 100)}% model confidence, calibrated on validation data. Dataset scores are not a promise of accuracy on your plants.
          </p>
        </>
      ) : <p className="note">Model not loaded on this device.</p>}
    </div>
  )
}

export default function About({ onBack }: { onBack: () => void }) {
  return (
    <section className="screen">
      <div className="topbar">
        <button className="back" onClick={onBack}><ArrowLeft /> Home</button>
        <span className="crumb">About</span>
      </div>
      <div>
        <p className="kicker">How it works</p>
        <h1 className="display page-title">On-device screening</h1>
      </div>
      <p className="lede">
        CropGuard runs two MobileNetV2 image classifiers inside your browser with TensorFlow.js. Your photo is analyzed on this device and never uploaded.
      </p>

      <ModelCard id="lemon-v1" title="Lemon model" />
      <ModelCard id="plantvillage-v2" title="PlantVillage model" />

      <div className="panel">
        <p className="panel-label">Data and credits</p>
        <ul className="list">
          <li>
            Lemon: <i>Large-Scale Lemon Leaf Disease and Pest Image Dataset from Bangladesh</i>, Mendeley Data, DOI 10.17632/8d9fv6kpt3.2. Licensed CC BY 4.0. Duplicate images were removed before training.
          </li>
          <li>
            PlantVillage: Hughes &amp; Salathé (2015), github.com/spMohanty/PlantVillage-Dataset. Licensed CC BY-SA 3.0.
          </li>
          <li>MobileNetV2: Sandler et al. (2018). Fonts: Barlow, Space Grotesk and Chivo Mono under the SIL Open Font License.</li>
        </ul>
      </div>

      <div className="panel">
        <p className="panel-label">Limits</p>
        <ul className="list">
          <li>Screening, not diagnosis. Advice is deliberately general.</li>
          <li>Some lemon labels describe a symptom, not a cause (curl leaf, dry leaf, yellow spot).</li>
          <li>Trained on orchard photos from Bangladesh and lab photos for other crops, so results on your plants may differ.</li>
        </ul>
      </div>
      <p className="foot">No account · no analytics · no uploads</p>
    </section>
  )
}
