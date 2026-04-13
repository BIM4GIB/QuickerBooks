#!/usr/bin/env node
import puppeteer from "puppeteer";
import { resolve } from "node:path";

const html = resolve("onepager.html");
const out = resolve("Claude_x_QuickBooks.pdf");

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`file://${html}`, { waitUntil: "networkidle0" });
await page.pdf({
  path: out,
  format: "Letter",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log(`PDF saved: ${out}`);
