import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "training"))
from shared.pipeline import Config  # noqa: E402

# One disease model for every non-lemon crop: garden crops + field crops.
CFG = Config(
    name="crops-v2",
    raw_dir=ROOT / "data" / "work_crops",  # built by build_dataset.py
    work_dir=ROOT / "data" / "work_crops",
    dataset_label="PlantVillage + PlantDoc + iBean + iCassava + Sethy rice + RiceLeafBD + JIC wheat + cotton (severity, SAR-CLD-2024) + sugarcane (Daphal & Koli)",
    license="PlantVillage CC BY-SA 3.0; others CC BY 4.0 / MIT (see DATA_SOURCES.md); model released CC BY-SA 3.0",
    expected_classes=68,
    head_epochs=2,
    finetune_epochs=8,
    unfreeze_from=40,
    finetune_lr=5e-5,
    finetune_patience=3,
    robust_level="full",
    # warm start: the 41 garden classes keep what they already learned
    init_from=ROOT / "data" / "work_garden" / "checkpoints" / "best.keras",
    init_classes=json.load(open(ROOT / "public" / "models" / "garden-v1" / "metadata.json"))["classes"],
)
MODEL_OUT = ROOT / "public" / "models" / "crops-v2"
