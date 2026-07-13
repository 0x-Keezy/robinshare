// Chequeo de overflow horizontal: rutas x viewports. Falla si scrollWidth > clientWidth.
import { chromium } from "playwright";

const routes = ["/", "/create", "/claim/0x000000000000000000000000000000000000dEaD"];
const sizes = [[360, 740], [414, 896], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]];

const browser = await chromium.launch();
let bad = 0;
for (const route of routes) {
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (overflow > 0) {
      bad++;
      console.log(`FAIL ${route} @ ${w}x${h}: overflow ${overflow}px`);
    }
    await page.close();
  }
}
console.log(bad === 0 ? "OK: sin overflow horizontal en ninguna ruta/tamaño" : `${bad} fallos`);
await browser.close();
