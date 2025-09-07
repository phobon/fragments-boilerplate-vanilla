import { Fn, pow } from 'three/tsl'

/**
 * Returns a bloomed edge based on a given edge and pattern.
 * @param {float} pattern - The input pattern value.
 * @param {float} edge - The edge value.
 * @param {float} exponent - The bloom exponent.
 * @returns {float} The bloomed edge value.
 */
export const bloom = Fn(([pattern, edge, exponent]) => {
  pattern.assign(pow(edge.div(pattern), exponent))
  return pattern
})
