import fs from "fs";
import path from "path";
import { defineConfig } from "vite";

/**
 * Dev-only endpoint that writes captures straight to disk instead of going through browser downloads.
 * Used when the page is opened with `?capture=disk` (see src/main.js). Files land in ./captures
 */
const captureToDisk = () => ({
	name: "capture-to-disk",
	apply: "serve",
	configureServer(server) {
		server.middlewares.use("/__capture", (req, res) => {
			if (req.method !== "POST") {
				res.statusCode = 405;
				res.end();
				return;
			}

			const url = new URL(req.url ?? "", "http://localhost");
			const fileName = path.basename(url.searchParams.get("name") ?? "");
			if (!/^[\w.-]+\.(png|mp4|webm)$/.test(fileName)) {
				res.statusCode = 400;
				res.end("Invalid file name");
				return;
			}

			const dir = path.resolve(__dirname, "captures");
			fs.mkdirSync(dir, { recursive: true });

			const chunks = [];
			req.on("data", (chunk) => chunks.push(chunk));
			req.on("end", () => {
				fs.writeFileSync(path.join(dir, fileName), Buffer.concat(chunks));
				res.statusCode = 201;
				res.end(fileName);
			});
		});
	},
});

// https://vitejs.dev/config/
export default defineConfig({
	optimizeDeps: {
		esbuildOptions: {
			target: "esnext",
		},
	},
	build: {
		target: "esnext",
	},
	plugins: [captureToDisk()],
	resolve: {
		alias: {
			"@/sketches": path.resolve(__dirname, "src/sketches"),
			"@/tsl": path.resolve(__dirname, "src/tsl"),
			"@/components": path.resolve(__dirname, "src/components"),
			"@/utils": path.resolve(__dirname, "src/utils"),
		},
	},
});
