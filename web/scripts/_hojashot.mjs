import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" })).newPage();
await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
await p.waitForTimeout(3000);
const y = await p.evaluate(() => {
  const el = [...document.querySelectorAll("section")].find((e) => /disclosure sheet/i.test(e.textContent || ""));
  return el ? window.scrollY + el.getBoundingClientRect().top - 20 : 0;
});
await p.evaluate((v) => window.scrollTo(0, v), y);
await p.waitForTimeout(1200);
await p.screenshot({ path: process.argv[2] });
console.log(await p.evaluate(() => {
  const el = [...document.querySelectorAll("section")].find((e) => /disclosure sheet/i.test(e.textContent || ""));
  const grid = el.querySelector(".grid");
  return [...grid.children].map((c) => { const r = c.getBoundingClientRect(); return { t: (c.textContent||"").slice(0,18), x: Math.round(r.x), y: Math.round(r.y) }; });
}));
await b.close();
