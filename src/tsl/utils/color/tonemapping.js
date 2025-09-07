import { Fn, vec3, pow, float, mix, smoothstep, exp, div } from 'three/tsl'

/**
 * Applies Reinhard tonemapping to a color vector.
 * @param {vec3} _color Input color vector
 * @returns {vec3} Tonemapped color
 */
export const reinhardTonemap = Fn(([_color]) => {
  return _color.div(_color.add(1.0))
})

/**
 * Applies Uncharted2 filmic tonemapping to a color vector.
 * @param {vec3} _color Input color vector
 * @returns {vec3} Tonemapped color
 */
export const uncharted2Tonemap = Fn(([_color]) => {
  // Constants from Uncharted2 tonemapping
  const A = float(0.15)
  const B = float(0.5)
  const C = float(0.1)
  const D = float(0.2)
  const E = float(0.02)
  const F = float(0.3)
  return _color
    .mul(A)
    .add(_color.mul(_color).mul(B))
    .div(_color.mul(_color).mul(C).add(_color.mul(D)).add(E))
    .sub(F.div(E))
})

/**
 * Applies ACES tonemapping to a color vector.
 * @param {vec3} _color Input color vector
 * @returns {vec3} Tonemapped color
 */
export const acesTonemap = Fn(([_color]) => {
  const a = 2.51
  const b = 0.03
  const c = 2.43
  const d = 0.59
  const e = 0.14
  return _color
    .mul(a)
    .add(b)
    .div(_color.mul(c).add(_color.mul(d)).add(e))
    .clamp(0.0, 1.0)
})

/**
 * Applies a cross-process tonemapping effect to a color vector.
 * Exaggerates blue, shifts red/green for a stylized look.
 * @param {vec3} _color Input color vector
 * @returns {vec3} Tonemapped color
 */
export const crossProcessTonemap = Fn(([_color]) => {
  // Exaggerate blue, shift red/green
  const r = pow(_color.x, 0.8)
  const g = pow(_color.y, 1.2)
  const b = pow(_color.z, 1.5)
  return vec3(r, g, b).clamp(0.0, 1.0)
})

/**
 * Applies a bleach bypass tonemapping effect to a color vector.
 * Increases contrast and desaturates for a cinematic look.
 * @param {vec3} _color Input color vector
 * @returns {vec3} Tonemapped color
 */
export const bleachBypassTonemap = Fn(([_color]) => {
  const lum = _color.dot(vec3(0.2126, 0.7152, 0.0722))
  const mixAmt = 0.7
  return mix(vec3(lum), _color, mixAmt).mul(1.2).clamp(0.0, 1.0)
})

/**
 * Applies a Technicolor-inspired tonemapping effect to a color vector.
 * Splits and recombines channels for a retro look.
 * @param {vec3} _color Input color vector
 * @returns {vec3} Tonemapped color
 */
export const technicolorTonemap = Fn(([_color]) => {
  // Split and recombine channels for a retro look
  const r = _color.x.mul(1.5)
  const g = _color.y.mul(1.2)
  const b = _color.z.mul(0.8).add(_color.x.mul(0.2))
  return vec3(r, g, b).clamp(0.0, 1.0)
})

/**
 * Applies a cinematic S-curve tonemapping effect to a color vector.
 * Adds contrast and a slight color shift.
 * @param {vec3} _color Input color vector
 * @returns {vec3} Tonemapped color
 */
export const cinematicTonemap = Fn(([_color]) => {
  // S-curve for contrast, slight color shift
  const r = smoothstep(0.05, 0.95, _color.x.mul(0.95).add(0.02))
  const g = smoothstep(0.05, 0.95, _color.y.mul(1.05))
  const b = smoothstep(0.05, 0.95, _color.z.mul(1.1))
  return vec3(r, g, b).clamp(0.0, 1.0)
})

/**
 * Fast approximation of hyperbolic tangent using exponentials.
 * @param {float} val Input value
 * @returns {float} Approximated tanh(val) value between -1 and 1
 */
export const tanh = Fn(([val]) => {
  const tmp = exp(val).toVar()
  const tanH = tmp.sub(div(1.0, tmp)).div(tmp.add(div(1.0, tmp)))
  return tanH
})

/**
 * Fast approximation of hyperbolic sine using exponentials.
 * @param {float} val Input value
 * @returns {float} Approximated sinh(val) value
 */
export const sinh = Fn(([val]) => {
  const tmp = exp(val).toVar()
  const sinH = tmp.sub(div(1.0, tmp)).div(2.0)
  return sinH
})

/**
 * Fast approximation of hyperbolic cosine using exponentials.
 * @param {float} val Input value
 * @returns {float} Approximated cosh(val) value
 */
export const cosh = Fn(([val]) => {
  const tmp = exp(val).toVar()
  const cosH = tmp.add(div(1.0, tmp)).div(2.0)
  return cosH
})
