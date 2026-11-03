import "./index.css";

const SKETCHES_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>`;
const CAMERA_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h1.3l1-1.5h4.4l1 1.5h1.3A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z"/><circle cx="8" cy="8.5" r="2.4"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const RING_RADIUS = 6.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Record glyph. While recording, a ring fills clockwise to show progress (0–1). */
function recordIcon(progress) {
	const ring =
		progress === undefined
			? ""
			: `<circle class="toolbar__record-ring" cx="8" cy="8" r="${RING_RADIUS}" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${RING_CIRCUMFERENCE * (1 - progress)}"/>`;
	return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle class="toolbar__record-track" cx="8" cy="8" r="${RING_RADIUS}"/>${ring}<circle class="toolbar__record-dot" cx="8" cy="8" r="3.5"/></svg>`;
}

function loadSketches() {
	const sketchesGlob = import.meta.glob("@/sketches/**/*.js", { eager: true });

	return Object.keys(sketchesGlob)
		.sort()
		.map((filePath) => {
			// /src/sketches/noise/dawn-1.js -> noise/dawn-1
			const relativePath = filePath
				.replace("/src/sketches/", "")
				.replace(/\.js$/, "");
			return {
				name: relativePath.split("/").pop() || relativePath,
				path: `/${relativePath}`,
				url: `/sketches/${relativePath}`,
			};
		});
}

function el(tag, className, attrs = {}) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	for (const [key, value] of Object.entries(attrs))
		node.setAttribute(key, value);
	return node;
}

/**
 * Floating bottom toolbar: sketches menu, 4:3 PNG snapshot and fixed-length 4:3 video recording.
 *
 * @param {Object} options
 * @param {(url: string) => void} options.onNavigate - Navigate to a sketch url (e.g. /sketches/flare-1).
 * @param {() => Promise<boolean>} options.onSnapshot - Captures and downloads a snapshot; resolves true on success.
 * @param {(onProgress: (remainingMs: number) => void) => Promise<void>} options.onRecord - Records and downloads a video.
 * @param {{ width: number, height: number }} options.snapshot - Snapshot size, used for the tooltip.
 * @param {{ width: number, height: number, durationMs: number }} options.video - Video settings, used for the tooltip.
 */
class Toolbar {
	constructor({ onNavigate, onSnapshot, onRecord, snapshot, video }) {
		this.onNavigate = onNavigate;
		this.onSnapshot = onSnapshot;
		this.onRecord = onRecord;
		this.snapshot = snapshot;
		this.video = video;
		this.durationSeconds = Math.round(video.durationMs / 1000);
		this.sketches = loadSketches();
		this.menuOpen = false;
		this.savedTimeout = null;

		this.create();
	}

	create() {
		const root = el("div", "toolbar", {
			role: "toolbar",
			"aria-label": "Sketch controls",
		});

		// Sketches menu
		const menuButton = el("button", "toolbar__button", {
			type: "button",
			"aria-label": "Sketches",
			"aria-haspopup": "menu",
			"aria-expanded": "false",
			"data-tooltip": "Sketches",
		});
		menuButton.innerHTML = SKETCHES_ICON;
		menuButton.addEventListener("click", () =>
			this.setMenuOpen(!this.menuOpen),
		);

		const popover = el("nav", "toolbar__popover", { "aria-label": "Sketches" });
		popover.hidden = true;
		const title = el("div", "toolbar__popover-title");
		title.textContent = "Sketches";
		popover.appendChild(title);

		this.items = this.sketches.map((sketch) => {
			const item = el("a", "toolbar__item", { href: `#${sketch.url}` });
			const name = el("span");
			name.textContent = sketch.name;
			const path = el("span", "toolbar__item-path");
			path.textContent = sketch.path;
			item.append(name, path);
			item.addEventListener("click", (event) => {
				event.preventDefault();
				this.onNavigate?.(sketch.url);
				this.setMenuOpen(false);
			});
			popover.appendChild(item);
			return { item, url: sketch.url };
		});

		if (this.sketches.length === 0) {
			const empty = el("div", "toolbar__item-path");
			empty.textContent = "No sketches found";
			popover.appendChild(empty);
		}

		// Capture
		const snapshotButton = el("button", "toolbar__button", { type: "button" });
		snapshotButton.addEventListener("click", () => this.handleSnapshot());

		const recordButton = el("button", "toolbar__button", { type: "button" });
		recordButton.addEventListener("click", () => this.handleRecord());

		root.append(
			menuButton,
			popover,
			el("span", "toolbar__divider", { "aria-hidden": "true" }),
			snapshotButton,
			recordButton,
		);
		document.body.appendChild(root);

		this.root = root;
		this.menuButton = menuButton;
		this.popover = popover;
		this.snapshotButton = snapshotButton;
		this.recordButton = recordButton;

		this.renderSnapshot(false);
		this.renderRecord(null);

		// Close the menu on outside click / Escape
		this.onPointerDown = (event) => {
			if (this.menuOpen && !root.contains(event.target))
				this.setMenuOpen(false);
		};
		this.onKeyDown = (event) => {
			if (this.menuOpen && event.key === "Escape") this.setMenuOpen(false);
		};
		document.addEventListener("pointerdown", this.onPointerDown);
		document.addEventListener("keydown", this.onKeyDown);
	}

	setMenuOpen(open) {
		this.menuOpen = open;
		this.popover.hidden = !open;
		this.menuButton.setAttribute("aria-expanded", String(open));

		if (open) {
			const current = window.location.hash.slice(1);
			for (const { item, url } of this.items) {
				if (url === current) item.setAttribute("aria-current", "page");
				else item.removeAttribute("aria-current");
			}
		}
	}

	renderSnapshot(saved) {
		const button = this.snapshotButton;
		if (saved) button.dataset.state = "saved";
		else delete button.dataset.state;
		button.setAttribute(
			"aria-label",
			saved ? "Snapshot saved" : "Capture snapshot",
		);
		button.dataset.tooltip = saved
			? "Saved"
			: `Snapshot · ${this.snapshot.width}×${this.snapshot.height}`;
		button.innerHTML = saved ? CHECK_ICON : CAMERA_ICON;
	}

	renderRecord(remainingMs) {
		const button = this.recordButton;
		const isRecording = remainingMs !== null;
		const seconds = isRecording ? Math.ceil(remainingMs / 1000) : 0;

		button.disabled = isRecording;
		this.snapshotButton.disabled = isRecording;

		if (isRecording) button.dataset.state = "recording";
		else delete button.dataset.state;

		button.setAttribute(
			"aria-label",
			isRecording ? `Recording, ${seconds} seconds left` : "Record video",
		);
		button.dataset.tooltip = isRecording
			? `Recording · ${seconds}s`
			: `Record ${this.durationSeconds}s · ${this.video.width}×${this.video.height}`;
		button.innerHTML = recordIcon(
			isRecording ? 1 - remainingMs / this.video.durationMs : undefined,
		);
	}

	flash() {
		const flash = el("div", "capture-flash");
		flash.addEventListener("animationend", () => flash.remove());
		document.body.appendChild(flash);
	}

	async handleSnapshot() {
		this.flash();
		const ok = await this.onSnapshot?.();
		if (!ok) return;

		this.renderSnapshot(true);
		clearTimeout(this.savedTimeout);
		this.savedTimeout = setTimeout(() => this.renderSnapshot(false), 1200);
	}

	async handleRecord() {
		if (this.recordButton.disabled) return;
		this.setMenuOpen(false);
		try {
			await this.onRecord?.((remainingMs) => this.renderRecord(remainingMs));
		} finally {
			this.renderRecord(null);
		}
	}

	destroy() {
		clearTimeout(this.savedTimeout);
		document.removeEventListener("pointerdown", this.onPointerDown);
		document.removeEventListener("keydown", this.onKeyDown);
		this.root?.remove();
	}
}

export default Toolbar;
