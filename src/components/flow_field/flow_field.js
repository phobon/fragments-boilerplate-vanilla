import {
	atan,
	cos,
	Fn,
	float,
	floor,
	hash,
	If,
	instanceIndex,
	int,
	Loop,
	select,
	sin,
	storage,
	uv,
	vec3,
	vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";
import WebGPUShader from "@/components/shader/webgpu_shader";

// A handful of palettes from the `nice-color-palettes` npm package - swap in your own, or install the package for hundreds more
const colorPalettes = [
	["#69d2e7", "#a7dbd8", "#e0e4cc", "#f38630", "#fa6900"],
	["#fe4365", "#fc9d9a", "#f9cdad", "#c8c8a9", "#83af9b"],
	["#ecd078", "#d95b43", "#c02942", "#542437", "#53777a"],
	["#556270", "#4ecdc4", "#c7f464", "#ff6b6b", "#c44d58"],
	["#774f38", "#e08e79", "#f1d4af", "#ece5ce", "#c5e0dc"],
	["#e8ddcb", "#cdb380", "#036564", "#033649", "#031634"],
	["#490a3d", "#bd1550", "#e97f02", "#f8ca00", "#8a9b0f"],
	["#594f4f", "#547980", "#45ada8", "#9de0ad", "#e5fcc2"],
];

export const hexToRgbArray = (hex) => {
	const rgb = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);

	return rgb ? rgb.slice(1).map((n) => parseInt(n, 16) / 255) : null;
};

const generateColorPalette = (particlesCount) => {
	const allColors = [];
	const randomPalette =
		colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
	let paletteIndex = -1;
	for (let i = 0; i < particlesCount; i += 5000) {
		paletteIndex += 1;
		if (paletteIndex >= randomPalette.length) {
			paletteIndex = 0;
		}

		for (let j = 0; j < 5000; j++) {
			const index = i + j;
			if (index < particlesCount) {
				const c = hexToRgbArray(randomPalette[paletteIndex]);
				allColors.push(c[0], c[1], c[2]);
			}
		}
	}

	return new Float32Array(allColors);
};

export class FlowField extends WebGPUShader {
	constructor(
		canvas,
		{
			flowFieldFn,
			colorNodeFn,
			opacityNodeFn,
			rows = 1024,
			columns = 1024,
			depth = 1,
			particlesCount = Math.pow(2, 18),
			particleScale = 0.002,
			particleOpacity = 0.15,
			particleSpeed = 0.01,
			particleLifespan = 1,
			particleDecay = 0.001,
			flowFieldAngles = [1, 1, 0],
			updateFlowField = false,
			params = {},
		},
	) {
		super(canvas);

		this.flowFieldFn = flowFieldFn;
		this.colorNodeFn = colorNodeFn;
		this.opacityNodeFn = opacityNodeFn;
		this.rows = rows;
		this.columns = columns;
		this.depth = depth;
		this.particlesCount = particlesCount;
		this.particleScale = particleScale;
		this.particleOpacity = particleOpacity;
		this.particleSpeed = particleSpeed;
		this.particleLifespan = particleLifespan;
		this.particleDecay = particleDecay;
		this.flowFieldAngles = flowFieldAngles;
		this.updateFlowField = updateFlowField;
		this.params = params;
	}

