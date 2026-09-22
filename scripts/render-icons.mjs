#!/usr/bin/env node
/**
 * Render public/icon.svg to the PNG sizes operating systems actually use.
 *
 * Windows builds the Start-menu and taskbar icon of an installed web app from
 * the manifest's PNGs; given only an SVG it falls back to a blurry or generic
 * one. Run this after changing icon.svg:
 *
 *   node scripts/render-icons.mjs
 *
 * The "maskable" variant pads the artwork into the safe zone so a round or
 * squircle mask never clips the letter.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { chromium } = await import("playwright-core");
const svg = readFileSync(join("public", "icon.svg"), "utf8");
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage();

async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // A maskable icon is cropped by the OS to a circle or squircle, so it must be
  // full-bleed: square corners, colour to every edge. The letter already sits
  // well inside the central 80% safe zone.
  const art = maskable ? svg.replace(/ rx="\d+"/, "") : svg;
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px">
       ${art.replace("<svg ", `<svg style="display:block;width:${size}px;height:${size}px" `)}
     </body></html>`,
  );
  await page.screenshot({ path: join("public", file), omitBackground: !maskable });
  console.log("wrote public/" + file);
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(512, "icon-maskable-512.png", { maskable: true });
await render(180, "apple-touch-icon.png");

// Windows shortcuts (.lnk) take an .ico, not a PNG. An .ico may carry PNG
// images directly (Windows Vista and later), so render the sizes Explorer and
// the taskbar ask for and pack them: a 6-byte header, a 16-byte directory
// entry per image, then the PNG bytes.
const icoSizes = [16, 24, 32, 48, 64, 256];
const pngs = [];
for (const size of icoSizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0">${svg.replace("<svg ", `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`,
  );
  pngs.push(await page.screenshot({ omitBackground: true }));
}
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngs.length, 4);
const dir = Buffer.alloc(16 * pngs.length);
let offset = header.length + dir.length;
pngs.forEach((png, i) => {
  const size = icoSizes[i];
  const e = i * 16;
  dir.writeUInt8(size >= 256 ? 0 : size, e); // 0 means 256
  dir.writeUInt8(size >= 256 ? 0 : size, e + 1);
  dir.writeUInt8(0, e + 2); // palette colours
  dir.writeUInt8(0, e + 3); // reserved
  dir.writeUInt16LE(1, e + 4); // colour planes
  dir.writeUInt16LE(32, e + 6); // bits per pixel
  dir.writeUInt32LE(png.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
writeFileSync(join("public", "icon.ico"), Buffer.concat([header, dir, ...pngs]));
console.log("wrote public/icon.ico (" + icoSizes.join(", ") + ")");
await browser.close();
