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
import { dawn1 } from '@/sketches/dawn-1'
import { flare1 } from '@/sketches/flare-1'

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

// Add your sketch here using TSL
sketchMaterial.colorNode = dawn1()

// Add a fullscreeen sketch plane to the scene
const sketch = new Mesh(smokeGeometry, sketchMaterial)
sketch.scale.set(2, 2, 1)
scene.add(sketch)

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

frame()
