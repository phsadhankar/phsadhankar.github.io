// Renders a still of every simulation (in ?embed mode) for the plates on the home page.
//
//   npm i puppeteer-core          (anywhere node can resolve it)
//   node tools/posters.mjs [slug ...]
//
// Needs Microsoft Edge or Chrome; set BROWSER to override the path.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "assets", "posters");
fs.mkdirSync(out, { recursive: true });

const browserPath =
    process.env.BROWSER ||
    [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ].find((p) => fs.existsSync(p));

const only = process.argv.slice(2);
const slugs = fs
    .readdirSync(path.join(root, "pages"))
    .filter((f) => f.endsWith(".html") && f !== "home.html")
    .map((f) => f.replace(".html", ""))
    .filter((s) => !only.length || only.includes(s));

const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new" });

for (const slug of slugs) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(pathToFileURL(path.join(root, "pages", slug + ".html")).href + "?embed");
    await new Promise((r) => setTimeout(r, 6000));
    const file = path.join(out, slug + ".jpg");
    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    await page.close();
    console.log(slug, Math.round(fs.statSync(file).size / 1024) + " KB");
}

await browser.close();
