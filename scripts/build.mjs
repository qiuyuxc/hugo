import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ASTRO = resolve(ROOT, "prototypes/astro-blog");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const preview = (process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== "master")
  || (process.env.CONTEXT && process.env.CONTEXT !== "production")
  || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production");
const env = { ...process.env, PUBLIC_SITE_RELEASE: preview ? "0" : "1" };

function run(label, args) {
  const result = spawnSync(npm, args, { cwd: ASTRO, stdio: "inherit", env });
  if (result.error || result.status !== 0) {
    console.error(`[build:astro] ${label} failed:`, result.error?.message || `exit ${result.status}`);
    process.exit(result.status || 1);
  }
}

console.log("[build:astro] Installing the Astro project's locked dependencies");
run("install", ["ci", "--no-audit", "--no-fund"]);
console.log("[build:astro] Building the website into public/");
run("build", ["run", "build", "--", "--outDir", resolve(ROOT, "public")]);
