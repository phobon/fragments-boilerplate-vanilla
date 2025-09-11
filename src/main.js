import './index.css'

import {
  WebGPURenderer,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Scene,
  Mesh,
  OrthographicCamera,
  DoubleSide,
  NoToneMapping,
  LinearSRGBColorSpace,
} from 'three/webgpu'
import Router from './router.js'
import { uniform, vec3 } from 'three/tsl'

// Canvas
const canvas = document.querySelector('#webgpu-canvas')

const scene = new Scene()

// Sketch geometry
const smokeGeometry = new PlaneGeometry(1, 1, 1, 1)

// Sketch material
const sketchMaterial = new MeshBasicNodeMaterial({
  transparent: true,
  side: DoubleSide,
  depthWrite: false,
})

// Current sketch
let currentSketch = null

// Function to dynamically load and switch sketches
async function switchSketch(sketchName) {
  try {
    // Dynamic import based on sketch name
    const sketchModule = await import(`@/sketches/${sketchName}.js`)

    // Get the sketch function (assuming it's the default export or named export with same name)
    const sketchFunction = sketchModule[sketchName] || sketchModule.default
    sketchMaterial.colorNode = sketchFunction()
    sketchMaterial.needsUpdate = true

    if (sketchFunction) {
      currentSketch = sketchName
      console.log(`Switched to sketch: ${sketchName}`)
    } else {
      console.warn(`Sketch function not found in module: ${sketchName}`)
    }
  } catch (error) {
    console.error(`Failed to load sketch: ${sketchName}`, error)
  }
}

// Add a fullscreeen sketch plane to the scene
const sketch = new Mesh(smokeGeometry, sketchMaterial)
sketch.scale.set(2, 2, 1)
scene.add(sketch)

// Initialize app
async function init() {
  // Initialize with default sketch
  // await switchSketch('dawn-1')

  // Viewport sizes
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  window.addEventListener('resize', () => {
    // Update sizes
    viewport.width = window.innerWidth
    viewport.height = window.innerHeight

    // Update camera
    camera.aspect = viewport.width / viewport.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(viewport.width, viewport.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  })

  // Camera
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.z = 1
  scene.add(camera)

  // Renderer
  const renderer = new WebGPURenderer({
    canvas: canvas,
    antialias: true,
    toneMapping: NoToneMapping,
    outputColorSpace: LinearSRGBColorSpace,
  })
  renderer.setSize(viewport.width, viewport.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor('#000000')

  const frame = () => {
    renderer.renderAsync(scene, camera)
    window.requestAnimationFrame(frame)
  }

  // Initialize router with automatic route handling
  const router = new Router((path) => {
    // Handle different route patterns
    if (path === '/' || path === '') {
      switchSketch('dawn-1')
    } else if (path.startsWith('/sketches/')) {
      const sketchName = path.split('/sketches/')[1]
      if (sketchName) {
        switchSketch(sketchName)
      }
    } else {
      // Try to load sketch directly by name
      switchSketch(path.slice(1)) // Remove leading slash
    }
  })

  // Start rendering
  frame()
}

// Start the app
init()
