import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [resolve(root, "src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: resolve(dist, "index.js"),
  sourcemap: "inline",
  minify: false,
  logLevel: "info",
});

for (const name of ["metadata.yml", "index.html", "index.css"]) {
  cpSync(resolve(root, name), resolve(dist, name));
}

console.log("build complete ->", dist);
