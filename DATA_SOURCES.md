# Data sources, credits and licences

CropGuard's models were trained on public datasets created by other people.
None of the images were collected by this project. This file credits them in
full, states their licences, and says exactly what we did with them.

The raw images are **not** re-hosted here (about 4.5 GB in total). Download
them from the original sources below; the files in `data_manifests/` list
exactly which images were used in which split, so the work can be reproduced
and checked against the originals.

## 1. Lemon leaves

- **Title:** Large-Scale Lemon Leaf Disease and Pest Image Dataset from Bangladesh (version 2)
- **Publisher:** Mendeley Data. Authors as listed on the dataset page.
- **DOI / link:** [10.17632/8d9fv6kpt3.2](https://data.mendeley.com/datasets/8d9fv6kpt3/2)
- **Licence:** CC BY 4.0
- **Used for:** the lemon disease model (`lemon-v1`) and the "Lemon" class of the plant-identification model (`router-v1`).
- **What we changed:**
  - We removed 2,645 byte-identical duplicate images.
  - We dropped 43 images that appeared under two different labels.
  - We grouped near-duplicates so no group spans train and test.
  - We center-cropped images to squares and resized them to 224×224 for training.
  - Class names are the dataset's own.

## 2. PlantVillage (garden crops)

- **Citation:** Hughes, D. P., & Salathé, M. (2015). *An open access repository of images on plant health to enable the development of mobile disease diagnostics.* arXiv:1511.08060.
- **Related:** Mohanty, S. P., Hughes, D. P., & Salathé, M. (2016). *Using deep learning for image-based plant disease detection.* Frontiers in Plant Science, 7, 1419.
- **Link:** [github.com/spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset) (`raw/color`)
- **Licence:** CC BY-SA 3.0 (as stated on the repository's dataset card)
- **Used for:** the garden disease model (`garden-v1`) and the garden-crop classes of `router-v1`.
- **What we changed:** we removed 21 exact duplicates, used grouped stratified splits, and resized images to 224×224.
- **Share-alike:** because PlantVillage is share-alike, we release the models trained on it (`public/models/garden-v1`, `public/models/router-v1`) under **CC BY-SA 3.0** as well, with this attribution.

## 3. iBean (beans)

- **Creators:** Makerere AI Lab, with annotation by experts from Uganda's National Crops Resources Research Institute (NaCRRI)
- **Links:** [github.com/AI-Lab-Makerere/ibean](https://github.com/AI-Lab-Makerere/ibean) · [huggingface.co/datasets/AI-Lab-Makerere/beans](https://huggingface.co/datasets/AI-Lab-Makerere/beans)
- **Licence:** MIT
- **Used for:** the three bean classes of `garden-v1` and the "Bean" class of `router-v1`. The official train/validation/test split was kept.

## Methods and other work we relied on

- **MobileNetV2:** Sandler, M., Howard, A., Zhu, M., Zhmoginov, A., & Chen, L.-C. (2018). *MobileNetV2: Inverted Residuals and Linear Bottlenecks.* CVPR. ImageNet-pretrained weights via Keras Applications.
- **Outlier exposure:** Hendrycks, D., Mazeika, M., & Dietterich, T. (2019). *Deep Anomaly Detection with Outlier Exposure.* ICLR.
- **Logit adjustment:** Menon, A. K., et al. (2021). *Long-tail learning via logit adjustment.* ICLR.
- **Which crops to support:** National Gardening Association survey of the most-grown home vegetables.
- **Not used:** cucumber datasets (augmented copies were mixed with the originals) and PlantDoc (download did not complete). See the README.

## Data manifests

`data_manifests/*.csv.gz` (gzip-compressed CSV) list every image used, one row each: `file, label, split, source`.

| File | What it covers |
|---|---|
| `lemon_splits.csv.gz` | lemon model: 14,898 unique images |
| `garden_splits.csv.gz` | garden model: 55,579 images (PlantVillage + iBean) |
| `plant_identification_splits.csv.gz` | plant-identification model: 40,500 images |

Paths are relative to each dataset's own folder layout (`lemon/…`, `plantvillage/raw/color/…`, `ibean/…`).
