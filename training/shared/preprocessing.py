"""Preprocessing contract shared by training and the browser.

THE CONTRACT (mirrored in src/ml/preprocess.ts and in metadata.json):
  1. Decode image (JPEG: accurate integer DCT, as browsers do), convert to
     3-channel RGB (alpha dropped, grayscale expanded).
  2. Center-crop to a square (side = shorter edge; offsets floor((W-s)/2),
     floor((H-s)/2)), then resize to 224x224 with bilinear interpolation.
     The crop removes aspect ratio as a cue: in the lemon dataset several
     classes come from a single camera format, so squashing whole images let
     resolution alone predict the class 24% of the time (chance 5.6%).
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
    "resize": "center square crop (floor offsets), then bilinear 224x224, half-pixel centers",
    "channelOrder": "RGB",
}


def load_image(path: tf.Tensor) -> tf.Tensor:
    raw = tf.io.read_file(path)
    # Browsers decode JPEG with the accurate integer DCT; TF defaults to the
    # fast one, which shifted borderline predictions by up to 0.17 in the
    # browser parity test. Match the browser.
    img = tf.cond(
        tf.io.is_jpeg(raw),
        lambda: tf.io.decode_jpeg(raw, channels=3, dct_method="INTEGER_ACCURATE"),
        lambda: tf.io.decode_image(raw, channels=3, expand_animations=False),
    )
    img.set_shape([None, None, 3])
    img = center_square(img)
    img = tf.image.resize(img, (IMG_SIZE, IMG_SIZE), method="bilinear")
    return tf.cast(img, tf.float32)  # [0,255]


def center_square(img: tf.Tensor) -> tf.Tensor:
    h, w = tf.shape(img)[0], tf.shape(img)[1]
    s = tf.minimum(h, w)
    return tf.image.crop_to_bounding_box(img, (h - s) // 2, (w - s) // 2, s, s)


def resize_tensor(img: tf.Tensor) -> tf.Tensor:
    img = center_square(img)
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
