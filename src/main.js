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
import dawn1 from './sketches/noise/dawn-1.js'

// Canvas
const canvas = document.querySelector('#webgpu-canvas')

const scene = new Scene()

// Sketch geometry
const sketchGeometry = new PlaneGeometry(1, 1, 1, 1)

// Sketch material
const sketchMaterial = new MeshBasicNodeMaterial({
  transparent: true,
  side: DoubleSide,
  depthWrite: false,
})
sketchMaterial.colorNode = dawn1()

// Preload all sketches using import.meta.glob
const sketches = import.meta.glob('./sketches/**/*.js', { eager: true })

// Current sketch
let currentSketch = null

// Function to switch sketches using preloaded modules
function switchSketch(sketchName) {
  try {
    // Find the sketch module by path
    const sketchPath = `./sketches/${sketchName}.js`
    const sketchModule = sketches[sketchPath]

    if (sketchModule) {
      // Get the sketch function (default export or named export with same name)
      const sketchFunction = sketchModule[sketchName] || sketchModule.default

      if (sketchFunction) {
        sketchMaterial.colorNode = sketchFunction()
        sketchMaterial.needsUpdate = true
        currentSketch = sketchName
        console.log(`Switched to sketch: ${sketchName}`)
      } else {
        console.warn(`Sketch function not found in module: ${sketchName}`)
      }
    } else {
      console.warn(`Sketch not found: ${sketchName}`)
    }
  } catch (error) {
    console.error(`Failed to load sketch: ${sketchName}`, error)
  }
}

// Add a fullscreeen sketch plane to the scene
const sketch = new Mesh(sketchGeometry, sketchMaterial)
sketch.scale.set(2, 2, 1)
scene.add(sketch)

// Initialize app
async function init() {
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
      // Try to load sketch directly by name (remove leading slash)
      const sketchName = path.slice(1)
      switchSketch(sketchName)
    }
  })

  // Start rendering
  frame()
}

// Start the app
init()
