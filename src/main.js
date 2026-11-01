import "./index.css";

import WebGPUSketch from "./components/sketch/webgpu_sketch.js";
import SketchesDropdown from "./components/sketches_dropdown/sketches_dropdown.js";
import Router from "./router.js";

// Preload all sketches using import.meta.glob
const sketches = import.meta.glob("./sketches/**/*.js", { eager: true });

function getDefaultSketchName() {
	const first = Object.keys(sketches).sort()[0];
	if (!first) return null;
	return first.replace("./sketches/", "").replace(/\.js$/, "");
}

let currentSketch = null;

// Sketches dropdown
let sketchesDropdown = null;

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
				if (sketchExport instanceof WebGPUSketch) {
					currentSketch = sketchExport;
					await currentSketch.init();
					await currentSketch.render();
				} else {
					console.warn(
						`Sketch export is neither WebGPUSketch nor function: ${sketchName}`,
					);
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

function downloadBlob(blob, extension) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${getCaptureName()}-${timestamp}.${extension}`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Capture a 1200x900 (4:3) PNG of the current sketch and download it
async function captureSnapshot() {
	if (!currentSketch?.capture || currentSketch._recording) return;

	const blob = await currentSketch.capture(1200, 900);
	if (blob) downloadBlob(blob, "png");
}

// Record the current sketch (defaults: 5s at 960x720, 4:3) and download it.
// Override with e.g. { durationMs: 10000, width: 1200, height: 900, bitrate: 10_000_000 }
async function recordVideo(onProgress, options = {}) {
	if (!currentSketch?.record) return;

	const blob = await currentSketch.record({ ...options, onProgress });
	if (blob) downloadBlob(blob, blob.type.includes("mp4") ? "mp4" : "webm");
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

	// Initialize sketches dropdown
	console.log("Initializing sketches dropdown...");
	sketchesDropdown = new SketchesDropdown({
		onCapture: captureSnapshot,
		onRecord: recordVideo,
	});
	console.log("Sketches dropdown initialized:", sketchesDropdown);
}

// Start the app
init();
