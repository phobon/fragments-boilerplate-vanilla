import { convertToTexture, pass, uniform, vec4 } from "three/tsl";
import {
	MirroredRepeatWrapping,
	RenderPipeline,
	RepeatWrapping,
	Vector2,
} from "three/webgpu";
import { feedbackTrailsEffect } from "@/tsl/post_processing/feedback_trails_effect";

const isVec2Arg = (value) =>
	value != null &&
	typeof value === "object" &&
	typeof value.x === "number" &&
	typeof value.y === "number";

const applyTextureWrap = (textureNode, wrap) => {
	if (!textureNode.value) return;

	if (wrap === "repeat") {
		textureNode.value.wrapS = RepeatWrapping;
		textureNode.value.wrapT = RepeatWrapping;
	} else if (wrap === "mirror") {
		textureNode.value.wrapS = MirroredRepeatWrapping;
		textureNode.value.wrapT = MirroredRepeatWrapping;
	}
};

/**
 * Chains post-processing effects over a scene: scene -> layers[0] -> layers[1] -> ... -> screen.
 *
 * Each layer is `{ effect, args?, wrap? }`, where `effect` is a TSL post-processing Fn from
 * `@/tsl/post_processing/*` (called as `effect({ input, ...args })`). Numeric and `{ x, y }` args
 * are promoted to uniforms, so `setArgs` updates them without recompiling the pipeline.
 *
 * `feedbackTrailsEffect` is not supported (it needs a history ping-pong).
 */
class PostProcessing {
	constructor(renderer, scene, camera, layers = []) {
		this._renderer = renderer;
		this._uniforms = [];

		if (layers.some((layer) => layer.effect === feedbackTrailsEffect)) {
			console.warn(
				"PostProcessing: feedbackTrailsEffect is not supported and will be skipped",
			);
		}

		const scenePass = pass(scene, camera);
		let node = scenePass.getTextureNode("output");

		const activeLayers = layers.filter(
			(layer) => layer.effect !== feedbackTrailsEffect,
		);

		activeLayers.forEach((layer, index) => {
			applyTextureWrap(node, layer.wrap);

			const uniforms = {};
			const effectArgs = {};
			for (const [name, value] of Object.entries(layer.args ?? {})) {
				if (typeof value === "number") {
					uniforms[name] = uniform(value);
					effectArgs[name] = uniforms[name];
				} else if (isVec2Arg(value)) {
					uniforms[name] = uniform(new Vector2(value.x, value.y));
					effectArgs[name] = uniforms[name];
				} else {
					effectArgs[name] = value;
				}
			}
			this._uniforms.push(uniforms);

			const colorNode = layer.effect({ input: node, ...effectArgs });
			node =
				index === activeLayers.length - 1
					? colorNode
					: convertToTexture(colorNode);
		});

		this._pipeline = new RenderPipeline(renderer);
		// Flatten alpha so a transparent sketch doesn't wash out against the page
		this._pipeline.outputNode = vec4(node.rgb, 1);
	}

	/**
	 * Updates a layer's numeric / vec2 args in place (no rebuild).
	 * @param {number} index - Layer index as passed to the constructor
	 * @param {Object} args - e.g. `{ amount: 1.1 }`
	 */
	setArgs(index, args) {
		const uniforms = this._uniforms[index];
		if (!uniforms) return;

		for (const [name, value] of Object.entries(args)) {
			const node = uniforms[name];
			if (!node) continue;

			if (typeof value === "number") {
				node.value = value;
			} else if (isVec2Arg(value) && node.value instanceof Vector2) {
				node.value.set(value.x, value.y);
			}
		}
	}

	render() {
		this._pipeline.render();
	}

	dispose() {
		this._pipeline.dispose();
		this._pipeline = null;
		this._uniforms = [];
	}
}

export default PostProcessing;
