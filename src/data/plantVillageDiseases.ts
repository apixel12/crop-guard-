import { CONFIRM_STEP, DISCLAIMER, type ConditionInfo, type Severity } from './types'

type Row = [label: string, name: string, desc: string, signs: string[], severity: Severity, extra?: string[]]

const ISOLATE = 'Remove and bag clearly affected leaves where practical; avoid composting them.'
const WET = 'Water at the base and avoid wetting leaves.'
const HEALTHY = (crop: string): Row => [
  `${crop}___healthy`, 'Healthy', 'No disease pattern recognised on this leaf.', ['Uniform colour, no lesions or spots'], 'none',
  ['Keep monitoring; scan several leaves'],
]

const rows: Row[] = [
  ['Apple___Apple_scab', 'Apple Scab', 'Fungal disease (Venturia inaequalis) favoured by cool, wet spring weather.', ['Olive-green to dark velvety spots', 'Distorted leaves'], 'moderate', [ISOLATE, 'Rake and remove fallen leaves']],
  ['Apple___Black_rot', 'Black Rot', 'Fungal disease (Botryosphaeria obtusa) affecting leaves, fruit and bark.', ['Purple-bordered spots with tan centres ("frog-eye")'], 'moderate', [ISOLATE, 'Remove dead wood and mummified fruit']],
  ['Apple___Cedar_apple_rust', 'Cedar Apple Rust', 'Fungal disease that alternates between apple and juniper/cedar hosts.', ['Bright yellow-orange spots on upper leaf surface'], 'low', ['Note nearby junipers or cedars']],
  HEALTHY('Apple'),
  HEALTHY('Blueberry'),
  ['Cherry_(including_sour)___Powdery_mildew', 'Powdery Mildew', 'Fungal disease that forms a white powdery growth on leaves.', ['White, powdery patches', 'Curling of young leaves'], 'low', ['Improve air flow through the canopy']],
  HEALTHY('Cherry_(including_sour)'),
  ['Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Gray Leaf Spot', 'Fungal disease (Cercospora) favoured by warm, humid weather.', ['Rectangular grey-tan lesions bounded by veins'], 'moderate', ['Crop residue is a common source of infection']],
  ['Corn_(maize)___Common_rust_', 'Common Rust', 'Fungal disease (Puccinia sorghi).', ['Small, cinnamon-brown powdery pustules on both surfaces'], 'low'],
  ['Corn_(maize)___Northern_Leaf_Blight', 'Northern Leaf Blight', 'Fungal disease (Exserohilum turcicum).', ['Long, cigar-shaped grey-green to tan lesions'], 'moderate', ['Crop residue is a common source of infection']],
  HEALTHY('Corn_(maize)'),
  ['Grape___Black_rot', 'Black Rot', 'Fungal disease (Guignardia bidwellii) of grape leaves and fruit.', ['Tan spots with dark borders', 'Tiny black dots in the spots'], 'moderate', [ISOLATE]],
  ['Grape___Esca_(Black_Measles)', 'Esca (Black Measles)', 'A trunk disease complex caused by several wood-infecting fungi.', ['"Tiger-stripe" yellowing or browning between veins'], 'high'],
  ['Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', 'Leaf Blight (Isariopsis Leaf Spot)', 'Fungal leaf spot disease.', ['Irregular dark brown spots', 'Spots merging into blighted areas'], 'moderate', [ISOLATE]],
  HEALTHY('Grape'),
  ['Orange___Haunglongbing_(Citrus_greening)', 'Huanglongbing (Citrus Greening)', 'Serious bacterial disease spread by the Asian citrus psyllid; no cure.', ['Blotchy, asymmetric yellow mottling'], 'regulated',
    ['In California, report suspicions to the CDFA Pest Hotline (1-800-491-1899); do not move plant material.', 'Nutrient deficiencies can look similar; only a lab test can confirm HLB.']],
  ['Peach___Bacterial_spot', 'Bacterial Spot', 'Bacterial disease (Xanthomonas arboricola pv. pruni).', ['Small angular dark spots', 'Spots may fall out ("shot-hole")'], 'moderate'],
  HEALTHY('Peach'),
  ['Pepper,_bell___Bacterial_spot', 'Bacterial Spot', 'Bacterial disease (Xanthomonas) spread by splashing water.', ['Small water-soaked spots turning brown'], 'moderate', [WET, ISOLATE]],
  HEALTHY('Pepper,_bell'),
  ['Potato___Early_blight', 'Early Blight', 'Fungal disease (Alternaria solani), usually on older leaves first.', ['Brown spots with concentric "target" rings', 'Yellowing around spots'], 'moderate', [WET, ISOLATE]],
  ['Potato___Late_blight', 'Late Blight', 'Fast-spreading disease (Phytophthora infestans) in cool, wet weather.', ['Large, dark, water-soaked patches', 'White growth on the underside in humid conditions'], 'high', [ISOLATE, 'Act promptly; it can spread quickly between plants']],
  HEALTHY('Potato'),
  HEALTHY('Raspberry'),
  HEALTHY('Soybean'),
  ['Squash___Powdery_mildew', 'Powdery Mildew', 'Fungal disease forming white powdery growth.', ['White, powdery patches on leaves'], 'low', ['Improve air flow']],
  ['Strawberry___Leaf_scorch', 'Leaf Scorch', 'Fungal disease (Diplocarpon earlianum).', ['Small purple spots that merge', 'Leaves look scorched'], 'moderate', [ISOLATE]],
  HEALTHY('Strawberry'),
  ['Tomato___Bacterial_spot', 'Bacterial Spot', 'Bacterial disease spread by splashing water.', ['Small dark, greasy-looking spots'], 'moderate', [WET, ISOLATE]],
  ['Tomato___Early_blight', 'Early Blight', 'Fungal disease (Alternaria) starting on lower leaves.', ['Brown spots with concentric rings'], 'moderate', [WET, ISOLATE]],
  ['Tomato___Late_blight', 'Late Blight', 'Fast-spreading disease (Phytophthora infestans).', ['Large dark, water-soaked patches'], 'high', [ISOLATE, 'Act promptly; it can spread quickly']],
  ['Tomato___Leaf_Mold', 'Leaf Mold', 'Fungal disease (Passalora fulva) of humid, enclosed growing conditions.', ['Pale yellow spots on top', 'Olive-grey fuzzy growth underneath'], 'moderate', ['Improve ventilation']],
  ['Tomato___Septoria_leaf_spot', 'Septoria Leaf Spot', 'Fungal disease (Septoria lycopersici).', ['Many small round spots with dark borders and grey centres'], 'moderate', [WET, ISOLATE]],
  ['Tomato___Spider_mites Two-spotted_spider_mite', 'Spider Mites', 'Feeding damage from two-spotted spider mites.', ['Fine stippling', 'Webbing'], 'moderate', ['Check the leaf underside with a magnifier']],
  ['Tomato___Target_Spot', 'Target Spot', 'Fungal disease (Corynespora cassiicola).', ['Brown spots with light centres and rings'], 'moderate', [ISOLATE]],
  ['Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Yellow Leaf Curl Virus', 'Viral disease spread by whiteflies.', ['Upward curling', 'Yellow leaf margins', 'Stunted growth'], 'high', ['Look for whiteflies', 'Infected plants cannot be cured']],
  ['Tomato___Tomato_mosaic_virus', 'Mosaic Virus', 'Viral disease spread by contact and on tools or hands.', ['Light/dark green mosaic mottling', 'Distorted leaves'], 'high', ['Wash hands and tools after handling', 'Infected plants cannot be cured']],
  HEALTHY('Tomato'),
  // Beans (iBean dataset, Makerere AI Lab / NaCRRI)
  ['Bean___Angular_leaf_spot', 'Angular Leaf Spot', 'Fungal disease (Pseudocercospora griseola) favoured by warm, humid weather and spread by splashing water.',
    ['Grey-brown spots with sharp, angular edges bounded by leaf veins', 'Spots may merge and leaves can yellow and drop'], 'moderate',
    [WET, ISOLATE, 'Avoid working among wet plants; it spreads on hands and tools', 'Rotate where beans are planted each year']],
  ['Bean___Bean_rust', 'Bean Rust', 'Fungal disease (Uromyces appendiculatus) that spreads by airborne spores.',
    ['Small rusty-brown, powdery pustules, mostly on the leaf underside', 'Pustules often ringed with yellow'], 'moderate',
    ['Improve air flow between plants', ISOLATE, 'Remove plant debris at the end of the season']],
  HEALTHY('Bean'),
]

const CROP_NAME: Record<string, string> = {
  'Cherry_(including_sour)': 'Cherry',
  'Corn_(maize)': 'Corn',
  'Pepper,_bell': 'Bell Pepper',
}

export const PLANTVILLAGE_CONDITIONS: Record<string, ConditionInfo> = Object.fromEntries(
  rows.map(([label, name, desc, signs, severity, extra = []]) => {
    const cropKey = label.split('___')[0]
    return [label, {
      name,
      crop: CROP_NAME[cropKey] ?? cropKey,
      shortDescription: desc,
      visualSigns: signs,
      generalNextSteps: [...extra, CONFIRM_STEP],
      severity,
      disclaimer: DISCLAIMER,
    }]
  }),
)

export const plantVillageInfo = (label: string) => PLANTVILLAGE_CONDITIONS[label]
