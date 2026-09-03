import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
for (const route of ["/", "/create", "/claim/0x000000000000000000000000000000000000dEaD"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3077" + route, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")].map((el) => {
    const st = getComputedStyle(el); const bx = el.getBoundingClientRect();
    return { ph: el.placeholder || el.name || el.type, fs: +parseFloat(st.fontSize).toFixed(1), h: Math.round(bx.height), w: Math.round(bx.width) };
  }));
  console.log(route, JSON.stringify(r));
  await ctx.close();
}
await b.close();
