import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
await p.waitForTimeout(2800);
const chicos = await p.evaluate(() => [...document.querySelectorAll("a,button,input")]
  .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 26), w: Math.round(r.width), h: Math.round(r.height), tap: el.className.includes("rs-tap") }; })
  .filter((e) => e.h > 0 && (e.h < 44 || e.w < 44)));
console.log("targets <44 sin rs-tap:", JSON.stringify(chicos.filter((c) => !c.tap)));
console.log("targets <44 CON rs-tap (cubiertos):", chicos.filter((c) => c.tap).length);
const inp = await p.evaluate(() => [...document.querySelectorAll("input")].map((e) => parseFloat(getComputedStyle(e).fontSize)));
console.log("font-size de inputs:", inp);
await b.close();
