"""Stress-test a trained model on generated test data.

Builds perturbed copies of HELD-OUT test images (never used in training) to
mimic field conditions, plus synthetic out-of-distribution (OOD) inputs,
and measures accuracy, macro F1, and how the calibrated uncertainty
threshold behaves (coverage / precision of "confident" answers).

usage: python training/stress_test.py plantvillage [per_class]
"""
import csv
import json
import sys
from pathlib import Path

import setuptools  # noqa: F401  (provides distutils shim TF 2.16 needs)
import numpy as np
import tensorflow as tf
from sklearn.metrics import f1_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "training"))
from shared.preprocessing import load_image  # noqa: E402
from shared.seed import set_seed  # noqa: E402

name = sys.argv[1]
per_class = int(sys.argv[2]) if len(sys.argv) > 2 else 20
work = ROOT / "data" / f"work_{name}"
meta_dir = {"plantvillage": "plantvillage-v1", "lemon": "lemon-v1"}[name]
meta = json.load(open(ROOT / "public" / "models" / meta_dir / "metadata.json"))
T = meta["thresholds"]
classes = meta["classes"]

set_seed()
rng = np.random.default_rng(7)
rows = [r for r in csv.DictReader(open(work / "splits.csv")) if r["split"] == "test"]
by = {}
for r in rows:
    by.setdefault(r["label"], []).append(r)
sample = [r for c in classes for r in rng.permutation(by[c])[:per_class].tolist()]
paths = [r["path"] for r in sample]
y = np.array([int(r["label_idx"]) for r in sample])
print(f"{len(sample)} held-out images, {per_class}/class", flush=True)

model = tf.keras.models.load_model(str(work / "checkpoints" / "best.keras"))
base = np.stack([load_image(tf.constant(p)).numpy() for p in paths])  # [N,224,224,3] 0..255


def texture(n):  # cluttered background: blurred colour noise (soil/mulch/foliage-ish)
    t = rng.uniform(0, 255, (n, 28, 28, 3)).astype(np.float32)
    t[..., 1] *= rng.uniform(0.6, 1.1, (n, 1, 1))
    return tf.image.resize(t, (224, 224), "bicubic").numpy().clip(0, 255)


def jpeg(x, q):
    return np.stack([tf.cast(tf.io.decode_jpeg(tf.io.encode_jpeg(tf.cast(i, tf.uint8), quality=q)), tf.float32)
                     .numpy() for i in x])


def motion_blur(x, k=9):
    ker = np.zeros((k, k, 3, 1), np.float32)
    ker[k // 2, :, :, 0] = 1 / k
    return tf.nn.depthwise_conv2d(x, ker, [1, 1, 1, 1], "SAME").numpy()


def gauss_blur(x, s=2.5):
    r = int(3 * s)
    g = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * s * s))
    g /= g.sum()
    k = np.outer(g, g)[:, :, None, None].repeat(3, 2).astype(np.float32)
    return tf.nn.depthwise_conv2d(x, k, [1, 1, 1, 1], "SAME").numpy()


def shrink_on_clutter(x, scale):  # leaf further away, surrounded by clutter
    s = int(224 * scale)
    small = tf.image.resize(x, (s, s)).numpy()
    out = texture(len(x))
    o = (224 - s) // 2
    out[:, o:o + s, o:o + s] = small
    return out


def lowres(x, r=48):
    return tf.image.resize(tf.image.resize(x, (r, r), "area"), (224, 224), "bilinear").numpy()


def warm_shift(x):  # golden-hour / tungsten white balance
    return (x * np.array([1.18, 1.0, 0.78], np.float32)).clip(0, 255)


def rotate90(x):
    return np.rot90(x, 1, axes=(1, 2)).copy()


def occlude(x):  # finger/shadow covering a corner
    x = x.copy()
    x[:, :90, :90] *= 0.15
    return x


def noise(x, sd=18):
    return (x + rng.normal(0, sd, x.shape)).clip(0, 255).astype(np.float32)