	async init() {
		await super.init();

		const gl = this._renderer;

		this.FLOW_FIELD_SIZE = this.columns * this.rows * this.depth;

		this.flowFieldBuffer = storage(
			new THREE.StorageInstancedBufferAttribute(this.FLOW_FIELD_SIZE, 1),
			"float",
			this.FLOW_FIELD_SIZE,
		);

		const flowFieldInitFn = this.flowFieldFn({
			rows: this.rows,
			columns: this.columns,
			depth: this.depth,
			flowFieldBuffer: this.flowFieldBuffer,
			params: this.params,
		}).compute(this.FLOW_FIELD_SIZE);
		gl.compute(flowFieldInitFn);

		// Particles compute
		this.basePositionBuffer = storage(
			new THREE.StorageInstancedBufferAttribute(this.particlesCount, 4),
			"vec4",
			this.particlesCount,
		);
		this.positionBuffer = storage(
			new THREE.StorageInstancedBufferAttribute(this.particlesCount, 4),
			"vec4",
			this.particlesCount,
		);

		// Assign a color buffer for each of the particles
		const colorArray = this.colorNodeFn
			? new Float32Array(this.particlesCount * 3)
			: generateColorPalette(this.particlesCount);
		this.colorBuffer = storage(
			new THREE.StorageInstancedBufferAttribute(colorArray, 3),
			"vec3",
			this.particlesCount,
		);

		this.scaleBuffer = storage(
			new THREE.StorageInstancedBufferAttribute(this.particlesCount, 1),
			"float",
			this.particlesCount,
		);
		this.opacityBuffer = storage(
			new THREE.StorageInstancedBufferAttribute(this.particlesCount, 1),
			"float",
			this.particlesCount,
		);
		this.speedBuffer = storage(
			new THREE.StorageInstancedBufferAttribute(this.particlesCount, 1),
			"float",
			this.particlesCount,
		);

		// Halton sequence for better particle distribution
		const halton = Fn(([index, base]) => {
			const result = float(0.0).toVar();
			const f = float(1.0).toVar();
			const i = float(index).toVar();

			Loop({ start: int(0), end: int(10), type: "int", condition: "<" }, () => {
				const remainder = i.mod(base);
				f.assign(f.div(base));
				result.addAssign(f.mul(remainder));
				i.assign(floor(i.div(base)));
			});

			return result;
		});

		// Compute init
		const particlesInitFn = Fn(() => {
			const basePosition = this.basePositionBuffer.element(instanceIndex);
			const position = this.positionBuffer.element(instanceIndex);

			// Use Halton sequence for better distribution (0 to 1 range)
			const haltonX = halton(instanceIndex, float(2)).mul(2).sub(1); // Base 2
			const haltonY = halton(instanceIndex, float(3)).mul(2).sub(1); // Base 3
			const haltonZ = halton(instanceIndex, float(5)).mul(2).sub(1); // Base 5

			const p = vec4(
				haltonX,
				haltonY,
				haltonZ,
				hash(instanceIndex.mul(3)).mul(this.particleLifespan), // Keep hash for lifespan variation
			);
			position.assign(p);
			basePosition.assign(p);

			const scale = this.scaleBuffer.element(instanceIndex);
			scale.assign(this.particleScale);

			const opacity = this.opacityBuffer.element(instanceIndex);
			opacity.assign(this.particleOpacity);

			const speed = this.speedBuffer.element(instanceIndex);
			speed.assign(this.particleSpeed);
		})().compute(this.particlesCount);
		gl.compute(particlesInitFn);

		this.xCellSize = 1 / this.columns;
		this.yCellSize = 1 / this.rows;
		this.zCellSize = 1 / this.depth;

		// Compute update
		this.particlesUpdate = Fn(() => {
			const updatePos = this.positionBuffer.element(instanceIndex).xyz;
			const updateLifespan = this.positionBuffer.element(instanceIndex).w;

			const particleAlive = updateLifespan.greaterThan(0);

			If(particleAlive, () => {
				// Get the normalised position of the particle (between 0 and 1)
				const normalisedParticlePosition = updatePos.add(1).div(2);
				const indexX = floor(normalisedParticlePosition.x.div(this.xCellSize));
				const indexY = floor(normalisedParticlePosition.y.div(this.yCellSize));
				const indexZ = floor(normalisedParticlePosition.z.div(this.zCellSize));

				const flowFieldIndex = indexZ
					.mul(this.columns * this.rows)
					.add(indexY.mul(this.columns))
					.add(indexX);
				const angle = this.flowFieldBuffer.element(flowFieldIndex);

				// Get the particles new position based on the angle provided
				const speed = this.speedBuffer
					.element(instanceIndex)
					.mul(updateLifespan);
				const x = select(this.flowFieldAngles[0] > 0, cos(angle).mul(speed), 0);
				const y = select(this.flowFieldAngles[1] > 0, sin(angle).mul(speed), 0);
				const z = select(
					this.flowFieldAngles[2] > 0,
					atan(angle).mul(speed),
					0,
				);

				updatePos.addAssign(vec3(x, y, z));
				updateLifespan.subAssign(this.particleDecay);

				// If a color node is provided, use that - it receives the angle, speed and normalised (0 to 1) position
				if (this.colorNodeFn) {
					const updateColor = this.colorBuffer.element(instanceIndex);
					updateColor.assign(
						this.colorNodeFn(angle, speed, normalisedParticlePosition),
					);
				}
			}).Else(() => {
				const basePosition = this.basePositionBuffer.element(instanceIndex);
				updatePos.assign(basePosition.xyz);
				updateLifespan.assign(basePosition.w);
			});
		})().compute(this.particlesCount);

		// An `update` instance of the flow field function, run every frame when `updateFlowField` is set
		this._flowFieldUpdate = this.flowFieldFn({
			rows: this.rows,
			columns: this.columns,
			depth: this.depth,
			flowFieldBuffer: this.flowFieldBuffer,
			params: this.params,
		}).compute(this.FLOW_FIELD_SIZE);
	}

