# CropGuard

**Offline plant-leaf disease screening that runs entirely on your phone.**
Take a photo of a leaf; a model on the device identifies the likely condition, says how confident it is, explains what the condition means, and suggests conservative next steps. No upload, no account, no signal needed after the first visit.

Built for Impact Hacks 2026.

> CropGuard is an AI **screening** tool, not a diagnosis. Results should be confirmed by an agricultural extension office or plant specialist.

---

## The problem

Identifying plant disease early means recognising symptoms from what a leaf looks like. The people who most need that (backyard growers, small farms, school gardens) often don't have an expert nearby, and many photo-ID tools send your images to a server and need a good connection, which fields and orchards often lack.

## What CropGuard does

| | |
|---|---|
| **Lemon model** | 18 lemon-leaf conditions, trained on real orchard photos (the primary path) |
| **PlantVillage model** | 38 conditions across 14 other crops |
| **On-device** | TensorFlow.js in the browser; photos never leave the phone |
| **Offline** | Installable PWA; app and both models are cached on first visit |
| **Honest uncertainty** | Calibrated threshold; below it the app says "Uncertain", not a guess |
| **Photo-quality gate** | Rejects dark, overexposed, blurry and leaf-less photos before inference |
| **Local history** | Scans saved in IndexedDB on the device, each with its model version |

## Architecture

```
Camera / gallery photo
        │
        ▼
Photo-quality gate ──(fails)──► "Photo quality too low" + how to fix
        │
        ▼
User picks crop path ─── Lemon ───► lemon-v1 (18 classes)
        │                                 │
        └── Other crop ──► plantvillage-v1 (38 classes, crop must match)
                                          │
                                          ▼
                 Calibrated confidence threshold ──(below)──► "Uncertain result"
                                          │
                                          ▼
          Result + static, reviewed condition info + next steps → saved locally
```

Two separate classifiers, never one merged label space: the datasets have different classes, and **PlantVillage contains no lemon**. A lemon leaf is never routed to the PlantVillage "Orange" class. If a PlantVillage prediction belongs to a different crop than the user selected, the result is forced to "Uncertain".

### Preprocessing contract (training ⇄ browser)

Defined once in `training/shared/preprocessing.py` and mirrored in `src/ml/preprocess.ts`:

1. Decode; JPEGs use the **accurate integer DCT**, as browsers do (TF's fast default shifted borderline predictions by up to 0.17 in our parity test).
2. RGB, alpha dropped.
3. Resize the **whole image** to 224×224, bilinear, half-pixel centres, no crop.
4. Float32 in [0, 255]. Normalisation (`x / 127.5 − 1`) is a layer **inside** the model, so the browser can't apply the wrong one.

The browser does the bilinear resize on the CPU, which reads only 224×224×4 source pixels, instead of uploading a 12-megapixel camera frame to WebGL (which exceeds texture limits on many phones). Tests check it against Python's `tf.image.resize`, and an end-to-end check on the real model matched Python's outputs to 5 decimal places.

## Datasets

**Lemon:** *Large-Scale Lemon Leaf Disease and Pest Image Dataset from Bangladesh*, Mendeley Data, DOI [10.17632/8d9fv6kpt3.2](https://data.mendeley.com/datasets/8d9fv6kpt3/2), CC BY 4.0. Smartphone photos from four lemon-growing regions, labelled and reviewed by agricultural specialists.

**PlantVillage:** [spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset) (`raw/color`), 54,305 images, 38 classes, 14 crops. Hughes & Salathé, *An open access repository of images on plant health*, arXiv:1511.08060.

### Data validation (what we found and did)

<!-- DATA_VALIDATION -->

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

### Dataset benchmark ≠ field performance

All numbers above come from held-out images **from the same datasets**. The lemon photos come from Bangladeshi orchards; a lemon tree in California differs in cultivar, light, camera and background. **These numbers are not a claim about accuracy on your tree.** Use `training/field_test.py` on your own photos to see how the real pipeline behaves.

## Offline and privacy

- `vite-plugin-pwa` precaches the app shell, fonts, icons, both `model.json` files, **every weight shard by name** and both metadata files. `npm run build` fails if any model file is missing from the precache manifest (`scripts/verify-sw.mjs`).
- "AI READY OFFLINE" is shown only after both models have loaded, passed a self-test (shape, finite outputs, softmax sums to 1) **and** every shard is confirmed present in Cache Storage.
- No backend, no image upload, no analytics, no account. `?netlog=1` turns on a request logger for offline testing.

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
- Fonts (Barlow, Barlow Condensed, Space Grotesk, Chivo Mono): SIL Open Font License, self-hosted via Fontsource.
