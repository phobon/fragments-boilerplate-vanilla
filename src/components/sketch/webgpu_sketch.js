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
	Vector2,
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
		// Hold the fixed capture size while a recording is in progress
		if (this._recording) return;

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

	/**
	 * Renders a single frame at a fixed resolution and returns it as a PNG blob.
	 * The drawing buffer is resized without touching CSS, then restored.
	 */
	async capture(width = 1200, height = 900) {
		if (!this._renderer || !this._meshInitialized) {
			return null;
		}

		const prevSize = this._renderer.getSize(new Vector2());
		const prevPixelRatio = this._renderer.getPixelRatio();

		const output = document.createElement("canvas");
		output.width = width;
		output.height = height;
		const ctx = output.getContext("2d");

		try {
			this._renderer.setPixelRatio(1);
			this._renderer.setSize(width, height, false);
			this._renderer.render(this._scene, this._camera);

			// Copy synchronously, before the WebGPU canvas texture is presented and discarded
			ctx.drawImage(this._renderer.domElement, 0, 0, width, height);
		} finally {
			this._renderer.setPixelRatio(prevPixelRatio);
			this._renderer.setSize(prevSize.x, prevSize.y, false);
			this._renderer.render(this._scene, this._camera);
		}

		return new Promise((resolve) => output.toBlob(resolve, "image/png"));
	}

	/**
	 * Records the live canvas at a fixed resolution for a fixed duration and returns the video blob.
	 * Prefers MP4 (H.264) where supported, falling back to WebM.
	 * While recording, the canvas is letterboxed on screen so the preview matches the output framing.
	 */
	async record({
		durationMs = 5000,
		width = 960,
		height = 720,
		fps = 60,
		bitrate = 6_000_000,
		onProgress = null,
	} = {}) {
		if (!this._renderer || !this._meshInitialized || this._recording) {
			return null;
		}

		const renderer = this._renderer;
		const canvas = renderer.domElement;
		const prevObjectFit = canvas.style.objectFit;

		this._recording = true;

		try {
			renderer.setPixelRatio(1);
			renderer.setSize(width, height, false);
			canvas.style.objectFit = "contain";

			const mimeType =
				[
					"video/mp4;codecs=avc1.640028",
					"video/mp4",
					"video/webm;codecs=vp9",
					"video/webm;codecs=vp8",
					"video/webm",
				].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";

			const stream = canvas.captureStream(fps);
			const recorder = new MediaRecorder(stream, {
				mimeType: mimeType || undefined,
				videoBitsPerSecond: bitrate,
			});
			const chunks = [];
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunks.push(e.data);
			};
			const stopped = new Promise((resolve) => {
				recorder.onstop = resolve;
			});

			recorder.start();
			const start = performance.now();
			onProgress?.(durationMs);
			const interval = setInterval(() => {
				onProgress?.(Math.max(0, durationMs - (performance.now() - start)));
			}, 250);

			await new Promise((resolve) => setTimeout(resolve, durationMs));
			clearInterval(interval);
			recorder.stop();
			await stopped;
			stream.getTracks().forEach((track) => track.stop());

			const type = recorder.mimeType || mimeType || "video/webm";
			return new Blob(chunks, { type });
		} finally {
			canvas.style.objectFit = prevObjectFit;
			this._recording = false;
			// Restore to the current window size (picks up any resizes during recording)
			if (this._renderer) this._resizeHandler();
		}
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
