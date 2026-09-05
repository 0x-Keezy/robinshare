// Que ve HOY un visitante en el dominio vs lo que sirve la rama. Se prueba el defecto que mas
// importa para un lanzamiento en X: el nav fijo al subir el scroll en telefono.
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: "chrome" });
for (const [tag, url] of [["vivo", "https://www.robinshareapp.com/"], ["rama", "http://localhost:3077/"]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${OUT}/${tag}-fold.png` });
  // el estado que rompia: bajar y volver a subir hace reaparecer el nav sobre el contenido
  await p.evaluate(() => window.scrollTo(0, 900));
  await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, 420));
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${tag}-nav.png`, clip: { x: 0, y: 0, width: 390, height: 200 } });
  const m = await p.evaluate(() => {
    const nav = document.querySelector("nav");
    const nb = nav.getBoundingClientRect();
    const dentro = [...document.querySelectorAll("a,button")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.top < nb.bottom && r.bottom > nb.top && !nav.contains(el);
    }).map((el) => (el.textContent || "").trim().slice(0, 20));
    return { navAlto: Math.round(nb.height), contenidoBajoElNav: dentro, docs: !!document.querySelector('a[href="/docs"]') };
  });
  console.log(tag.padEnd(5), JSON.stringify(m));
  await ctx.close();
}
await b.close();
