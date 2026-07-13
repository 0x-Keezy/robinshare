// web/scripts/_promo-capture.mjs — captura assets del teaser desde PROD
// Uso: cd web && node scripts/_promo-capture.mjs
import { chromium } from "playwright";

const URL = "https://robinshare.vercel.app/";
const OUT = "C:/Users/PC/Flap/promo/teaser-pinned/assets";
const VP = { width: 1920, height: 1080 };

const browser = await chromium.launch({ channel: "chrome" });

// 1) video del hero: el tape llenándose (12s)
const ctx = await browser.newContext({ viewport: VP, recordVideo: { dir: OUT, size: VP } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(2500);      // primer fill + block cargado
await page.waitForTimeout(12000);     // 12s de feed corriendo
const vid = page.video();
await ctx.close();                     // flushea el webm
console.log("video:", await vid.path());

// 2) stills de secciones /01 /02 /03 y stats (scroll dirigido)
// reducedMotion: "reduce" -> Stat.tsx (líneas 26-29) salta el count-up y
// pinta el valor final al instante. Son stills, no animaciones, así que
// no pierden nada visualmente; y evita la carrera 900ms-de-espera vs.
// 1100ms-de-duración del count-up que congelaba stats.png en 99/99 en vez
// de 100/100 (root cause del blocker de quality-gate).
const page2 = await browser.newPage({ viewport: VP, reducedMotion: "reduce" });
await page2.goto(URL, { waitUntil: "load" });
await page2.waitForTimeout(1500);
const beats = [
  ["sec-01", "/01"], ["sec-02", "/02"], ["sec-03", "/03"],
];
for (const [name, num] of beats) {
  const el = page2.locator(`text="${num}"`).first();
  // scrollIntoViewIfNeeded() no alcanza: si el elemento ya está parcialmente
  // visible desde el beat anterior no vuelve a scrollear, y las filas /02 //03
  // quedan cortadas o duplicadas. Forzamos centrado real en el viewport.
  await el.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
  await page2.waitForTimeout(900);    // reveals/animaciones asientan
  await page2.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot:", name);
}
const stats = page2.locator("text=Admin keys").first();
await stats.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
await page2.waitForTimeout(900);
await page2.screenshot({ path: `${OUT}/stats.png` });
console.log("shot: stats");
await browser.close();
