import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((e) => /^Check$/i.test((e.textContent || "").trim()));
  if (!btn) return "(no hay boton Check)";
  const s = getComputedStyle(btn);
  return { texto: btn.textContent.trim(), disabled: btn.disabled, bg: s.backgroundColor, color: s.color, border: s.borderColor, opacity: s.opacity };
}));
await b.close();
