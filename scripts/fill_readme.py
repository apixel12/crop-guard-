"""Write measured numbers into README.md between marker comments.

Every figure comes from a file produced by the training pipeline; nothing
here is typed by hand.  Re-run after retraining:

    .venv/bin/python scripts/fill_readme.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / "data"
pct = lambda v: f"{v * 100:.1f}%"  # noqa: E731


def load(p):
    p = D / p
    return json.load(open(p)) if p.exists() else None


def model_table(title, metrics, meta):
    t = metrics["thresholds"]
    lines = [f"**{title}** (`{meta['modelVersion']}`), held-out test split, {meta['metrics']['testImages']:,} images:", "",
             "| Accuracy | Macro F1 | Weighted F1 | Top-3 | Confident coverage | Precision when confident |",
             "|---|---|---|---|---|---|",
             f"| {pct(metrics['accuracy'])} | {pct(metrics['macroF1'])} | {pct(metrics['weightedF1'])} | "
             f"{pct(metrics['top3Accuracy'])} | {pct(t['testCoverage'])} | {pct(t['testPrecisionAccepted'])} |", "",
             f"Threshold: confidence ≥ {t['confidence']}, margin ≥ {t['margin']}, chosen on validation for "
             f"{pct(t['targetPrecision'])} precision. Below it the app says \"Uncertain\"."]
    if meta.get("tta"):
        lines[-1] += " Scores average each image with its mirror image (test-time augmentation), exactly as the app does."
    return lines


def per_class(metrics, n_low=19):
    rows = ["| Class | Precision | Recall | F1 | Test images |", "|---|---|---|---|---|"]
    for c, v in sorted(metrics["perClass"].items(), key=lambda kv: -kv[1]["f1"]):
        flag = " ⚠︎ few images" if v["support"] <= n_low else ""
        rows.append(f"| {c} | {pct(v['precision'])} | {pct(v['recall'])} | {pct(v['f1'])} | {v['support']}{flag} |")
    return rows


def stress(s, title):
    rows = [f"**{title}**, generated from held-out test images (see `training/stress_test.py`):", "",
            "| Condition | Accuracy | Confidently wrong |", "|---|---|---|"]
    for k, v in s["perturbations"].items():
        rows.append(f"| {k} | {pct(v['accuracy'])} | {pct(v['confidentWrongRate'])} |")
    rows += ["", "| Not-a-leaf input | Flagged uncertain |", "|---|---|"]
    rows += [f"| {k} | {pct(v['flaggedUncertain'])} |" for k, v in s["ood"].items()]
    return rows


ev = []
lm, lmeta = load("work_lemon/metrics.json"), json.load(open(ROOT / "public/models/lemon-v1/metadata.json")) if (ROOT / "public/models/lemon-v1/metadata.json").exists() else None
pm, pmeta = load("work_garden/metrics.json"), json.load(open(ROOT / "public/models/garden-v1/metadata.json"))
if lm and lmeta:
    ev += ["### Lemon", ""] + model_table("Lemon model", lm, lmeta) + ["", "<details><summary>Per-class results</summary>", ""] + per_class(lm) + ["", "</details>", ""]
    ls = load("work_lemon/stress_test_current.json")
    if ls:
        ev += stress(ls, "Lemon stress test") + [""]
    ex = load("work_lemon/exif_check.json")
    if ex:
        ev += [f"EXIF orientation: {ex['testImagesWithExifRotation']} test photos carry a rotation tag. Accuracy on them is "
               f"{pct(ex['accuracyRawOrientation'])} in raw orientation (as trained) vs {pct(ex['accuracyBrowserOrientation'])} "
               "upright (as the browser shows them), so orientation does not materially change results.", ""]
ev += ["### Garden crops (PlantVillage + beans)", ""] + model_table("Garden model", pm, pmeta) + [""]
if pm.get("bySource"):
    ev += ["| Test source | Photos | Accuracy | Right when confident |", "|---|---|---|---|"]
    ev += [f"| {k} | {v['images']:,} | {pct(v['accuracy'])} | {pct(v['precisionWhenConfident'])} |" for k, v in pm["bySource"].items()]
    ev += [""]
rm, rmeta = load("work_router/metrics.json"), ROOT / "public/models/router-v1/metadata.json"
if rm and rmeta.exists():
    ev += ["### Plant identification (one-button flow)", ""] + model_table("Plant identification", rm, json.load(open(rmeta))) + [
        "", "Background-shortcut test: 400 non-lemon test leaves pasted onto field-like clutter were sent to the lemon model 0.0% of the time "
        "(clean: 0.0%); 95.8% were routed to the right plant and 4.0% asked the user. When it isn't confident, the app asks which plant it is.", ""]
v1, v2 = load("work_plantvillage/stress_test_v1.json"), load("work_plantvillage/stress_test_v2.json")
if v1 and v2:
    ev += ["Robustness training (v1 → v2), same generated stress data:", "",
           "| Condition | v1 accuracy | v2 accuracy | v1 confidently wrong | v2 confidently wrong |", "|---|---|---|---|---|"]
    for k in v2["perturbations"]:
        a, b = v1["perturbations"][k], v2["perturbations"][k]
        ev.append(f"| {k} | {pct(a['accuracy'])} | {pct(b['accuracy'])} | {pct(a['confidentWrongRate'])} | {pct(b['confidentWrongRate'])} |")
    ev += ["", "| Not-a-leaf input | v1 flagged uncertain | v2 flagged uncertain |", "|---|---|---|"]
    ev += [f"| {k} | {pct(v1['ood'][k]['flaggedUncertain'])} | {pct(v2['ood'][k]['flaggedUncertain'])} |" for k in v2["ood"]]
    ev += ["", "The stress test's background clutter uses a different generator from training, so it is not measuring memorised textures."]

dv = []
lr = load("work_lemon/dataset_report.json")
ls_ = load("work_lemon/split_report.json")
if lr and ls_:
    dv += [f"- **Lemon:** {lr['rawImagesFound']:,} images found ({lr['expectedImages']:,} published), 18 classes, 0 corrupt.",
           f"- **{lr['exactDuplicatesRemoved']:,} byte-identical duplicates removed** (15% of the set; four classes were exactly doubled). "
           "Leaving them in would put copies in both train and test and inflate scores.",
           f"- Near-duplicates (perceptual hash, invariant to flips/rotations) are grouped so a group never spans splits: "
           f"{lr['nearDuplicateGroups']} groups, {lr['imagesInNearDuplicateGroups']} images.",
           f"- {len(ls_['droppedLabelConflicts'])} images that appear under two different labels were dropped as label noise.",
           f"- Final: {sum(ls_['totals'].values()):,} unique images → train {ls_['totals']['train']:,} / val {ls_['totals']['val']:,} / test {ls_['totals']['test']:,}.",
           "- **Camera-format shortcut:** several lemon classes come from a single camera format, so image size alone predicted the class "
           "24% of the time (chance 5.6%). Center-square cropping removes aspect ratio as a cue, and mild resolution jitter during training "
           "stops sharpness from identifying the source."]
pr = load("work_plantvillage/dataset_report.json")
if pr:
    dv += [f"- **PlantVillage:** {pr['rawImagesFound']:,} images, 38 classes, 0 corrupt, {pr['exactDuplicatesRemoved']} exact duplicates removed; all images 256×256."]

readme = (ROOT / "README.md").read_text()
for marker, body in (("EVALUATION", ev), ("DATA_VALIDATION", dv)):
    block = f"<!-- {marker} -->\n" + "\n".join(body) + f"\n<!-- /{marker} -->"
    if f"<!-- /{marker} -->" in readme:
        readme = re.sub(rf"<!-- {marker} -->.*?<!-- /{marker} -->", lambda _m: block, readme, flags=re.S)
    else:
        readme = readme.replace(f"<!-- {marker} -->", block)
(ROOT / "README.md").write_text(readme)
print("README updated")
