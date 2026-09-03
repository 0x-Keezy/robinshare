import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: "reduce" })).newPage();
await p.goto("http://localhost:3077/", { waitUntil: "load" });
await p.waitForTimeout(2500);
await p.fill("#rs-lookup", "ponsdotfamily");
await p.getByText("Check balance", { exact: true }).click();
await p.waitForTimeout(4500);
const y = await p.evaluate(() => {
  const l = [...document.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "Set-aside deed");
  const c = l?.closest("section") ?? l?.parentElement; const r = c.getBoundingClientRect();
  return Math.max(0, window.scrollY + r.top - (window.innerHeight - r.height) / 2);
});
await p.evaluate((v) => window.scrollTo(0, v), y);
await p.waitForTimeout(1800);
await p.screenshot({ path: process.argv[2] });
console.log(await p.evaluate(() => {
  const l = [...document.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "Set-aside deed");
  return (l?.closest("section")?.textContent || "").replace(/\s+/g, " ").slice(0, 260);
}));
await b.close();
