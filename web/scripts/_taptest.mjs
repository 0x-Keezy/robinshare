// ¿El area tactil REAL llega a 44px? Se prueba con elementFromPoint, no midiendo la caja:
// `.rs-tap` agranda la zona con un pseudo-elemento, que no aparece en getBoundingClientRect.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
async function probe(route, sel, label) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3077" + route, { waitUntil: "load" });
  await p.waitForTimeout(2200);
  const r = await p.evaluate(({ sel, label }) => {
    const el = [...document.querySelectorAll(sel)].find((e) => new RegExp(label, "i").test((e.textContent || e.getAttribute("aria-label") || "")));
    if (!el) return "(no encontrado)";
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // ¿hasta dónde arriba/abajo sigue respondiendo el control?
    const hits = (dy) => { const t = document.elementFromPoint(cx, cy + dy); return !!t && (t === el || el.contains(t) || t.parentElement === el); };
    let up = 0, dn = 0;
    for (let d = 1; d <= 40; d++) { if (hits(-d)) up = d; else break; }
    for (let d = 1; d <= 40; d++) { if (hits(d)) dn = d; else break; }
    return { box: `${Math.round(r.width)}x${Math.round(r.height)}`, altoTactil: up + dn + 1 };
  }, { sel, label });
  console.log(`${route} ${label}:`, JSON.stringify(r));
  await ctx.close();
}
await probe("/", "button", "Copy");
await probe("/", "button", "GitHub");
await probe("/", "button", "Switch to");
await probe("/create", "button", "^3%$");
await probe("/claim/0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3", "a", "All vaults");
await b.close();
