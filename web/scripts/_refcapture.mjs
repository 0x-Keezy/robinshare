// Captura una referencia externa a varias profundidades de scroll, desktop + mobile.
// Los boards de referencia SON el diseño: sin mirarlos no se decide nada.
import { chromium } from "playwright";
import fs from "node:fs";
const URL = process.argv[2];
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: "chrome" });
for (const [tag, w, h, mobile] of [["desktop", 1440, 900, false], ["mobile", 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(5000);
  const meta = await p.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const fonts = new Set();
    document.querySelectorAll("h1,h2,h3,p,a,button,span,div").forEach((e) => {
      const f = getComputedStyle(e).fontFamily;
      if (f) fonts.add(f.split(",")[0].replace(/["']/g, "").trim());
    });
    const colors = {};
    document.querySelectorAll("*").forEach((e) => {
      const s = getComputedStyle(e);
      for (const k of ["color", "backgroundColor", "borderTopColor"]) {
        const v = s[k];
        if (v && v !== "rgba(0, 0, 0, 0)" && v !== "rgb(0, 0, 0)") colors[v] = (colors[v] || 0) + 1;
      }
    });
    const top = Object.entries(colors).sort((a, c) => c[1] - a[1]).slice(0, 14);
    return {
      title: document.title,
      bodyBg: cs.backgroundColor,
      bodyFont: cs.fontFamily,
      fonts: [...fonts].slice(0, 12),
      colores: top,
      h1: [...document.querySelectorAll("h1")].map((e) => ({ t: e.textContent.trim().slice(0, 90), fs: getComputedStyle(e).fontSize, ff: getComputedStyle(e).fontFamily.split(",")[0], w: getComputedStyle(e).fontWeight, ls: getComputedStyle(e).letterSpacing })),
      h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim().slice(0, 70)).slice(0, 12),
      scrollH: document.documentElement.scrollHeight,
      secciones: [...document.querySelectorAll("section,main>div")].length,
      textoTotal: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 2600),
    };
  });
  if (tag === "desktop") fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));
  const H = meta.scrollH;
  const paradas = [0, 0.18, 0.36, 0.54, 0.72, 0.9];
  for (let i = 0; i < paradas.length; i++) {
    await p.evaluate((y) => window.scrollTo(0, y), Math.round(H * paradas[i]));
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${OUT}/${tag}-${i}.png` });
  }
  console.log(tag, "scrollH", H, "secciones", meta.secciones);
  await ctx.close();
}
await b.close();
