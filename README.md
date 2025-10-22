# Fragments° Boilerplate Project

A companion boilerplate project for [Fragments](https://fragments.supply). This project can be used as a starting point for your own creative coding projects and experiments.

## Tech Stack

Built on the following technology:

- [Vite](https://vite.dev/)
- [ThreeJS](https://threejs.org/)

## How to run the project

```
pnpm i
pnpm dev
```

## Quick Start

The quickest way to get started is to add a new sketch to the `src/sketches` directory.

Then import this into your `main.js` file and set the `colorNode` of the `MeshBasicNodeMaterial` to the sketch function. The kicker here the `sketchMaterial.colorNode = yourSketchFn()`.

```js
// Sketch material
const sketchMaterial = new MeshBasicNodeMaterial({
  transparent: true,
  side: DoubleSide,
  depthWrite: false,
})

// Add your sketch here using TSL
sketchMaterial.colorNode = dawn1()
```

## Project Structure

```
src/
├── components/
│   ├── sketch/
│   │   └── webgpu_sketch.js
│   └── sketches_dropdown/
│       ├── index.css
│       └── sketches_dropdown.js
├── sketches/
│   ├── flare-1.js
│   └── noise/
│       └── dawn-1.js
├── tsl/
│   ├── effects/
│   │   ├── canvas_weave_effect.js
│   │   ├── grain_texture_effect.js
│   │   ├── led_effect.js
│   │   ├── pixellation_effect.js
│   │   ├── speckled_noise_effect.js
│   │   └── vignette_effect.js
│   ├── noise/
│   │   ├── common.js
│   │   ├── curl_noise_3d.js
│   │   ├── curl_noise_4d.js
│   │   ├── fbm.js
│   │   ├── perlin_noise_3d.js
│   │   ├── simplex_noise_3d.js
│   │   ├── simplex_noise_4d.js
│   │   └── turbulence.js
│   ├── post_processing/
│   │   ├── chromatic_aberration_effect.js
│   │   ├── crt_scanline_effect.js
│   │   ├── dither_effect.js
│   │   ├── grain_texture_effect.js
│   │   ├── halftone_effect.js
│   │   ├── led_effect.js
│   │   ├── pixellation_effect.js
│   │   └── vignette_effect.js
│   └── utils/
│       ├── color/
│       │   ├── cosine_palette.js
│       │   └── tonemapping.js
│       ├── function/
│       │   ├── bloom.js
│       │   ├── bloom_edge_pattern.js
│       │   ├── domain_index.js
│       │   ├── median3.js
│       │   ├── repeating_pattern.js
│       │   └── screen_aspect_uv.js
│       ├── lighting.js
│       ├── math/
│       │   ├── complex.js
│       │   └── coordinates.js
│       └── sdf/
│           ├── operations.js
│           └── shapes.js
├── utils/
│   └── math.js
├── index.css
├── main.js
└── router.js
```
