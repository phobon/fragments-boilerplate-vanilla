import { Fn, float, vec3, Loop, mul, add, div } from 'three/tsl'
import { simplexNoise3d } from './simplex_noise_3d'

/**
 * Fractal Brownian Motion (FBM) using 3D simplex noise.
 * Combines multiple octaves of noise at different frequencies and amplitudes.
 * @param {vec3} p - Input 3D position.
 * @param {float} octaves - Number of noise octaves (default: 4.0).
 * @param {float} frequency - Base frequency (default: 1.0).
 * @param {float} amplitude - Base amplitude (default: 1.0).
 * @param {float} lacunarity - Frequency multiplier between octaves (default: 2.0).
 * @param {float} gain - Amplitude multiplier between octaves (default: 0.5).
 * @returns {float} FBM noise value.
 */
export const fbm = Fn(([p, octaves = 4.0, frequency = 1.0, amplitude = 1.0, lacunarity = 2.0, gain = 0.5]) => {
  const value = float(0.0).toVar()
  const currentAmplitude = float(amplitude).toVar()
  const currentFrequency = float(frequency).toVar()
  const maxValue = float(0.0).toVar()

  // @ts-ignore
  Loop({ start: 0.0, end: octaves, type: 'float' }, ({ i }) => {
    // Sample noise at current frequency
    const noiseValue = simplexNoise3d(mul(p, currentFrequency))

    // Add to accumulated value
    value.addAssign(mul(noiseValue, currentAmplitude))

    // Track maximum possible value for normalization
    maxValue.addAssign(currentAmplitude)

    // Update frequency and amplitude for next octave
    currentFrequency.mulAssign(lacunarity)
    currentAmplitude.mulAssign(gain)
  })

  // Normalize the result to [-1, 1] range
  return div(value, maxValue)
})

/**
 * Ridged FBM variant that creates sharp ridges.
 * @param {vec3} p - Input 3D position.
 * @param {float} octaves - Number of noise octaves (default: 4.0).
 * @param {float} frequency - Base frequency (default: 1.0).
 * @param {float} amplitude - Base amplitude (default: 1.0).
 * @param {float} lacunarity - Frequency multiplier between octaves (default: 2.0).
 * @param {float} gain - Amplitude multiplier between octaves (default: 0.5).
 * @returns {float} Ridged FBM noise value.
 */
export const ridgedFbm = Fn(([p, octaves = 4.0, frequency = 1.0, amplitude = 1.0, lacunarity = 2.0, gain = 0.5]) => {
  const value = float(0.0).toVar()
  const currentAmplitude = float(amplitude).toVar()
  const currentFrequency = float(frequency).toVar()
  const maxValue = float(0.0).toVar()

  // @ts-ignore
  Loop({ start: 0.0, end: octaves, type: 'float' }, ({ i }) => {
    // Sample noise and create ridges by taking absolute value and inverting
    const noiseValue = simplexNoise3d(mul(p, currentFrequency))
    const ridgedValue = float(1.0).sub(noiseValue.abs())

    // Square the ridged value to make ridges sharper
    const sharpRidges = ridgedValue.mul(ridgedValue)

    // Add to accumulated value
    value.addAssign(mul(sharpRidges, currentAmplitude))

    // Track maximum possible value for normalization
    maxValue.addAssign(currentAmplitude)

    // Update frequency and amplitude for next octave
    currentFrequency.mulAssign(lacunarity)
    currentAmplitude.mulAssign(gain)
  })

  // Normalize the result to [0, 1] range
  return div(value, maxValue)
})

/**
 * Domain warped FBM that uses FBM to warp the input coordinates.
 * @param {vec3} p - Input 3D position.
 * @param {float} octaves - Number of noise octaves (default: 4.0).
 * @param {float} frequency - Base frequency (default: 1.0).
 * @param {float} amplitude - Base amplitude (default: 1.0).
 * @param {float} lacunarity - Frequency multiplier between octaves (default: 2.0).
 * @param {float} gain - Amplitude multiplier between octaves (default: 0.5).
 * @param {float} warpStrength - Strength of domain warping (default: 0.1).
 * @returns {float} Domain warped FBM noise value.
 */
export const domainWarpedFbm = Fn(
  ([p, octaves = 4.0, frequency = 1.0, amplitude = 1.0, lacunarity = 2.0, gain = 0.5, warpStrength = 0.1]) => {
    // Create warping offset using FBM
    const warpOffset = vec3(
      fbm(p, octaves, frequency, amplitude, lacunarity, gain),
      fbm(add(p, vec3(100.0)), octaves, frequency, amplitude, lacunarity, gain),
      fbm(add(p, vec3(200.0)), octaves, frequency, amplitude, lacunarity, gain),
    )

    // Apply warping to input position
    const warpedP = add(p, mul(warpOffset, warpStrength))

    // Sample FBM at warped position
    return fbm(warpedP, octaves, frequency, amplitude, lacunarity, gain)
  },
)
