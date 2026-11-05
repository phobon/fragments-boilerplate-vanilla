import {
	Fn,
	instanceIndex,
	storageTexture,
	textureStore,
	uniform,
	uvec2,
	vec2,
	vec3,
	vec4,
	wgslFn,
} from "three/tsl";
import * as THREE from "three/webgpu";
import { MeshBasicMaterial, NodeAccess } from "three/webgpu";
import WebGPUShader from "@/components/shader/webgpu_shader";
import { sortLuminance } from "@/tsl/pixel_sort/sorting_functions";
import { allValid } from "@/tsl/pixel_sort/sorting_validators";

const DEFAULT_COLORNODE = Fn(([_uv]) => {
	return vec3(_uv, 1);
});

const nextPowerOfTwo = (n) => 2 ** Math.ceil(Math.log2(n));

export class PixelSort extends WebGPUShader {
	constructor(
		canvas,
		{
			colorNode = DEFAULT_COLORNODE,
			sortFn = sortLuminance,
			validateFn = allValid,
			threshold = 0.5,
			sortDirection = "horizontal", // 'horizontal' | 'vertical'
			sortAlgorithm = "odd-even", // 'odd-even' | 'bitonic'
			passesPerFrame = null, // null -> enough passes to fully sort in one frame (odd-even only)
			reseedEveryFrame = false, // true for animated inputs (video, moving shaders)
		} = {},
	) {
		super(canvas);

		this.colorNode = colorNode;
		this.sortFn = sortFn;
		this.validateFn = validateFn;
		this.threshold = threshold;
		this.sortDirection = sortDirection;
		this.sortAlgorithm = sortAlgorithm;
		this.passesPerFrame = passesPerFrame;
		this.reseedEveryFrame = reseedEveryFrame;

		// Cross-frame state so a low passesPerFrame can animate the sort over time
		this.readIsPing = true; // init writes ping, so we start reading there
		this.passesDone = 0;
		this.bitonicDone = false;
	}

