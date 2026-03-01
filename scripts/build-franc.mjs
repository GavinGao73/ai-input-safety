import { build } from "esbuild";

async function run() {
  await build({
    entryPoints: ["scripts/franc-entry.js"],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    minify: true,
    sourcemap: false,
    outfile: "assets/vendor/franc-all.min.js"
  });

  console.log("[OK] built assets/vendor/franc-all.min.js");
}

run().catch((e) => {
  console.error("[FAIL] build franc bundle:", e);
  process.exit(1);
});
