import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "training"))
from shared.pipeline import Config  # noqa: E402

# Mendeley Data, DOI 10.17632/8d9fv6kpt3.2 — the user downloads the zip into data/lemon_raw
CFG = Config(
    name="lemon-v1",
    raw_dir=ROOT / "data" / "lemon_raw",
    work_dir=ROOT / "data" / "work_lemon",
    dataset_label="Large-Scale Lemon Leaf Disease and Pest Image Dataset from Bangladesh "
                  "(Mendeley Data, DOI 10.17632/8d9fv6kpt3.2)",
    license="CC BY 4.0",
    expected_classes=18,
    expected_images=17609,
    dihedral_groups=True,
    head_epochs=5,
    finetune_epochs=14,
)
FOCUS = ["Healthy", "Citrus Canker", "Greening", "Curl Leaf"]
MODEL_OUT = ROOT / "public" / "models" / "lemon-v1"
