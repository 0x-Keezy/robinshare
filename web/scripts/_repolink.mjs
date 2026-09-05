// El link al repo esta en el pie de la pagina de produccion: se verifica en el HTML renderizado,
// no en el archivo fuente.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
for (const r of ["/", "/docs", "/v/tape"]) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
  await p.goto("http://localhost:3077" + r, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  const links = await p.evaluate(() =>
    [...document.querySelectorAll('a[href*="github.com"]')].map((a) => ({ txt: (a.textContent || "").trim().slice(0, 26), href: a.href })),
  );
  console.log(r.padEnd(10), JSON.stringify(links));
}
await b.close();