	async init() {
		await super.init();

		const gl = this._renderer;
		const isBitonic = this.sortAlgorithm === "bitonic";
		const _height = Math.floor(this._viewport.height);
		// Bitonic requires a power-of-two row width; pad the buffer up to one
		const _width = isBitonic
			? nextPowerOfTwo(Math.floor(this._viewport.width))
			: Math.floor(this._viewport.width);

		// Create textures
		this.pingTexture = new THREE.StorageTexture(_width, _height);
		this.pongTexture = new THREE.StorageTexture(_width, _height);
		this.pingTexture.type = THREE.HalfFloatType;
		this.pongTexture.type = THREE.HalfFloatType;

		// Set up texture access
		const readPing = storageTexture(this.pingTexture).setAccess(
			NodeAccess.READ_ONLY,
		);
		const writePing = storageTexture(this.pingTexture).setAccess(
			NodeAccess.WRITE_ONLY,
		);
		const readPong = storageTexture(this.pongTexture).setAccess(
			NodeAccess.READ_ONLY,
		);
		const writePong = storageTexture(this.pongTexture).setAccess(
			NodeAccess.WRITE_ONLY,
		);

		const _sortDirection = this.sortDirection === "vertical" ? 1 : 0;
		const threshold = this.threshold;
		const resolution = _width * _height;
		const pingTexture = this.pingTexture;
		const colorNode = this.colorNode;

		// Initialize the ping texture with the color node. The colorNode receives a
		// centred UV (-0.5..0.5); shift by 0.5 when sampling a texture.
		this.computeInitFn = Fn(() => {
			const x = instanceIndex.mod(_width);
			const y = instanceIndex.div(_width);
			const indexUv = uvec2(x, y);

			const _uv = vec2(x, y).div(vec2(_width, _height)).sub(0.5);

			const pixel = colorNode(_uv);

			textureStore(pingTexture, indexUv, vec4(pixel, 1));
		})().compute(resolution);

		gl.compute(this.computeInitFn);

		// `textureLoad` currently throws in TSL against read/write storage textures,
		// so the sorting kernels are authored in WGSL via `wgslFn`
		const wgslFormat =
			this.pingTexture.type === THREE.HalfFloatType
				? "rgba16float"
				: "rgba8unorm";

		// Bitonic schedule + uniforms (mutated between dispatches to walk the schedule)
		this.kU = uniform(0, "uint");
		this.jU = uniform(0, "uint");
		this.stages = [];

		if (isBitonic) {
			// Precompute the (k, j) schedule for a power-of-two width.
			// stages.length === m·(m+1)/2 (36 for width = 256)
			for (let k = 2; k <= _width; k <<= 1) {
				for (let j = k >> 1; j > 0; j >>= 1) {
					this.stages.push([k, j]);
				}
			}

			const computeBitonicWGSL = wgslFn(
				`
      fn computeBitonicWGSL(
        readTex: texture_storage_2d<${wgslFormat}, read>,
        writeTex: texture_storage_2d<${wgslFormat}, write>,
        index: u32,
        k: u32,
        j: u32
      ) -> void {
        let width = ${_width};
        let height = ${_height};

        let i = i32(index);
        let row = i / width;
        let col = i % width;

        // Bitonic partner in the same row. XOR by j (< width) keeps it in-row.
        let partner = col ^ i32(j);

        // NOTE: 'self' is a reserved keyword in WGSL - use 'own'
        let own = textureLoad(readTex, vec2i(col, row)).rgb;
        let other = textureLoad(readTex, vec2i(partner, row)).rgb;

        // Ascending sub-sequence when (col & k) == 0, descending otherwise.
        let ascending = (col & i32(k)) == 0;

        // Comparator returns true when 'own' should sort AFTER 'other' (is "greater").
        let selfGreater = sort(own, other, vec2i(col, row), vec2i(partner, row), vec2i(width, height));

        // Each thread outputs either its own pixel or its partner's.
        var outColor = own;
        let isLower = partner > col;

        if (ascending) {
          // lower index keeps the smaller value, upper index keeps the larger
          if (isLower) {
            if (selfGreater) { outColor = other; }
          } else {
            if (!selfGreater) { outColor = other; }
          }
        } else {
          // descending: the reverse
          if (isLower) {
            if (!selfGreater) { outColor = other; }
          } else {
            if (selfGreater) { outColor = other; }
          }
        }

        textureStore(writeTex, vec2i(col, row), vec4f(outColor, 1));
      }
      `,
				// Only the comparator is injected - no validator (bitonic is a full sort)
				[this.sortFn],
			);

			this.computeToPong = computeBitonicWGSL({
				readTex: readPing,
				writeTex: writePong,
				index: instanceIndex,
				k: this.kU,
				j: this.jU,
			}).compute(resolution);

			this.computeToPing = computeBitonicWGSL({
				readTex: readPong,
				writeTex: writePing,
				index: instanceIndex,
				k: this.kU,
				j: this.jU,
			}).compute(resolution);
		} else {
			const computePingPongWGSL = wgslFn(
				`
      fn computePingPongWGSL(
        readTex: texture_storage_2d<${wgslFormat}, read>,
        writeTex: texture_storage_2d<${wgslFormat}, write>,
        index: u32,
        offset: u32
      ) -> void {
        let width = ${_width};
        let height = ${_height};

        // One thread per pixel
        let col = i32(index) % width;
        let row = i32(index) / width;
        let indexUV = vec2i(col, row);

        // Position along the sort axis, the length of that axis, and the step to the next pixel along it
        var pos = col;
        var len = width;
        var dir = vec2i(1, 0);
        if (${_sortDirection} == 1) {
          pos = row;
          len = height;
          dir = vec2i(0, 1);
        }

        // Odd-even transposition: each pass pairs every pixel with its next neighbour,
        // alternating which parity leads the pair. The leading pixel's thread handles the pair
        let leadsPair = (pos + i32(offset)) % 2 == 0;

        if (!leadsPair) {
          // The partner thread writes this pixel - except the very first pixel on odd passes, which has no partner
          if (pos == 0) {
            textureStore(writeTex, indexUV, vec4f(textureLoad(readTex, indexUV).rgb, 1));
          }
          return;
        }

        // The last pixel has no neighbour, so write it straight through
        if (pos + 1 >= len) {
          textureStore(writeTex, indexUV, vec4f(textureLoad(readTex, indexUV).rgb, 1));
          return;
        }

        let neighborUV = indexUV + dir;

        // Load the pixel and neighbor
        let pixel = textureLoad(readTex, indexUV).rgb;
        let neighbor = textureLoad(readTex, neighborUV).rgb;

        // Validate whether the pixel is valid to sort, if not write both back unchanged
        let valid = validate(pixel, neighbor, indexUV, neighborUV, vec2i(width, height), ${threshold});
        if (!valid) {
          textureStore(writeTex, indexUV, vec4f(pixel, 1));
          textureStore(writeTex, neighborUV, vec4f(neighbor, 1));
          return;
        }

        // Sort the pixel!
        let swap = sort(pixel, neighbor, indexUV, neighborUV, vec2i(width, height));
        if (swap) {
          textureStore(writeTex, indexUV, vec4f(neighbor, 1));
          textureStore(writeTex, neighborUV, vec4f(pixel, 1));
        } else {
          textureStore(writeTex, indexUV, vec4f(pixel, 1));
          textureStore(writeTex, neighborUV, vec4f(neighbor, 1));
        }
      }
      `,
				[this.sortFn, this.validateFn],
			);

			// computeToPong reads ping/writes pong (offset 0 -> even parity); computeToPing
			// reads pong/writes ping (offset 1 -> odd parity)
			this.computeToPong = computePingPongWGSL({
				readTex: readPing,
				writeTex: writePong,
				index: instanceIndex,
				offset: 0,
			}).compute(resolution);

			this.computeToPing = computePingPongWGSL({
				readTex: readPong,
				writeTex: writePing,
				index: instanceIndex,
				offset: 1,
			}).compute(resolution);
		}

		// Full convergence needs up to `width` (horizontal) / `height` (vertical) passes
		this.defaultPasses = _sortDirection === 1 ? _height : _width;
	}

