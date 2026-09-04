import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await ctx.newPage();
await p.goto("http://localhost:3077/v/compare", { waitUntil: "load" });
await p.waitForTimeout(6000);
await p.screenshot({ path: `${OUT}/compare-desktop.png` });

// scroll dentro del iframe izquierdo: el derecho tiene que seguirlo por fraccion
const antes = await p.evaluate(() => {
  const f = document.querySelectorAll("iframe");
  return [...f].map((x) => x.contentWindow.scrollY);
});
await p.evaluate(() => {
  const f = document.querySelectorAll("iframe")[0];
  const d = f.contentWindow.document.documentElement;
  f.contentWindow.scrollTo(0, (d.scrollHeight - d.clientHeight) * 0.45);
});
await p.waitForTimeout(1600);
const despues = await p.evaluate(() => {
  const f = document.querySelectorAll("iframe");
  return [...f].map((x) => {
    const d = x.contentWindow.document.documentElement;
    const rec = d.scrollHeight - d.clientHeight;
    return { y: Math.round(x.contentWindow.scrollY), frac: rec > 0 ? +(x.contentWindow.scrollY / rec).toFixed(3) : 0 };
  });
});
console.log("antes:", JSON.stringify(antes), "-> despues:", JSON.stringify(despues));
await p.screenshot({ path: `${OUT}/compare-scrolled.png` });

// modo telefono
await p.getByRole("button", { name: "Teléfono" }).click();
await p.waitForTimeout(5000);
await p.screenshot({ path: `${OUT}/compare-mobile.png` });
console.log("ok");
await b.close();
