import { Fn, uv, vec4 } from 'three/tsl'
import { contrast } from '../utils/color/adjustments/contrast'

/**
 * Contrast image adjustment (around mid-gray).
 * Post-processing wrapper around the color-in/color-out `contrast` adjustment
 * (utils/color/adjustments) so it can run as a PP chain layer.
 * @param {Object} props - Adjustment parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.amount=1] - Contrast; 1 = unchanged, 0 = flat gray, >1 more contrast.
 * @returns {vec4} The adjusted color (alpha passed through)
 */
export const contrastAdjustment = Fn((props) => {
  const { input, inputUV = uv, amount = 1 } = props || {}

  const _uv = inputUV().toVar()
  const color = input.sample(_uv)
  return vec4(contrast(color.rgb, amount), color.a)
})
