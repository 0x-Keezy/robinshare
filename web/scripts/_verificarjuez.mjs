// Verificar hallazgos del juez con numeros, no con opinion.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
await p.waitForTimeout(3000);

// 1 · el sustrato: ¿existe la capa y cuanta varianza mete de verdad?
const sustrato = await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector("main"), "::before");
  return { position: cs.position, tieneImagen: cs.backgroundImage !== "none", capas: (cs.backgroundImage.match(/url\(|gradient\(/g) || []).length };
});
console.log("1 sustrato :", JSON.stringify(sustrato));

// 5 · el antialiasing
const aa = await p.evaluate(() => getComputedStyle(document.querySelector("main")).webkitFontSmoothing);
console.log("5 antialias:", aa);

// 2 · tamanos reales en la hoja de riesgo
const hoja = await p.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find((e) => /disclosure sheet/i.test(e.textContent || ""));
  const h2 = sec.querySelector("h2");
  const rojo = [...sec.querySelectorAll("p")].find((e) => /has not been audited/i.test(e.textContent || ""));
  const px = (e) => Math.round(parseFloat(getComputedStyle(e).fontSize));
  return { h2: px(h2), rojo: px(rojo) };
});
console.log("2 hoja     :", JSON.stringify(hoja), "→ el rojo debe ser MAYOR");

// 4 · las labels de la banda de cifras: ¿wrapean?
const labels = await p.evaluate(() => {
  const banda = [...document.querySelectorAll("section")].find((e) => /of every trade, to them/i.test(e.textContent || ""));
  return [...banda.querySelectorAll(".grid > div")].map((c) => {
    const l = c.lastElementChild;
    const r = l.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(l).lineHeight);
    return { t: l.textContent.trim().slice(0, 22), lineas: Math.round(r.height / lh), anchoLabel: Math.round(r.width), anchoCelda: Math.round(c.getBoundingClientRect().width) };
  });
});
console.log("4 labels   :", JSON.stringify(labels));
await ctx.close();

// P0-2 · el fold del telefono
const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const p2 = await c2.newPage();
await p2.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
await p2.waitForTimeout(2800);
console.log("P0-2 fold  :", JSON.stringify(await p2.evaluate(() => {
  const y = (e) => (e ? Math.round(e.getBoundingClientRect().top) : null);
  const rot = [...document.querySelectorAll("div")].find((e) => /^Or someone may have launched/.test((e.textContent||"").trim()));
  const rec = document.querySelector(".tape-paper");
  return { viewport: innerHeight, recibo: y(rec), finRecibo: rec ? Math.round(rec.getBoundingClientRect().bottom) : null, rotulo: y(rot), input: y(document.querySelector("#tape-lookup")) };
})));
await b.close();
