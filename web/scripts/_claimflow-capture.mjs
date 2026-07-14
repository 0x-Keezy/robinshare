// web/scripts/_claimflow-capture.mjs — captura VIDEO del flujo real de /claim
// (demo mode) para el composition promo/teaser-pinned/claimflow.html.
//
// Uso: cd web && node scripts/_claimflow-capture.mjs
//
// Patrón: igual que _promo-capture.mjs (beat3) — grabamos el flujo SIN cursor
// inyectado (Playwright no dibuja el puntero del sistema en el video) y
// componemos un cursor de marca (triángulo SVG lima) ENCIMA en HyperFrames,
// sincronizado por timestamp contra esta misma grabación. Por eso este script
// también vuelca las coords de cada botón/click a claim-coords.json — la
// composición las usa como blanco del tween del cursor (mismo mecanismo que
// #beat3-cursor en index.html).
import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://localhost:3000/claim/0x0000000000000000000000000000000000000001?demo=1";
const OUT = "C:/Users/PC/Flap/promo/teaser-pinned/assets";
const VP = { width: 1920, height: 1080 };

function box(el) {
  const r = el.boundingClientRect ? el.boundingClientRect() : null;
  return r;
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: VP,
  recordVideo: { dir: OUT, size: VP },
  colorScheme: "dark",
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(1500); // hidratación + efecto demo (seed del estado)

// ---- t≈0-1.4s: establish — balance + "Connect wallet" en reposo ----
const btnConnect = page.getByRole("button", { name: "Connect wallet" });
await btnConnect.waitFor({ state: "visible" });
const boxConnect = await btnConnect.boundingBox();
const boxBalance = await page.locator(".rounded-2xl").first().boundingBox();
await page.waitForTimeout(900);

// ---- click 1: Connect wallet -> Verify with GitHub (sin delay async) ----
const tClickConnect = 2.4; // segundos aprox. dentro del webm (para el timeline)
await btnConnect.click();
await page.waitForTimeout(150);

const btnVerify = page.getByRole("button", { name: "Verify with GitHub" });
await btnVerify.waitFor({ state: "visible" });
const boxVerify = await btnVerify.boundingBox();
await page.waitForTimeout(1100); // hold legible sobre "Verify with GitHub"

// ---- click 2: Verify with GitHub -> (mock 1100ms) -> Claim to 0x... ----
const tClickVerify = 3.95;
await btnVerify.click();
await page.waitForTimeout(150);
// mensaje intermedio "Verifying with GitHub…" — dale tiempo a asentarse en cuadro
await page.waitForTimeout(500);
await btnVerify.waitFor({ state: "hidden" }).catch(() => {}); // puede que el mismo botón cambie de texto

const btnClaim = page.getByRole("button", { name: /^Claim to/ });
await btnClaim.waitFor({ state: "visible", timeout: 4000 });
const boxClaim = await btnClaim.boundingBox();
await page.waitForTimeout(1000); // hold legible sobre "Claim to 0x8f3a…091b"

// ---- click 3: Claim -> (mock 1400ms) -> Done. + View transaction ----
const tClickClaim = 7.05;
await btnClaim.click();
await page.waitForTimeout(150);
await page.waitForTimeout(600); // "Sent — waiting for confirmation…" visible un instante

const doneText = page.getByText("Done.", { exact: true });
await doneText.waitFor({ state: "visible", timeout: 4000 });
const boxDone = await doneText.boundingBox();
const boxBalanceFinal = await page.locator(".rounded-2xl").first().boundingBox();
const linkTx = page.getByText("View transaction →");
const boxLink = await linkTx.boundingBox();

await page.waitForTimeout(2600); // hold final sobre "Done." + balance en 0 + link

const vid = page.video();
await ctx.close(); // flushea el webm a disco
const tmpPath = await vid.path();
const finalPath = `${OUT}/claim-raw.webm`;
fs.renameSync(tmpPath, finalPath);
console.log("video:", finalPath);

fs.writeFileSync(
  `${OUT}/claim-coords.json`,
  JSON.stringify(
    {
      viewport: VP,
      boxConnect,
      boxVerify,
      boxClaim,
      boxDone,
      boxBalance,
      boxBalanceFinal,
      boxLink,
      clicks: { tClickConnect, tClickVerify, tClickClaim },
    },
    null,
    2,
  ),
);
console.log("coords: claim-coords.json");

await browser.close();
