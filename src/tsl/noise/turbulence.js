import { Fn, sin, Loop, float, mat2 } from 'three/tsl'

/**
 * Turbulence noise function originally created by @XorDev
 * https://www.shadertoy.com/view/WclSWn
 */
export const turbulence = Fn(([p, _time, _num = 10.0, _amp = 0.7, _speed = 0.3, _freq = 2.0, _exp = 1.4]) => {
  // Turbulence starting scale
  const freq = float(_freq).toVar()
  const speed = float(_speed).toVar()
  const amp = float(_amp).toVar()

  // Turbulence rotation matrix
  const rot = mat2(0.6, -0.8, 0.8, 0.6).toVar()

  //Loop through turbulence octaves
  // @ts-ignore
  Loop({ start: 0.0, end: _num, type: 'float' }, ({ i }) => {
    //Scroll along the rotated y coordinate
    const phase = freq.mul(p.mul(rot).y).add(speed.mul(_time)).add(i)

    //Add a perpendicular sine wave offset
    p.addAssign(amp.mul(rot[0]).mul(sin(phase)).div(freq))

    //Rotate for the next octave
    rot.mulAssign(mat2(0.6, -0.8, 0.8, 0.6))

    //Scale down for the next octave
    freq.mulAssign(_exp)
  })

  return p
})
