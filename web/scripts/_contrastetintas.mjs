// Ningun control puede desaparecer en ninguna de las tres tintas: se mide el contraste REAL del
// segmentado activo y del CHECK en reposo contra el campo de la pagina.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
for (const t of ["lima", "rojo", "papel"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3077/v/tape${t === "lima" ? "" : "?tinta=" + t}`, { waitUntil: "load" });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2); };
    const campo = getComputedStyle(document.querySelector("main")).backgroundColor;
    const gh = [...document.querySelectorAll("button")].find((e) => /^GitHub$/i.test((e.textContent || "").trim()));
    const chk = [...document.querySelectorAll("button")].find((e) => /^Check$/i.test((e.textContent || "").trim()));
    return {
      campo,
      githubActivo: ratio(getComputedStyle(gh).backgroundColor, campo),
      checkBorde: ratio(getComputedStyle(chk).borderTopColor, campo),
      checkTexto: ratio(getComputedStyle(chk).color, campo),
    };
  });
  console.log(t.padEnd(6), JSON.stringify(r));
  await ctx.close();
}
await b.close();
