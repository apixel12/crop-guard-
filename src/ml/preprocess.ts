import * as tf from '@tensorflow/tfjs-core'

/**
 * Mirrors training/shared/preprocessing.py exactly:
 *  - RGB (fromPixels with 3 channels drops alpha)
 *  - whole image resized to 224x224, bilinear, half-pixel centers
 *    (= tf.image.resize(method="bilinear") in TF2), no crop
 *  - float32 in [0, 255]; normalization (x/127.5 - 1) lives inside the model
 */
export const INPUT_SIZE = 224

export function toInputTensor(
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement | ImageData,
  size = INPUT_SIZE,
): tf.Tensor4D {
  return tf.tidy(() => {
    const px = tf.browser.fromPixels(source, 3) // int32 [h,w,3] RGB
    const resized = tf.image.resizeBilinear(tf.cast(px, 'float32'), [size, size], false, true)
    return tf.expandDims(tf.clipByValue(resized, 0, 255), 0) as tf.Tensor4D
  })
}
