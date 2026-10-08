# CropGuard

**Offline plant-leaf disease screening that runs entirely on your phone.**
Take a photo of a leaf. CropGuard works out which plant it is, then a model on the device identifies the likely condition, says how confident it is, explains what the condition means, and suggests conservative next steps. No upload, no account, no signal needed after the first visit. All of this completely free.

Built for Impact Hacks 2026.

**Data credit:** the models are trained on public datasets made by others: the Bangladesh lemon-leaf dataset (Mendeley Data, CC BY 4.0), PlantVillage (Hughes & Salathé, CC BY-SA 3.0) and iBean (Makerere AI Lab / NaCRRI, MIT). Full citations, licences, what we changed, and per-image manifests are in [DATA_SOURCES.md](DATA_SOURCES.md).

> CropGuard is an AI **screening** tool, not a diagnosis. Results should be confirmed by an agricultural extension office or plant specialist.

---

## The problem

Identifying plant disease early means recognising symptoms from what a leaf looks like. The people who most need that (home gardeners above all; also small growers and school gardens) often don't have an expert nearby, and many photo-ID tools send your images to a server and need a good connection, which fields and orchards often lack.

## What CropGuard does

| | |
|---|---|
| **One button** | "Check a leaf": a plant-identification model picks the right disease model; if it isn't sure, it asks |
| **Lemon model** | 18 lemon-leaf conditions, trained on real orchard photos |
| **Garden model** | 41 conditions across 15 garden crops (tomato, pepper, bean, squash, potato, strawberry and more), ordered by how often home gardeners grow them |
| **On-device** | TensorFlow.js in the browser; photos never leave the phone |
| **Offline** | Installable PWA; the app and all three models are cached on first visit |
| **Honest uncertainty** | Calibrated threshold; below it the app says "Uncertain", not a guess |
| **Photo-quality gate** | Rejects dark, overexposed, blurry and leaf-less photos before inference |
| **Local history** | Scans saved in IndexedDB on the device, each with its model version |

## Architecture

```
Camera / gallery photo
        │
        ▼
Photo-quality gate ──(fails)──► "The photo needs retaking" + how to fix
        │
        ▼
Plant identification (router-v1, 16 plants) ──(not confident)──► "Which plant is this?" (user picks)
        │
        ├── Lemon ─────────► lemon-v1 (18 classes)
        │                                 │
        └── Garden crop ──► garden-v1 (41 classes, crop must match)
                                          │
                                          ▼
                 Calibrated confidence threshold ──(below)──► "Uncertain result"
                                          │
                                          ▼
          Result + static, reviewed condition info + next steps → saved locally
```

Separate disease classifiers, never one merged label space: the datasets have different classes, and **PlantVillage contains no lemon**. A lemon leaf is never routed to the PlantVillage "Orange" class. If a garden prediction belongs to a different crop than the plant chosen, the result is forced to "Uncertain". Every result shows the plant with a "Change plant" link that re-checks the same photo.

### Preprocessing contract (training ⇄ browser)

Defined once in `training/shared/preprocessing.py` and mirrored in `src/ml/preprocess.ts`:

1. Decode; JPEGs use the **accurate integer DCT**, as browsers do (TF's fast default shifted borderline predictions by up to 0.17 in our parity test).
2. RGB, alpha dropped.
3. Center-crop to a square (the camera shows exactly this square), then resize to 224×224, bilinear, half-pixel centres. The crop removes aspect ratio as a shortcut: several lemon classes came from a single camera format.
4. Float32 in [0, 255]. Normalisation (`x / 127.5 − 1`) is a layer **inside** the model, so the browser can't apply the wrong one.

The browser does the bilinear resize on the CPU, which reads only 224×224×4 source pixels, instead of uploading a 12-megapixel camera frame to WebGL (which exceeds texture limits on many phones). Tests check it against Python's `tf.image.resize`, and an end-to-end check on the real model matched Python's outputs to 5 decimal places.

## Datasets

**Lemon:** *Large-Scale Lemon Leaf Disease and Pest Image Dataset from Bangladesh*, Mendeley Data, DOI [10.17632/8d9fv6kpt3.2](https://data.mendeley.com/datasets/8d9fv6kpt3/2), CC BY 4.0. Smartphone photos from four lemon-growing regions, labelled and reviewed by agricultural specialists.

**PlantVillage:** [spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset) (`raw/color`), 54,305 images, 38 classes, 14 crops. Hughes & Salathé, *An open access repository of images on plant health*, arXiv:1511.08060.

### Data validation (what we found and did)

<!-- DATA_VALIDATION -->
- **Lemon:** 17,586 images found (17,609 published), 18 classes, 0 corrupt.
- **2,645 byte-identical duplicates removed** (15% of the set; four classes were exactly doubled). Leaving them in would put copies in both train and test and inflate scores.
- Near-duplicates (perceptual hash, invariant to flips/rotations) are grouped so a group never spans splits: 432 groups, 962 images.
- 43 images that appear under two different labels were dropped as label noise.
- Final: 14,898 unique images → train 10,430 / val 2,234 / test 2,234.
- **Camera-format shortcut:** several lemon classes come from a single camera format, so image size alone predicted the class 24% of the time (chance 5.6%). Center-square cropping removes aspect ratio as a cue, and mild resolution jitter during training stops sharpness from identifying the source.
- **PlantVillage:** 54,305 images, 38 classes, 0 corrupt, 21 exact duplicates removed; all images 256×256.
<!-- /DATA_VALIDATION -->

## Model and training

- MobileNetV2, ImageNet weights, 224×224×3 RGB, transfer learning then fine-tuning (stage 1: head only; stage 2: top layers unfrozen at a 1e-5 learning rate; BatchNorm kept frozen; early stopping on validation loss).
- **Class imbalance:** balanced per-sample class weights, judged by macro F1, not just accuracy.
- **Field-robustness augmentation** (`training/shared/robust.py`): leaves composited small onto cluttered backgrounds, defocus and motion blur, sensor noise, JPEG artefacts, 90° rotations, exposure and white-balance shifts. Each is applied to a random subset of each batch.
- **Outlier exposure** (Hendrycks et al., ICLR 2019): synthetic non-leaf images (noise, textures, gradients, flat colour) are mixed into training with a *uniform* target, teaching the model to be unconfident on things that aren't leaves. The label space is unchanged.
- Reproducible seeds; grouped, stratified 70/15/15 splits; the test split is never used for training, early stopping or threshold choice.

### Confidence thresholds

Softmax confidence is not a probability of being right. The threshold is calibrated on the **validation** split as the loosest cut-off at which ≥99% of accepted predictions are correct, then reported (not tuned) on the test split. It is stored in each model's `metadata.json`, and the result screen draws it on the confidence meter.

## Evaluation

<!-- EVALUATION -->
### Lemon

**Lemon model** (`lemon-v1`), held-out test split, 2,234 images:

| Accuracy | Macro F1 | Weighted F1 | Top-3 | Confident coverage | Precision when confident |
|---|---|---|---|---|---|
| 83.0% | 78.5% | 83.0% | 96.4% | 44.9% | 99.1% |

Threshold: confidence ≥ 0.99, margin ≥ 0.0, chosen on validation for 99.0% precision. Below it the app says "Uncertain". Scores average each image with its mirror image (test-time augmentation), exactly as the app does.

<details><summary>Per-class results</summary>

| Class | Precision | Recall | F1 | Test images |
|---|---|---|---|---|
| Citrus_Scab | 100.0% | 100.0% | 100.0% | 48 |
| Lemon_Sooty_Mold | 98.8% | 99.6% | 99.2% | 239 |
| Algal_Leaf_Spot | 97.7% | 100.0% | 98.9% | 130 |
| Citrus_Pest | 97.6% | 96.4% | 97.0% | 83 |
| Yellow_Spot | 87.0% | 97.1% | 91.7% | 103 |
| Healthy | 86.2% | 96.7% | 91.2% | 245 |
| Black Spot | 95.6% | 81.9% | 88.2% | 105 |
| Citrus Hindu Mite | 85.4% | 86.4% | 85.9% | 81 |
| Citrus Canker | 91.8% | 75.8% | 83.0% | 223 |
| Curl Leaf | 74.7% | 82.2% | 78.3% | 230 |
| Swallowtail Larval Herbivory (Deficiency) | 72.8% | 83.4% | 77.8% | 151 |
| Dry Leaf | 68.6% | 85.7% | 76.2% | 28 |
| Greening | 79.6% | 66.4% | 72.4% | 259 |
| Anthracnose | 73.3% | 69.3% | 71.3% | 127 |
| Citrus Leafminer | 75.3% | 47.0% | 57.9% | 117 |
| Melanose | 42.5% | 60.7% | 50.0% | 28 |
| Bacterial Blight | 47.4% | 50.0% | 48.6% | 18 ⚠︎ few images |
| Spider Mites | 30.9% | 89.5% | 45.9% | 19 ⚠︎ few images |

</details>

**Lemon stress test**, generated from held-out test images (see `training/stress_test.py`):

| Condition | Accuracy | Confidently wrong |
|---|---|---|
| clean | 81.1% | 0.6% |
| dim light (x0.45) | 73.9% | 0.0% |
| overexposed (x1.6) | 82.2% | 0.0% |
| warm white balance | 80.0% | 0.6% |
| gaussian blur | 55.0% | 0.0% |
| motion blur | 50.0% | 0.0% |
| sensor noise | 76.7% | 0.0% |
| jpeg q=20 | 75.0% | 0.0% |
| low resolution (48px) | 66.1% | 0.0% |
| rotated 90° | 82.8% | 0.0% |
| corner occluded/shadow | 78.3% | 0.6% |
| leaf far away on clutter (55%) | 51.7% | 0.6% |

| Not-a-leaf input | Flagged uncertain |
|---|---|
| uniform colour | 100.0% |
| random noise | 100.0% |
| clutter texture only | 100.0% |
| gradients | 100.0% |

EXIF orientation: 594 test photos carry a rotation tag. Accuracy on them is 94.6% in raw orientation (as trained) vs 93.9% upright (as the browser shows them), so orientation does not materially change results.

### Garden crops (PlantVillage + beans)

**Garden model** (`garden-v1`), held-out test split, 8,271 images:

| Accuracy | Macro F1 | Weighted F1 | Top-3 | Confident coverage | Precision when confident |
|---|---|---|---|---|---|
| 96.7% | 95.4% | 96.7% | 99.6% | 92.5% | 99.1% |

Threshold: confidence ≥ 0.5, margin ≥ 0.66, chosen on validation for 99.0% precision. Below it the app says "Uncertain". Scores average each image with its mirror image (test-time augmentation), exactly as the app does.

| Test source | Photos | Accuracy | Right when confident |
|---|---|---|---|
| ibean | 128 | 93.0% | 100.0% |
| plantvillage | 8,143 | 96.7% | 99.1% |

### Plant identification (one-button flow)

**Plant identification** (`router-v1`), held-out test split, 6,350 images:

| Accuracy | Macro F1 | Weighted F1 | Top-3 | Confident coverage | Precision when confident |
|---|---|---|---|---|---|
| 98.3% | 98.5% | 98.3% | 99.8% | 98.5% | 99.0% |

Threshold: confidence ≥ 0.63, margin ≥ 0.34, chosen on validation for 99.0% precision. Below it the app says "Uncertain". Scores average each image with its mirror image (test-time augmentation), exactly as the app does.

Background-shortcut test: 400 non-lemon test leaves pasted onto field-like clutter were sent to the lemon model 0.0% of the time (clean: 0.0%); 95.8% were routed to the right plant and 4.0% asked the user. When it isn't confident, the app asks which plant it is.

Robustness training (v1 → v2), same generated stress data:

| Condition | v1 accuracy | v2 accuracy | v1 confidently wrong | v2 confidently wrong |
|---|---|---|---|---|
| clean | 93.9% | 92.5% | 1.3% | 1.4% |
| dim light (x0.45) | 83.2% | 88.2% | 4.6% | 2.0% |
| overexposed (x1.6) | 92.5% | 92.0% | 1.8% | 1.4% |
| warm white balance | 89.5% | 88.9% | 1.8% | 1.4% |
| gaussian blur | 46.3% | 82.1% | 19.5% | 1.3% |
| motion blur | 57.8% | 87.4% | 9.2% | 1.2% |
| sensor noise | 59.7% | 81.6% | 9.3% | 1.7% |
| jpeg q=20 | 82.0% | 88.8% | 4.6% | 0.7% |
| low resolution (48px) | 54.9% | 86.1% | 13.0% | 1.1% |
| rotated 90° | 84.5% | 90.4% | 3.0% | 1.2% |
| corner occluded/shadow | 87.1% | 87.6% | 2.8% | 2.1% |
| leaf far away on clutter (55%) | 41.2% | 83.8% | 13.7% | 1.7% |

| Not-a-leaf input | v1 flagged uncertain | v2 flagged uncertain |
|---|---|---|
| uniform colour | 87.5% | 100.0% |
| random noise | 11.5% | 100.0% |
| clutter texture only | 82.5% | 100.0% |
| gradients | 75.5% | 100.0% |

The stress test's background clutter uses a different generator from training, so it is not measuring memorised textures.
<!-- /EVALUATION -->

### Dataset benchmark ≠ field performance

All numbers above come from held-out images **from the same datasets**. The lemon photos come from Bangladeshi orchards; a lemon tree in California differs in cultivar, light, camera and background. **These numbers are not a claim about accuracy on your tree.** Use `training/field_test.py` on your own photos to see how the real pipeline behaves.

## Offline and privacy

- `vite-plugin-pwa` precaches the app shell, fonts, icons, both `model.json` files, **every weight shard by name** and both metadata files. `npm run build` fails if any model file is missing from the precache manifest (`scripts/verify-sw.mjs`).
- "Ready, and works offline" is shown only after all three models have loaded, passed a self-test (shape, finite outputs, softmax sums to 1) **and** every shard is confirmed present in Cache Storage.
- No backend, no image upload, no analytics, no account. `?netlog=1` turns on a request logger for offline testing.

## Security

- **Strict Content-Security-Policy** (`security-headers.json`, shipped via `vercel.json` and used by `vite preview` so it is tested): scripts only from this origin, no `eval`, no plugins, no framing (`frame-ancestors 'none'`), and `connect-src 'self'`, so a photo has nowhere to be sent even if code were injected.
- **Permissions-Policy:** camera for this origin only; microphone, location, payment and USB off.
- `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, HSTS.
- **Camera is released whenever the app is hidden** (app switch, lock screen) and resumes on return.
- **Untrusted files:** non-images and files over 60 MB are refused before decoding; images over 200 MP are refused after (decompression bombs).
- **No backend, no accounts, no analytics, no third-party requests.** Development network logging (`?netlog=1`) does not exist in production builds.
- Training-side downloads verify TLS (certifi); the iBean extractor writes only to an allowlist of class folders.
- `npm audit`: 0 known vulnerabilities at the time of writing. `tests/security.test.ts` locks the header policy.

## Datasets for garden crops: what was chosen and why

Crops were chosen from the National Gardening Association's list of the most-grown home vegetables (tomatoes 86% of food gardens, then cucumbers, peppers, beans, carrots, squash…).
- **Beans:** iBean (expert-annotated by NaCRRI, field smartphone photos, MIT). Its official test split was kept. 1,295 images, 0 duplicates, all 500×500 (no camera-format shortcut).
- **Cucumber: not included.** The available datasets mix augmented copies with ~1,280 originals (half of them fruit, not leaves) and have no accompanying paper. Copies would leak between train and test, so they didn't meet the bar.
- **PlantDoc** (real-world photos for the same crops, CC BY 4.0): the pipeline supports it (`training/garden/build_dataset.py`) but it was not used for this build; the download didn't finish over the available connection.

## Limitations

- Screening only. Some lemon dataset labels are symptoms rather than causes ("Curl Leaf", "Dry Leaf", "Yellow Spot"), and one combines two causes ("Swallowtail Larval Herbivory / Deficiency"); the app says so on those results.
- Small classes (e.g. Bacterial Blight, Spider Mites) have few unique test images after deduplication, so their per-class scores are noisy.
- PlantVillage images are lab photos on plain backgrounds; real-field accuracy for those crops is lower.
- Advice is deliberately conservative and static; no treatment or pesticide recommendations.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit + integration tests
npm run build        # production build + precache verification
npx vite preview &   # serve the build on :4173
npm run test:e2e     # offline acceptance test in real Chrome (airplane mode, gallery + camera, history)
```

Training (Python 3.12, Apple Silicon GPU via tensorflow-metal):

```bash
python3 -m venv .venv && .venv/bin/pip install "tensorflow==2.16.2" tensorflow-metal pillow numpy scikit-learn imagehash certifi "setuptools<70"
python3 -m venv .venv-tfjs && .venv-tfjs/bin/pip install tensorflowjs "protobuf==6.31.1"
# lemon: download the zip from Mendeley and unzip into data/lemon_raw/
.venv/bin/python training/lemon/verify_dataset.py
.venv/bin/python training/lemon/prepare_dataset.py
.venv/bin/python training/lemon/train.py
.venv/bin/python training/lemon/evaluate.py
.venv/bin/python training/lemon/export.py
.venv/bin/python training/stress_test.py lemon        # generated field-condition stress test
.venv/bin/python training/field_test.py lemon         # your own photos in data/field_photos/
```

## Install on a phone

The deployed URL must be HTTPS (camera access needs a secure context).

- **iPhone:** open in Safari, wait for "AI ready offline", then Share → Add to Home Screen.
- **Android:** open in Chrome, wait for "AI ready offline", then ⋮ → Install app.

To test offline: open from the home-screen icon, turn on airplane mode, close and reopen the app, then scan.

## Licenses and credits

- Lemon dataset: CC BY 4.0. Cite the Mendeley dataset above.
- PlantVillage: CC BY-SA 3.0 (per the repository's dataset card); cite Hughes & Salathé (2015).
- MobileNetV2: Sandler et al., CVPR 2018 (ImageNet weights via Keras Applications).
- iBean (beans): Makerere AI Lab with NaCRRI, MIT licence (Hugging Face: AI-Lab-Makerere/beans).
- Typeface: Public Sans, SIL Open Font License, self-hosted via Fontsource. Icons: Phosphor, MIT.
- `tests/e2e/healthy-lemon.jpg` is one image from the lemon dataset (CC BY 4.0), used as the offline test photo.
