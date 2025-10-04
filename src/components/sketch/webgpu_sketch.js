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
import { vec3, Fn } from 'three/tsl'

class WebGPUSketch {
  constructor(canvas, colorNode = null, onFrame = null) {
    this._canvas = canvas

    this._colorNode = colorNode
    this._onFrame = onFrame

    this._meshInitialized = false
  }

  async init() {
    this._scene = new Scene()

    // Viewport sizes
    this._viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    // Camera
    this._camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    this._camera.position.z = 1
    this._scene.add(this._camera)

    // Renderer
    this._renderer = new WebGPURenderer({
      canvas: this._canvas,
      antialias: true,
      toneMapping: NoToneMapping,
      outputColorSpace: LinearSRGBColorSpace,
    })
    this._renderer.setSize(this._viewport.width, this._viewport.height)
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setClearColor('#000000')

    window.addEventListener('resize', this._resizeHandler)
  }

  _initMesh() {
    // Sketch geometry
    this._geometry = new PlaneGeometry(1, 1, 1, 1)

    // Sketch material
    this._material = new MeshBasicNodeMaterial({
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    })
    this._material.colorNode = this._colorNode ? this._colorNode : vec3(0, 0, 0)

    // Add a fullscreeen sketch plane to the scene
    this._mesh = new Mesh(this._geometry, this._material)
    this._mesh.scale.set(2, 2, 1)
    this._scene.add(this._mesh)
  }

  _resizeHandler = () => {
    // Update sizes
    this._viewport.width = window.innerWidth
    this._viewport.height = window.innerHeight
    this._viewport.pixelRatio = Math.min(window.devicePixelRatio, 2)

    // Update camera
    this._camera.aspect = this._viewport.width / this._viewport.height
    this._camera.updateProjectionMatrix()

    // Update renderer
    this._renderer.setSize(this._viewport.width, this._viewport.height)
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  async render() {
    if (!this._meshInitialized) {
      this._initMesh()
      this._meshInitialized = true
    }

    await this._renderer.renderAsync(this._scene, this._camera)

    if (this._onFrame) {
      this._onFrame(this._colorNode, this._renderer)
    }

    const frame = this.render.bind(this)
    this._animationFrameId = window.requestAnimationFrame(frame)
  }

  dispose() {
    // Cancel any pending animation frames
    if (this._animationFrameId) {
      window.cancelAnimationFrame(this._animationFrameId)
    }

    window.removeEventListener('resize', this._resizeHandler)

    // Dispose geometry
    if (this._geometry) {
      this._geometry.dispose()
    }

    // Dispose material
    if (this._material) {
      this._material.dispose()
    }

    // Dispose renderer
    if (this._renderer) {
      this._renderer.dispose()
    }

    // Clear references
    this._scene = null
    this._geometry = null
    this._material = null
    this._camera = null
    this._renderer = null
    this._mesh = null
  }
}

export default WebGPUSketch
