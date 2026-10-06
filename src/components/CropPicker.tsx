import { PV_CROPS } from '../ml/plantVillageClassifier'
import { ArrowLeft } from './Icons'

export default function CropPicker({ onPick, onBack, conditionsPerCrop }: {
  onPick: (key: string, name: string) => void
  onBack: () => void
  conditionsPerCrop: Record<string, number>
}) {
  return (
    <section className="screen">
      <div className="topbar">
        <button className="back" onClick={onBack}><ArrowLeft /> Home</button>
        <span className="crumb">PlantVillage<i>/</i>38 classes</span>
      </div>
      <div>
        <p className="kicker">Other crops</p>
        <h1 className="display page-title">Choose your crop</h1>
      </div>
      <p className="lede">
        This model covers these 14 crops only. Lemon has its own model, trained on real orchard photos. Use “Scan a lemon leaf” on the home screen.
      </p>
      <div className="crop-grid">
        {PV_CROPS.map((c) => (
          <button key={c.key} className="crop" onClick={() => onPick(c.key, c.name)}>
            {c.name}
            <span className="fig" aria-label={`${conditionsPerCrop[c.key]} conditions`}>{conditionsPerCrop[c.key]} cond.</span>
          </button>
        ))}
      </div>
    </section>
  )
}
