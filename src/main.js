import "./index.css";

import WebGPUShader from "./components/shader/webgpu_shader.js";
import Toolbar from "./components/toolbar/toolbar.js";
import Router from "./router.js";

// Preload all sketches using import.meta.glob
const sketches = import.meta.glob("./sketches/**/*.js", { eager: true });

function getDefaultSketchName() {
	const first = Object.keys(sketches).sort()[0];
	if (!first) return null;
	return first.replace("./sketches/", "").replace(/\.js$/, "");
}

let currentSketch = null;

// Function to switch sketches using preloaded modules
async function switchSketch(sketchName) {
	try {
		// Dispose current sketch if it exists
		if (currentSketch?.dispose) {
			await currentSketch.dispose();
		}

		// Find the sketch module by path
		const sketchPath = `./sketches/${sketchName}.js`;
		const sketchModule = sketches[sketchPath];

		if (sketchModule) {
			// Get the sketch (default export only)
			const sketchExport = sketchModule.default;

			if (sketchExport) {
				if (sketchExport instanceof WebGPUShader) {
					currentSketch = sketchExport;
					// Optional `export const postProcessing = { layers: [...] }` in the sketch file
					currentSketch.setPostProcessing(sketchModule.postProcessing ?? null);
					await currentSketch.init();
					await currentSketch.render();
				} else {
					console.warn(`Sketch export is not a WebGPUShader: ${sketchName}`);
					return;
				}

				console.log(`Switched to sketch: ${sketchName}`);
			} else {
				console.warn(`Sketch function not found in module: ${sketchName}`);
			}
		} else {
			console.warn(`Sketch not found: ${sketchName}`);
		}
	} catch (error) {
		console.error(`Failed to load sketch: ${sketchName}`, error);
	}
}

function getCaptureName() {
	return (
		window.location.hash
			.replace(/^#\/?(sketches\/)?/, "")
			.replace(/\//g, "-") || "snapshot"
	);
}

function saveBlobToDisk(blob, fileName) {
	return fetch(`/__capture?name=${encodeURIComponent(fileName)}`, {
		method: "POST",
		body: blob,
	})
		.then((res) => res.ok)
		.catch(() => false);
}

async function downloadBlob(blob, extension) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const fileName = `${getCaptureName()}-${timestamp}.${extension}`;

	// In dev, `?capture=disk` writes the file to ./captures via the Vite plugin rather than downloading it
	const toDisk =
		import.meta.env.DEV &&
		new URLSearchParams(window.location.search).get("capture") === "disk";
	if (toDisk && (await saveBlobToDisk(blob, fileName))) {
		return;
	}

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Capture settings (4:3). Change these to override the defaults.
const SNAPSHOT = { width: 1200, height: 900 };
// Also accepts fps and bitrate, e.g. { durationMs: 10000, width: 1200, height: 900, bitrate: 10_000_000 }
const VIDEO = { durationMs: 5000, width: 960, height: 720 };

// Capture a PNG of the current sketch and download it
async function captureSnapshot() {
	if (!currentSketch?.capture || currentSketch._recording) return false;

	const blob = await currentSketch.capture(SNAPSHOT.width, SNAPSHOT.height);
	if (!blob) return false;
	await downloadBlob(blob, "png");
	return true;
}

// Record the current sketch and download it
async function recordVideo(onProgress, options = VIDEO) {
	if (!currentSketch?.record) return;

	const blob = await currentSketch.record({ ...options, onProgress });
	if (blob)
		await downloadBlob(blob, blob.type.includes("mp4") ? "mp4" : "webm");
}

// Initialize app
async function init() {
	// Initialize router with automatic route handling
	const router = new Router(async (path) => {
		// Handle different route patterns
		if (path === "/" || path === "") {
			const defaultSketch = getDefaultSketchName();
			if (defaultSketch) {
				window.location.hash = `/sketches/${defaultSketch}`;
			}
			return;
		} else if (path.startsWith("/sketches/")) {
			const sketchName = path.split("/sketches/")[1];
			if (sketchName) {
				await switchSketch(sketchName);
			}
		} else {
			// Try to load sketch directly by name (remove leading slash)
			const sketchName = path.slice(1);
			await switchSketch(sketchName);
		}
	});

	// Make router globally available for navigation
	window.router = router;

	// Initialize toolbar (sketches menu + capture)
	new Toolbar({
		onNavigate: (url) => router.navigate(url),
		onSnapshot: captureSnapshot,
		onRecord: recordVideo,
		snapshot: SNAPSHOT,
		video: VIDEO,
	});
}

// Start the app
init();
