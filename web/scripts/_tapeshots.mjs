import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: "chrome" });
for (const [tag, w, h, mobile] of [["desktop", 1440, 900, false], ["mobile", 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
  await p.waitForTimeout(3200);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (const [i, f] of [0, 0.2, 0.4, 0.6, 0.82].entries()) {
    await p.evaluate((y) => window.scrollTo(0, y), Math.round(H * f));
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/${tag}-${i}.png` });
  }
  await ctx.close();
}
// el wow: escribir un handle e imprimir el recibo
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
await p.waitForTimeout(3000);
await p.fill("#tape-lookup", "ponsdotfamily");
await p.getByRole("button", { name: /^Check$/ }).click();
await p.waitForTimeout(4500);
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/recibo-impreso.png` });
console.log("ok");
await b.close();