PERTURB = {
    "clean": lambda x: x,
    "dim light (x0.45)": lambda x: x * 0.45,
    "overexposed (x1.6)": lambda x: (x * 1.6).clip(0, 255),
    "warm white balance": warm_shift,
    "gaussian blur": gauss_blur,
    "motion blur": motion_blur,
    "sensor noise": noise,
    "jpeg q=20": lambda x: jpeg(x, 20),
    "low resolution (48px)": lowres,
    "rotated 90°": rotate90,
    "corner occluded/shadow": occlude,
    "leaf far away on clutter (55%)": lambda x: shrink_on_clutter(x, 0.55),
}


def summarize(probs, y_true):
    pred = probs.argmax(1)
    srt = np.sort(probs, 1)
    conf = (srt[:, -1] >= T["confidence"]) & (srt[:, -1] - srt[:, -2] >= T["margin"])
    corr = pred == y_true
    return {
        "accuracy": float(corr.mean()),
        "macroF1": float(f1_score(y_true, pred, average="macro", zero_division=0)),
        "confidentCoverage": float(conf.mean()),
        "confidentPrecision": float(corr[conf].mean()) if conf.any() else None,
        "confidentWrongRate": float((conf & ~corr).mean()),  # the dangerous case
    }


results = {}
for pname, fn in PERTURB.items():
    x = fn(base).astype(np.float32)
    probs = model.predict(x, batch_size=64, verbose=0)
    results[pname] = summarize(probs, y)
    r = results[pname]
    print(f"{pname:34s} acc {r['accuracy']:.3f}  F1 {r['macroF1']:.3f}  "
          f"confident {r['confidentCoverage']:.2f}  prec|conf {r['confidentPrecision'] or 0:.3f}  "
          f"confident-wrong {r['confidentWrongRate']:.3f}", flush=True)

# --- out-of-distribution: nothing here is a supported leaf
n = 200
ood = {
    "uniform colour": np.repeat(np.repeat(rng.uniform(0, 255, (n, 1, 1, 3)), 224, 1), 224, 2),
    "random noise": rng.uniform(0, 255, (n, 224, 224, 3)),
    "clutter texture only": texture(n),
    "gradients": np.stack([np.dstack([np.linspace(a, b, 224)[None].repeat(224, 0) for a, b in
                                      rng.uniform(0, 255, (3, 2))]) for _ in range(n)]),
}
ood_res = {}
for oname, x in ood.items():
    probs = model.predict(x.astype(np.float32), batch_size=64, verbose=0)
    srt = np.sort(probs, 1)
    conf = (srt[:, -1] >= T["confidence"]) & (srt[:, -1] - srt[:, -2] >= T["margin"])
    top = np.bincount(probs.argmax(1), minlength=len(classes))
    ood_res[oname] = {"flaggedUncertain": float(1 - conf.mean()),
                      "falseConfidentRate": float(conf.mean()),
                      "mostCommonPrediction": classes[int(top.argmax())]}
    print(f"OOD {oname:24s} flagged uncertain {1 - conf.mean():.2f}   "
          f"(most common guess: {classes[int(top.argmax())]})", flush=True)

out = {"model": meta["modelVersion"], "thresholds": T, "images": len(sample),
       "perturbations": results, "ood": ood_res,
       "note": "Generated stress data from held-out test images; not a substitute for real field photos."}
json.dump(out, open(work / "stress_test.json", "w"), indent=2)
print("saved", work / "stress_test.json")

# --- dump 100 downscaled (160px, as checkQuality does) RGBA samples per set for the TS quality gate
gate_dir = work / "gate_samples"
gate_dir.mkdir(exist_ok=True)
sets = {k: fn(base[:: max(1, len(base) // 100)][:100]) for k, fn in PERTURB.items()}
sets.update({f"OOD {k}": v[:100] for k, v in ood.items()})
index = {}
for i, (k, x) in enumerate(sets.items()):
    s = tf.image.resize(np.asarray(x, np.float32), (160, 160), "area").numpy().clip(0, 255).astype(np.uint8)
    rgba = np.concatenate([s, np.full(s.shape[:3] + (1,), 255, np.uint8)], -1)
    rgba.tofile(gate_dir / f"{i}.bin")
    index[k] = {"file": f"{i}.bin", "n": len(s)}
json.dump(index, open(gate_dir / "index.json", "w"))
print("gate samples written")
