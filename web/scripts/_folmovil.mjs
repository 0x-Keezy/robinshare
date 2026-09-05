// Que entra en el primer viewport de un telefono, medido. El orden del hero cambio dos veces en
// esta direccion y las dos veces movio algo fuera del fold sin que nadie lo notara.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const y = (el) => (el ? Math.round(el.getBoundingClientRect().top) : null);
  const q = (sel, re) => [...document.querySelectorAll(sel)].find((e) => re.test((e.textContent || e.placeholder || "").trim()));
  return {
    viewport: innerHeight,
    h1: y(document.querySelector("h1")),
    cta: y(q("a", /^Launch a coin/)),
    rotulo: y(q("div", /^Or someone may have launched/)),
    input: y(document.querySelector("#tape-lookup")),
    recibo: y(document.querySelector(".tape-paper")),
    talon: y(document.querySelectorAll(".tape-paper")[1]),
    altoTotal: document.documentElement.scrollHeight,
  };
}));
await b.close();
