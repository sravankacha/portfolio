#!/usr/bin/env node
/**
 * Render scripts/resume.html to public/resume.pdf using Playwright/Chromium.
 *
 * Usage: node scripts/build-resume-pdf.mjs
 *
 * Edit scripts/resume.html and re-run to regenerate the PDF. The portfolio's
 * /resume page links to /resume.pdf so commit the file when shipping.
 */

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, "resume.html");
const outPath = join(__dirname, "..", "public", "resume.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
// Tiny extra wait for web fonts to settle
await page.waitForTimeout(800);
await page.pdf({
  path: outPath,
  format: "Letter",
  printBackground: true,
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
  preferCSSPageSize: false,
});
await browser.close();
console.log(`wrote ${outPath}`);
