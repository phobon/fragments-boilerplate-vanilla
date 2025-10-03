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
import SketchesDropdown from './sketches_dropdown/sketches_dropdown.js'
import dawn1 from './sketches/noise/dawn-1.js'
import WebGPUSketch from './components/webgpu_sketch.js'

// Canvas
const canvas = document.querySelector('#webgpu-canvas')

// Sketch
const webgpuSketch = new WebGPUSketch(canvas, dawn1)

// Preload all sketches using import.meta.glob
const sketches = import.meta.glob('./sketches/**/*.js', { eager: true })

// Current sketch
let currentSketch = null

// Sketches dropdown
let sketchesDropdown = null

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
        // Update the colorNode for the sketch
        webgpuSketch.colorNode = sketchFunction

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

// Initialize app
async function init() {
  // Initialize router with automatic route handling
  const router = new Router((path) => {
    // Handle different route patterns
    if (path === '/' || path === '') {
      switchSketch('noise/dawn-1')
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

  // Make router globally available for navigation
  window.router = router

  // Initialize sketches dropdown
  console.log('Initializing sketches dropdown...')
  sketchesDropdown = new SketchesDropdown()
  console.log('Sketches dropdown initialized:', sketchesDropdown)

  // Start rendering
  webgpuSketch.render()
}

// Start the app
init()
