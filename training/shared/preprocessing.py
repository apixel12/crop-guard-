"""Preprocessing contract shared by training and the browser.

THE CONTRACT (mirrored in src/ml/preprocess.ts and in metadata.json):
  1. Decode image, convert to 3-channel RGB (alpha dropped, grayscale expanded).
  2. Resize the WHOLE image to 224x224 with bilinear interpolation
     (no center crop, aspect ratio not preserved).
  3. Feed float32 pixels in [0, 255], shape [1, 224, 224, 3], channel order RGB.
  4. Normalization (pixel / 127.5 - 1) is a layer INSIDE the exported model,
     so the browser never applies it itself.
"""
import tensorflow as tf

IMG_SIZE = 224

NORMALIZATION = {
    "inputRange": [0, 255],
    "inModel": True,
    "formula": "pixel / 127.5 - 1",
    "resize": "bilinear, full image, no crop, aspect not preserved",
    "channelOrder": "RGB",
}


def load_image(path: tf.Tensor) -> tf.Tensor:
    raw = tf.io.read_file(path)
    img = tf.io.decode_image(raw, channels=3, expand_animations=False)
    img = tf.image.resize(img, (IMG_SIZE, IMG_SIZE), method="bilinear")
    return tf.cast(img, tf.float32)  # [0,255]


def resize_tensor(img: tf.Tensor) -> tf.Tensor:
    img = tf.image.resize(img, (IMG_SIZE, IMG_SIZE), method="bilinear")
    return tf.cast(img, tf.float32)


def augmenter() -> tf.keras.Sequential:
    """Mild, morphology-preserving augmentations (train split only)."""
    L = tf.keras.layers
    return tf.keras.Sequential(
        [
            L.RandomFlip("horizontal"),
            L.RandomRotation(0.06),  # ~±20 degrees
            L.RandomZoom((-0.1, 0.1)),
            L.RandomTranslation(0.06, 0.06),
            L.RandomBrightness(0.12, value_range=(0, 255)),
            L.RandomContrast(0.12),
        ],
        name="augment",
    )
