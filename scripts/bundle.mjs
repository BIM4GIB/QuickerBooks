#!/usr/bin/env node
// Bundles the MCP server and CLI into single standalone .mjs files.
// Output: bundle/server.mjs, bundle/cli.mjs

import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("bundle", { recursive: true });

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: false,
  minify: false,          // keep readable for trust
  external: [],           // inline everything — zero runtime deps
};

await build({
  ...shared,
  entryPoints: ["src/index.ts"],
  outfile: "bundle/server.mjs",
});

await build({
  ...shared,
  entryPoints: ["src/cli.ts"],
  outfile: "bundle/cli.mjs",
});

console.log("Bundled: bundle/server.mjs, bundle/cli.mjs");
