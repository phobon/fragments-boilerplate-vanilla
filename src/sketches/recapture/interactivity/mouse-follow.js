import { Fn, remap, uniform, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";
import WebGPUShader from "@/components/shader/webgpu_shader";

// For simplicity, we'll update a TSL uniform
const pointerUniform = uniform(new THREE.Vector2(0, 0));

const handleMouseMove = (e) => {
	// Normalize to a -1 to 1 range, matching R3F's pointer
	const x = (e.clientX / window.innerWidth) * 2 - 1;
	const y = -(e.clientY / window.innerHeight) * 2 + 1; // Flip Y for shader space

	pointerUniform.value.x = x;
	pointerUniform.value.y = y;
};

// Use a mouse event attached to the container of the canvas (or the window)
window.addEventListener("mousemove", handleMouseMove);

// Use this uniform somewhere in your shader...
const pointerFollow = Fn(() => {
	const x = remap(pointerUniform.x, -1, 1, 0, 1);
	const y = remap(pointerUniform.y, -1, 1, 0, 1);
	return vec3(x, y, 0).toVar();
});

// In the fragments-boilerplate-vanilla project, pass the node to a WebGPUShader as the sketch's default export
const canvas = document.querySelector("#webgpu-canvas");
export default new WebGPUShader(canvas, pointerFollow());
