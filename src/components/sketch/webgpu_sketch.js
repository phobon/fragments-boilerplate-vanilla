// import { Inspector } from 'three/examples/jsm/inspector/Inspector.js'
import Stats from "stats-gl";
import { statsGL } from "stats-gl/addons/StatsGLNode.js";
import { addMethodChaining, vec3 } from "three/tsl";
import {
	DoubleSide,
	LinearSRGBColorSpace,
	Mesh,
	MeshBasicNodeMaterial,
	NoToneMapping,
	OrthographicCamera,
	PlaneGeometry,
	Scene,
	WebGPURenderer,
} from "three/webgpu";

addMethodChaining("toStatsGL", statsGL);

class WebGPUSketch {
	constructor(canvas, colorNode = null, onFrame = null, debug = false) {
		this._canvas = canvas;

		this._colorNode = colorNode;
		this._onFrame = onFrame;

		this._meshInitialized = false;

		this._debug = debug;

		if (this._debug) {
			this._stats = new Stats({ trackGPU: true });
			const { dom } = this._stats;
			const panelWidth = 90;
			const panelHeight = 48;
			dom.style.position = "relative";
			dom.style.top = "0";
			dom.style.left = "0";
			dom.style.width = `${dom.children.length * panelWidth}px`;
			dom.style.height = `${panelHeight}px`;
			document.getElementById("stats-host").appendChild(dom);
		}
	}

	async init() {
		this._scene = new Scene();

		// Viewport sizes
		this._viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		};

		// Camera
		this._camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
		this._camera.position.z = 1;
		this._scene.add(this._camera);

		// Renderer
		this._renderer = new WebGPURenderer({
			canvas: this._canvas,
			antialias: true,
			toneMapping: NoToneMapping,
			outputColorSpace: LinearSRGBColorSpace,
		});
		// this._renderer.inspector = new Inspector()
		this._renderer.setSize(this._viewport.width, this._viewport.height);
		this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this._renderer.setClearColor("#000000");

		await this._renderer.init();

		if (this._stats) {
			this._stats.init(this._renderer);
		}

		window.addEventListener("resize", this._resizeHandler);
	}

	_initMesh() {
		// Sketch geometry
		this._geometry = new PlaneGeometry(1, 1, 1, 1);

		// Sketch material
		this._material = new MeshBasicNodeMaterial({
			transparent: true,
			side: DoubleSide,
			depthWrite: false,
		});
		this._material.colorNode = this._colorNode
			? this._colorNode
			: vec3(0, 0, 0);

		// Add a fullscreeen sketch plane to the scene
		this._mesh = new Mesh(this._geometry, this._material);
		this._mesh.scale.set(2, 2, 1);
		this._scene.add(this._mesh);
	}

	_resizeHandler = () => {
		// Update sizes
		this._viewport.width = window.innerWidth;
		this._viewport.height = window.innerHeight;

		// Update camera
		this._camera.aspect = this._viewport.width / this._viewport.height;
		this._camera.updateProjectionMatrix();

		// Update renderer
		this._renderer.setSize(this._viewport.width, this._viewport.height);
		this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	};

	async render() {
		if (!this._renderer) {
			return;
		}

		if (!this._meshInitialized) {
			this._initMesh();

			if (this._stats) {
				this._colorNode.toStatsGL("finalColor", this._stats);
			}
			this._meshInitialized = true;
		}

		await this._renderer.render(this._scene, this._camera);

		if (this._stats) {
			this._stats.update();
		}

		if (this._onFrame) {
			this._onFrame(this._colorNode, this._renderer);
		}

		const frame = this.render.bind(this);
		this._animationFrameId = window.requestAnimationFrame(frame);
	}

	async dispose() {
		if (this._animationFrameId) {
			window.cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = null;
		}

		window.removeEventListener("resize", this._resizeHandler);

		if (this._mesh && this._scene) {
			this._scene.remove(this._mesh);
		}

		if (this._geometry) {
			this._geometry.dispose();
		}

		if (this._material) {
			this._material.dispose();
		}

		if (this._renderer) {
			await this._renderer.dispose();
		}

		this._meshInitialized = false;
		this._scene = null;
		this._geometry = null;
		this._material = null;
		this._camera = null;
		this._renderer = null;
		this._mesh = null;
	}
}

export default WebGPUSketch;
