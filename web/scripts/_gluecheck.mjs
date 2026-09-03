// Caza espacios comidos por el compilador de JSX: un tag de cierre pegado a la palabra
// siguiente (o una palabra pegada a un tag de apertura) en el HTML ya renderizado.
import { chromium } from "playwright";
const routes = ["/", "/create", "/docs", "/claim/0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3"];
const b = await chromium.launch({ channel: "chrome" });
let bad = 0;
for (const r of routes) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.goto("http://localhost:3077" + r, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  // también hay que abrir la variante wallet de /create
  if (r === "/create") {
    await p.evaluate(() => { const x = [...document.querySelectorAll("button")].find((e) => (e.textContent || "").trim().toUpperCase() === "WALLET"); x?.click(); });
    await p.waitForTimeout(400);
  }
  const hits = await p.evaluate(() => {
    const html = document.body.innerHTML.replace(/<!--\s*-->/g, "");
    const out = [];
    const re = /(<\/(?:strong|a|span|em|code|b|i)>)([a-zA-Z])|([a-zA-Z])(<(?:strong|a|span|em|code|b|i)[ >])/g;
    let m;
    while ((m = re.exec(html))) out.push(html.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, " "));
    return out;
  });
  // filtrar los legítimos: puntuación pegada es normal, acá sólo miramos letra pegada a tag
  if (hits.length) { bad += hits.length; console.log(`\n### ${r} — ${hits.length} sospechas`); hits.forEach((h) => console.log("  " + h)); }
  else console.log(`### ${r} — limpio`);
}
console.log(bad ? `\n${bad} sospechas totales` : "\nsin espacios comidos");
await b.close();
