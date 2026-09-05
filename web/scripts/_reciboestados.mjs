// El recibo tiene que CRECER al imprimir: se mide su alto en los tres estados.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
async function alto(handle) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3077/v/tape", { waitUntil: "load" });
  await p.waitForTimeout(3000);
  const medir = () => p.evaluate(() => {
    const el = [...document.querySelectorAll(".tape-paper")].find((e) => /Set-aside/i.test(e.textContent || ""));
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  });
  const reposo = await medir();
  let res = null;
  if (handle) {
    await p.fill("#tape-lookup", handle);
    await p.getByRole("button", { name: /^Check$/ }).click();
    await p.waitForTimeout(4500);
    res = await p.evaluate(() => {
      const el = [...document.querySelectorAll(".tape-paper")].find((e) => /Set-aside/i.test(e.textContent || ""));
      return { h: Math.round(el.getBoundingClientRect().height), txt: (el.textContent || "").replace(/\s+/g, " ").slice(0, 150) };
    });
  }
  await ctx.close();
  return { reposo, res };
}
console.log("sin handle          ", JSON.stringify(await alto(null)));
console.log("handle SIN vault    ", JSON.stringify(await alto("ponsdotfamily")));
console.log("handle CON vault    ", JSON.stringify(await alto("0x-keezy")));
await b.close();
