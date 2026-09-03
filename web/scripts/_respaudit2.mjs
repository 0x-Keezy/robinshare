// Pasada 2: landscape de teléfono, anchos extra, tema claro y movimiento normal.
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3077";
const outDir = process.argv[3] ?? "./_respshots2";
fs.mkdirSync(outDir, { recursive: true });

const cases = [
  // landscape de teléfono (lo que rompe en la vida real)
  { tag: "land-667x375", w: 667, h: 375, route: "/", mobile: true },
  { tag: "land-844x390", w: 844, h: 390, route: "/", mobile: true },
  { tag: "land-932x430", w: 932, h: 430, route: "/", mobile: true },
  { tag: "land-844x390-create", w: 844, h: 390, route: "/create", mobile: true },
  // anchos de laptop reales
  { tag: "1366", w: 1366, h: 768, route: "/" },
  { tag: "1536", w: 1536, h: 864, route: "/" },
  // el escalón feo entre 834 y 1024
  { tag: "900", w: 900, h: 1200, route: "/" },
  { tag: "960", w: 960, h: 1200, route: "/" },
  { tag: "640", w: 640, h: 960, route: "/" },
  { tag: "700", w: 700, h: 1000, route: "/" },
  // tema claro
  { tag: "light-390", w: 390, h: 844, route: "/", mobile: true, light: true },
  { tag: "light-1440", w: 1440, h: 900, route: "/", light: true },
  { tag: "light-768", w: 768, h: 1024, route: "/", light: true },
  { tag: "light-390-create", w: 390, h: 844, route: "/create", mobile: true, light: true },
  { tag: "light-390-claim", w: 390, h: 844, route: "/claim/0x000000000000000000000000000000000000dEaD", mobile: true, light: true },
  // movimiento normal (sin reduced-motion): ¿queda contenido invisible?
  { tag: "motion-390", w: 390, h: 844, route: "/", mobile: true, motion: "no-preference" },
  { tag: "motion-1440", w: 1440, h: 900, route: "/", motion: "no-preference" },
  // zoom del sistema: 200% de texto equivale a viewport chico con fuente grande
  { tag: "zoom200-1280", w: 1280, h: 800, route: "/", zoom: 2 },
];

const browser = await chromium.launch({ channel: "chrome" });
const out = [];
for (const c of cases) {
  const ctx = await browser.newContext({
    viewport: { width: c.w, height: c.h },
    isMobile: !!c.mobile,
    hasTouch: !!c.mobile,
    reducedMotion: c.motion ?? "reduce",
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  if (c.light) await page.addInitScript(() => localStorage.setItem("robinshare-theme", "light"));
  if (c.zoom) await page.addInitScript(() => { document.documentElement.style.fontSize = "32px"; });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`${base}${c.route}`, { waitUntil: "load" });
  await page.waitForTimeout(1600);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    // ¿hay contenido invisible? (opacity 0 en bloques grandes)
    const hidden = [...document.querySelectorAll("section, article, div")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.height < 60 || r.width < 60) return false;
        if (r.top > innerHeight || r.bottom < 0) return false;
        const st = getComputedStyle(el);
        return parseFloat(st.opacity) < 0.05 && (el.textContent || "").trim().length > 20;
      })
      .map((el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50));
    return {
      overflow: de.scrollWidth - de.clientWidth,
      scrollHeight: de.scrollHeight,
      hiddenBlocks: hidden.slice(0, 6),
      theme: de.getAttribute("data-robinshare-theme"),
    };
  });
  await page.screenshot({ path: `${outDir}/${c.tag}-top.png` });
  await page.evaluate(() => window.scrollTo(0, innerHeight * 1.6));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${c.tag}-s2.png` });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${c.tag}-bot.png` });
  console.log(c.tag, JSON.stringify({ ...m, errs: errs.slice(0, 2) }));
  out.push({ ...c, ...m, errs });
  await ctx.close();
}
fs.writeFileSync(`${outDir}/report2.json`, JSON.stringify(out, null, 2));
await browser.close();
