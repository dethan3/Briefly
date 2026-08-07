import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(appDir, "../..");
const distDir = resolve(appDir, "dist");
const coreDist = resolve(rootDir, "packages/core/dist/index.js");

try {
  await stat(coreDist);
} catch {
  throw new Error("Missing packages/core/dist/index.js. Build @briefly/core before the extension.");
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await Promise.all([
  cp(resolve(appDir, "manifest.json"), resolve(distDir, "manifest.json")),
  cp(resolve(appDir, "src/content.js"), resolve(distDir, "content.js")),
  cp(resolve(appDir, "src/content.css"), resolve(distDir, "content.css")),
  cp(resolve(appDir, "src/page-bridge.js"), resolve(distDir, "page-bridge.js")),
  cp(resolve(appDir, "src/youtube.js"), resolve(distDir, "youtube.js")),
  cp(coreDist, resolve(distDir, "core.js")),
]);

console.log(`Built Briefly extension at ${distDir}`);
