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
import SketchesDropdown from './components/sketches_dropdown/sketches_dropdown.js'
import WebGPUSketch from './components/sketch/webgpu_sketch.js'

// Preload all sketches using import.meta.glob
const sketches = import.meta.glob('./sketches/**/*.js', { eager: true })

let currentSketch = null

// Sketches dropdown
let sketchesDropdown = null

// Function to switch sketches using preloaded modules
async function switchSketch(sketchName) {
  try {
    // Dispose current sketch if it exists
    if (currentSketch && currentSketch.dispose) {
      currentSketch.dispose()
    }

    // Find the sketch module by path
    const sketchPath = `./sketches/${sketchName}.js`
    const sketchModule = sketches[sketchPath]

    if (sketchModule) {
      // Get the sketch (default export only)
      const sketchExport = sketchModule.default

      if (sketchExport) {
        if (sketchExport instanceof WebGPUSketch) {
          currentSketch = sketchExport
          await currentSketch.init()
          await currentSketch.render()
        } else {
          console.warn(`Sketch export is neither WebGPUSketch nor function: ${sketchName}`)
          return
        }

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
  const router = new Router(async (path) => {
    // Handle different route patterns
    if (path === '/' || path === '') {
      await switchSketch('')
    } else if (path.startsWith('/sketches/')) {
      const sketchName = path.split('/sketches/')[1]
      if (sketchName) {
        await switchSketch(sketchName)
      }
    } else {
      // Try to load sketch directly by name (remove leading slash)
      const sketchName = path.slice(1)
      await switchSketch(sketchName)
    }
  })

  // Make router globally available for navigation
  window.router = router

  // Initialize sketches dropdown
  console.log('Initializing sketches dropdown...')
  sketchesDropdown = new SketchesDropdown()
  console.log('Sketches dropdown initialized:', sketchesDropdown)
}

// Start the app
init()