	_initMesh() {
		super._initMesh();

		this.material = new MeshBasicMaterial({
			transparent: true,
			map: this.pongTexture,
		});

		this._mesh.material = this.material;
	}

	async render() {
		super.render();

		if (!this.material) {
			return;
		}

		// For animated inputs, re-seed the ping buffer from the colorNode so this
		// frame sorts the CURRENT source frame, and restart the sort from scratch
		if (this.reseedEveryFrame) {
			await this._renderer.computeAsync(this.computeInitFn);
			this.readIsPing = true;
			this.passesDone = 0;
			this.bitonicDone = false;
		}

		if (this.sortAlgorithm === "bitonic") {
			// A bitonic network must run its whole schedule to be correct, so it always
			// fully sorts in a single frame
			if (this.bitonicDone) {
				return;
			}
			let readIsPing = true;
			for (const [k, j] of this.stages) {
				this.kU.value = k;
				this.jU.value = j;
				await this._renderer.computeAsync(
					readIsPing ? this.computeToPong : this.computeToPing,
				);
				readIsPing = !readIsPing;
			}
			this.material.map = readIsPing ? this.pingTexture : this.pongTexture;
			this.bitonicDone = true;
			return;
		}

		// Odd-even. Once fully converged there's nothing left to do
		if (!this.reseedEveryFrame && this.passesDone >= this.defaultPasses) {
			return;
		}

		// Passes to run THIS frame. Defaults to a full converge-in-one-frame sort;
		// set a small value (1-4) to watch the sort crawl in over many frames
		const perFrame = this.passesPerFrame ?? this.defaultPasses;
		for (let pass = 0; pass < perFrame; pass++) {
			await this._renderer.computeAsync(
				this.readIsPing ? this.computeToPong : this.computeToPing,
			);
			this.readIsPing = !this.readIsPing;
		}
		this.passesDone += perFrame;

		// Whichever texture we last wrote to holds the current (possibly partial) result
		this.material.map = this.readIsPing ? this.pingTexture : this.pongTexture;
	}

	dispose() {
		this.pingTexture?.dispose();
		this.pongTexture?.dispose();
		this.computeInitFn?.dispose();
		this.computeToPong?.dispose();
		this.computeToPing?.dispose();
		this.material?.dispose();

		super.dispose();
	}
}

export default PixelSort;
