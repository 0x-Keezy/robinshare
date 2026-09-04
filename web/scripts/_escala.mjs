import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await p.goto("http://localhost:3077/v/compare", { waitUntil: "load" });
await p.waitForTimeout(5000);
console.log(await p.evaluate(() => {
  const caja = document.querySelectorAll("section > div.overflow-hidden")[0];
  const ifr = document.querySelectorAll("iframe")[0];
  const cs = getComputedStyle(ifr);
  return {
    cajaW: caja?.clientWidth,
    iframeLayoutW: ifr.getBoundingClientRect().width,
    transform: cs.transform,
    styleWidth: ifr.style.width,
  };
}));
await b.close();
