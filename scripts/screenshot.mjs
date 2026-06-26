#!/usr/bin/env node
/**
 * Headless screenshot helper for design iteration.
 *
 * Usage:
 *   node scripts/screenshot.mjs <url> <output.png> [--width 1440] [--height 900] [--wait 2500]
 *
 * Examples:
 *   node scripts/screenshot.mjs 'http://localhost:3000/?theme=ocean' /tmp/ocean.png
 *   node scripts/screenshot.mjs 'http://localhost:3000/lab/waves/' /tmp/lab.png --wait 3500
 *
 * Waits for the page to be `load` then sleeps `--wait` ms more so async chunks
 * (Three.js from CDN, font swap) settle before the snapshot.
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    width: { type: "string", default: "1440" },
    height: { type: "string", default: "900" },
    wait: { type: "string", default: "2500" },
  },
  allowPositionals: true,
});

const [url, outPath] = positionals;
if (!url || !outPath) {
  console.error(
    "Usage: node scripts/screenshot.mjs <url> <output.png> [--width N] [--height N] [--wait ms]",
  );
  process.exit(1);
}

const width = Number(values.width);
const height = Number(values.height);
const wait = Number(values.wait);

mkdirSync(dirname(outPath), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(wait);

await page.screenshot({ path: outPath, fullPage: false });

await browser.close();

// Print captured console (last 20 lines) so the caller sees errors
const tail = logs.slice(-20);
if (tail.length) {
  console.error("--- browser console ---");
  for (const line of tail) console.error(line);
}
console.log(`saved: ${outPath} (${width}x${height})`);