	_initMesh() {
		// As particles are only 1x1 pixels, we need a SpriteNodeMaterial to render larger particles
		this.material = new THREE.SpriteNodeMaterial({
			transparent: true,
			depthWrite: false,
			depthTest: false,
			blending: THREE.AdditiveBlending,
		});

		// Make the positionBuffer available to the shader as the positionNode
		this.material.positionNode = this.positionBuffer.toAttribute();
		this.material.scaleNode = this.scaleBuffer.toAttribute();
		this.material.colorNode = this.colorBuffer.toAttribute();

		this.material.opacityNode = this.opacityNodeFn
			? this.opacityNodeFn(this.opacityBuffer)
			: Fn(() => {
					const circle = uv().xy.sub(0.7).length().step(0.3);
					return circle.mul(this.opacityBuffer.toAttribute());
				})();

		// Create an instanced mesh to display the particles, this is required as part of THREE for fallback
		this.particlesMesh = new THREE.InstancedMesh(
			new THREE.PlaneGeometry(1, 1),
			this.material,
			this.particlesCount,
		);
		this.particlesMesh.frustumCulled = false;

		this._scene.add(this.particlesMesh);
	}

	async render() {
		super.render();

		await this._renderer.computeAsync(this.particlesUpdate);

		if (this.updateFlowField) {
			await this._renderer.computeAsync(this._flowFieldUpdate);
		}
	}

	dispose() {
		// Dispose buffers
		if (this.positionBuffer) {
			this.positionBuffer.dispose();
		}
		if (this.scaleBuffer) {
			this.scaleBuffer.dispose();
		}
		if (this.colorBuffer) {
			this.colorBuffer.dispose();
		}
		if (this.opacityBuffer) {
			this.opacityBuffer.dispose();
		}
		if (this.flowFieldBuffer) {
			this.flowFieldBuffer.dispose();
		}

		// Dispose compute shaders
		if (this.particlesUpdate) {
			this.particlesUpdate.dispose();
		}
		if (this._flowFieldUpdate) {
			this._flowFieldUpdate.dispose();
		}

		// Dispose particles mesh
		if (this.particlesMesh) {
			this.particlesMesh.geometry.dispose();
			this.particlesMesh.material.dispose();
		}

		// Call parent dispose
		super.dispose();
	}
}

export default FlowField;
