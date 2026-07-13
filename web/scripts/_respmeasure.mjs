// Medición responsive: ancho real de "AUTOMATICALLY." y min-content del panel del tape
// en distintos viewports. Uso: node scripts/_respmeasure.mjs [url]
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const sizes = [
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];

const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const span = h1?.querySelector("span");
    const fontSize = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
    // ancho de la palabra sin quebrar: medir el span en un clon suelto
    let wordW = 0;
    if (span) {
      const c = span.cloneNode(true);
      c.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit";
      h1.appendChild(c);
      wordW = c.getBoundingClientRect().width;
      c.remove();
    }
    // panel del tape = el div redondeado que contiene robinshare://tape
    const label = [...document.querySelectorAll("span")].find((s) => s.textContent === "robinshare://tape");
    const panel = label?.closest(".rounded-2xl");
    let panelRect = null, panelMin = 0;
    if (panel) {
      panelRect = panel.getBoundingClientRect().toJSON();
      const prev = panel.style.width;
      panel.style.width = "min-content";
      panelMin = panel.getBoundingClientRect().width;
      panel.style.width = prev;
    }
    const section = h1?.closest("section");
    const sec = section?.getBoundingClientRect().toJSON();
    return {
      fontSize,
      wordW: Math.round(wordW),
      ratio: fontSize ? (wordW / fontSize).toFixed(3) : 0,
      panelMin: Math.round(panelMin),
      panelRight: panelRect ? Math.round(panelRect.right) : null,
      panelW: panelRect ? Math.round(panelRect.width) : null,
      secContentW: sec ? Math.round(sec.width - 48) : null,
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  console.log(`${w}x${h}`, JSON.stringify(data));
  await page.close();
}
await browser.close();
