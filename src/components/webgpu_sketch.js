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

class WebGPUSketch {
  constructor(canvas, colorNode, onFrame = null) {
    this._canvas = canvas

    this._colorNode = colorNode
    this._onFrame = onFrame

    this.init()
  }

  async init() {
    this._scene = new Scene()

    // Sketch geometry
    this._geometry = new PlaneGeometry(1, 1, 1, 1)

    // Sketch material
    this._material = new MeshBasicNodeMaterial({
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    })
    this._material.colorNode = this._colorNode()

    // Viewport sizes
    const viewport = {
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
    this._renderer.setSize(viewport.width, viewport.height)
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setClearColor('#000000')

    // Add a fullscreeen sketch plane to the scene
    this._mesh = new Mesh(this._geometry, this._material)
    this._mesh.scale.set(2, 2, 1)
    this._scene.add(this._mesh)

    window.addEventListener('resize', function () {
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
    })
  }

  get colorNode() {
    return this._colorNode
  }

  set colorNode(colorNode) {
    this._colorNode = colorNode

    // Update the colorNode for the sketch
    if (!this._colorNode) {
      this._material.colorNode = vec3(0, 0, 0)
      console.warn('No colorNode provided')
    } else {
      this._material.colorNode = colorNode()
    }

    this._material.needsUpdate = true
  }

  async render() {
    await this._renderer.renderAsync(this._scene, this._camera)

    if (this._onFrame) {
      this._onFrame()
    }

    const frame = this.render.bind(this)
    window.requestAnimationFrame(frame)
  }

  dispose() {
    this._renderer.dispose()
    this._scene.dispose()
    this._camera.dispose()
    this._material.dispose()
    this._geometry.dispose()
  }
}

export default WebGPUSketch
