// web/scripts/_promo-capture.mjs — captura VIDEO de la web en movimiento (beat 3 del teaser)
// Uso: cd web && node scripts/_promo-capture.mjs
//
// Reemplaza el tramo plano (stills) del beat 3 por dos clips reales:
//   1) beat3-widget.webm — el widget interactivo del hero: tipeo del handle +
//      el feed llenando SU vault + el contador subiendo (producto vivo).
//   2) beat3-scroll.webm — scroll cinematográfico por las filas /01 /02 /03
//      con los Reveal (fade+rise+un-blur) disparando en vivo.
//
// Sin reducedMotion en ambos contextos: el feed, los count-ups (Stat.tsx) y
// los Reveal (Reveal.tsx) dependen de CSS transitions / JS timers que
// `reducedMotion: "reduce"` apaga o salta al valor final — necesitamos verlos
// EN MOVIMIENTO, no el still congelado (eso es lo que hacía el código viejo,
// ver el bloque comentado al final).
import { chromium } from "playwright";
import fs from "node:fs";

const URL = "https://robinshare.vercel.app/";
const OUT = "C:/Users/PC/Flap/promo/teaser-pinned/assets";
const VP = { width: 1920, height: 1080 };

const browser = await chromium.launch({ channel: "chrome" });

// ---------------------------------------------------------------------------
// Captura 1 — beat3-widget.webm: tipeo del handle + feed + contador
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: VP, recordVideo: { dir: OUT, size: VP } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(2500); // hidratación + primer block del RPC (dato vivo)

  const input = page.locator('input[placeholder="your-handle"]');
  await input.click();
  await input.type("arlo_dev", { delay: 55 }); // tipeo visible, ~500ms para 8 chars

  await page.waitForTimeout(9000); // 4-5 fills del feed (interval 2200ms) + contador subiendo

  // medir coords ANTES de cerrar el contexto (cerrar destruye la page)
  const inputBox = await input.boundingBox();
  const panelBox = await page.evaluate(() => {
    // el panel = el contenedor redondeado que envuelve el label "robinshare://tape"
    // (mismo patrón probado en scripts/_respmeasure.mjs)
    const label = [...document.querySelectorAll("span")].find(
      (s) => s.textContent === "robinshare://tape",
    );
    const panel = label?.closest(".rounded-2xl");
    return panel ? panel.getBoundingClientRect().toJSON() : null;
  });

  const vid = page.video();
  await ctx.close(); // flushea el webm a disco
  const tmpPath = await vid.path();
  const finalPath = `${OUT}/beat3-widget.webm`;
  fs.renameSync(tmpPath, finalPath);
  console.log("video:", finalPath);

  fs.writeFileSync(
    `${OUT}/beat3-coords.json`,
    JSON.stringify({ viewport: VP, inputBox, panelBox }, null, 2),
  );
  console.log("coords: beat3-coords.json", JSON.stringify({ inputBox, panelBox }));
}

// ---------------------------------------------------------------------------
// Captura 2 — beat3-scroll.webm: scroll editorial por /01 /02 /03
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: VP, recordVideo: { dir: OUT, size: VP } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1200);

  for (const num of ["/01", "/02", "/03"]) {
    const el = page.locator(`text="${num}"`).first();
    await el.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "smooth" }));
    await page.waitForTimeout(2600); // scroll suave + 700ms de transición Reveal + lectura
  }

  const vid = page.video();
  await ctx.close();
  const tmpPath = await vid.path();
  const finalPath = `${OUT}/beat3-scroll.webm`;
  fs.renameSync(tmpPath, finalPath);
  console.log("video:", finalPath);
}

await browser.close();

// =============================================================================
// FALLBACK — código viejo (stills de sec-01/02/03 + stats con reducedMotion).
// Conservado por si el beat 3 necesita volver a imágenes estáticas en vez de
// video. NO se ejecuta (todo el bloque de arriba ya cerró el browser).
// =============================================================================
//
// import { chromium } from "playwright";
//
// const URL = "https://robinshare.vercel.app/";
// const OUT = "C:/Users/PC/Flap/promo/teaser-pinned/assets";
// const VP = { width: 1920, height: 1080 };
//
// const browser = await chromium.launch({ channel: "chrome" });
//
// // 1) video del hero: el tape llenándose (12s)
// const ctx = await browser.newContext({ viewport: VP, recordVideo: { dir: OUT, size: VP } });
// const page = await ctx.newPage();
// await page.goto(URL, { waitUntil: "load" });
// await page.waitForTimeout(2500);      // primer fill + block cargado
// await page.waitForTimeout(12000);     // 12s de feed corriendo
// const vid = page.video();
// await ctx.close();                     // flushea el webm
// console.log("video:", await vid.path());
//
// // 2) stills de secciones /01 /02 /03 y stats (scroll dirigido)
// // reducedMotion: "reduce" -> Stat.tsx (líneas 26-29) salta el count-up y
// // pinta el valor final al instante. Son stills, no animaciones, así que
// // no pierden nada visualmente; y evita la carrera 900ms-de-espera vs.
// // 1100ms-de-duración del count-up que congelaba stats.png en 99/99 en vez
// // de 100/100 (root cause del blocker de quality-gate).
// const page2 = await browser.newPage({ viewport: VP, reducedMotion: "reduce" });
// await page2.goto(URL, { waitUntil: "load" });
// await page2.waitForTimeout(1500);
// const beats = [
//   ["sec-01", "/01"], ["sec-02", "/02"], ["sec-03", "/03"],
// ];
// for (const [name, num] of beats) {
//   const el = page2.locator(`text="${num}"`).first();
//   // scrollIntoViewIfNeeded() no alcanza: si el elemento ya está parcialmente
//   // visible desde el beat anterior no vuelve a scrollear, y las filas /02 //03
//   // quedan cortadas o duplicadas. Forzamos centrado real en el viewport.
//   await el.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
//   await page2.waitForTimeout(900);    // reveals/animaciones asientan
//   await page2.screenshot({ path: `${OUT}/${name}.png` });
//   console.log("shot:", name);
// }
// const stats = page2.locator("text=Admin keys").first();
// await stats.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
// await page2.waitForTimeout(900);
// await page2.screenshot({ path: `${OUT}/stats.png` });
// console.log("shot: stats");
// await browser.close();
