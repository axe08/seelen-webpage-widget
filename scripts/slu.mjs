import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SLU = process.env.SLU_PATH ?? "C:\\Program Files\\Seelen\\Seelen UI\\slu.exe";
const action = process.argv[2];
if (action !== "load" && action !== "bundle") {
  console.error("usage: node scripts/slu.mjs <load|bundle>");
  process.exit(2);
}

const dist = resolve(import.meta.dirname, "..", "dist");
const result = spawnSync(SLU, ["resource", action, "widget", dist], { stdio: "inherit" });
if (result.error) {
  console.error(`failed to run ${SLU}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
