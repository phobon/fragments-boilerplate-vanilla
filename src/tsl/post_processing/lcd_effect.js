import { Fn, fract, abs, pow, uniform, smoothstep, max, length, screenSize, vec2 } from 'three/tsl'
import { screenAspectUV } from '@/tsl/utils/function'
/**
 * Creates an LCD screen effect with configurable parameters.
 * @param {Object} props - The effect properties
 * @param {vec2} [props.resolution=screenSize] - The render resolution
 * @param {number} [props.scalar=10] - Controls the density of the LCD pattern
 * @param {number} [props.zoom=2.1] - Controls the size of individual LCD elements
 * @param {number} [props.exponent=1.8] - Controls the sharpness of the LCD pattern edges
 * @param {number} [props.edge=0.2] - Controls the threshold of the LCD pattern
 * @returns {float} The LCD effect pattern value
 */

export const lcdEffect = Fn((props) => {
  const { resolution = screenSize, scalar = 10, zoom = 2.1, exponent = 1.8, edge = 0.2 } = props || {}

  const _uv = screenAspectUV(resolution).toVar()

  const _zoom = uniform(zoom)
  const _exponent = uniform(exponent)
  const _edge = uniform(edge)
  const _scaledRes = resolution.div(scalar)

  _uv.assign(fract(_uv.mul(_scaledRes)).sub(0.5))
  // Diamond pattern
  // const pattern = abs(_uv.x.mul(_zoom))
  //   .add(abs(_uv.y.mul(_zoom)))
  //   .oneMinus()
  //   .toVar()

  // Square pattern
  // const pattern = max(abs(_uv.x.mul(_zoom)), abs(_uv.y.mul(_zoom)))
  //   .oneMinus()
  //   .toVar()

  // Circle pattern
  const pattern = length(_uv.mul(_zoom)).oneMinus().toVar()
  pattern.assign(smoothstep(_edge, 1, pattern))
  pattern.assign(pow(pattern, _exponent))

  return pattern
})
