import { abs, float, Fn } from 'three/tsl'
import { repeatingPattern } from './repeating_pattern'
import { bloom } from './bloom'

/**
 * Returns a repeating pattern of lines with a bloom effect.
 * @param {float} pattern - The input pattern value.
 * @param {float} repeat - The repeat frequency.
 * @param {float} edge - The edge value.
 * @param {float} exponent - The bloom exponent.
 * @param {float} [_time=0] - The time offset.
 * @returns {float} The bloomed repeating pattern value.
 */
export const bloomEdgePattern = Fn(([pattern, repeat, edge, exponent, _time = float(0)]) => {
  pattern.assign(repeatingPattern(pattern, repeat, _time))
  pattern.assign(abs(pattern))
  pattern.assign(bloom(pattern, edge, exponent))

  return pattern
})
