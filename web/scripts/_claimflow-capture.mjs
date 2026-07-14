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
//
// v2 (motion + interactividad): además de click, ahora hacemos HOVER real
// sobre cada botón antes de clickear (dispara los :hover CSS reales del botón
// — scale/brightness — capturados en el video, no simulados en HyperFrames)
// y esperamos a los nuevos beats reales del componente: "Verifying…" (spinner)
// -> "Verified via GitHub" (chip) -> Claim, y el drenado animado del balance
// (0.0649 -> 0) al clickear Claim. Todos los timestamps de abajo son sumas
// manuales de los waitForTimeout emitidos (misma convención "aprox" que v1;
// confirmado, no medido por instrumentación) — quedan documentados inline
// para que el offset t_comp = t_raw + 1.7 (ver claimflow.html) siga siendo
// derivable a mano si se retoca el timing.
import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://localhost:3000/claim/0x0000000000000000000000000000000000000001?demo=1";
const OUT = "C:/Users/PC/Flap/promo/teaser-pinned/assets";
const VP = { width: 1920, height: 1080 };

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: VP,
  recordVideo: { dir: OUT, size: VP },
  colorScheme: "dark",
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(1500); // hidratación + efecto demo (seed del estado) — t=1.5

// ---- t≈1.5-2.3s: establish — balance + "Connect wallet" en reposo ----
const btnConnect = page.getByRole("button", { name: "Connect wallet" });
await btnConnect.waitFor({ state: "visible" });
const boxConnect = await btnConnect.boundingBox();
const boxBalance = await page.locator(".rounded-2xl").first().boundingBox();
await page.waitForTimeout(800); // t=2.3

// ---- hover + click 1: Connect wallet -> Verify with GitHub ----
const tHoverConnect = 2.3;
await btnConnect.hover();
await page.waitForTimeout(450); // hold del hover, visible el scale/brightness — t=2.75
const tClickConnect = 2.75;
await btnConnect.click();
await page.waitForTimeout(150); // t=2.9

const btnVerify = page.getByRole("button", { name: "Verify with GitHub" });
await btnVerify.waitFor({ state: "visible" });
const boxVerify = await btnVerify.boundingBox();
await page.waitForTimeout(250); // settle antes del siguiente hover — t=3.15

// ---- hover + click 2: Verify with GitHub -> "Verifying…" -> "Verified" -> Claim ----
const tHoverVerify = 3.15;
await btnVerify.hover();
await page.waitForTimeout(450); // t=3.6
const tClickVerify = 3.6;
await btnVerify.click();
await page.waitForTimeout(150); // t=3.75

// beat "Verifying…" (spinner) — dura ~1100ms en el componente (demo mode)
await page.waitForTimeout(950); // t=4.7 (matching componente: click 3.6 + 1.1 = 4.7)
const tVerifyingEnd = 4.7;

// beat "Verified via GitHub" (chip) — dura ~650ms en el componente antes del Claim
await page.waitForTimeout(650); // t=5.35 (matching componente: 4.7 + 0.65 = 5.35)
const tVerifiedEnd = 5.35;

const btnClaim = page.getByRole("button", { name: /^Claim to/ });
await btnClaim.waitFor({ state: "visible", timeout: 4000 });
const boxClaim = await btnClaim.boundingBox();
await page.waitForTimeout(550); // hold legible sobre "Claim to 0x8f3a…091b" — t=5.9

// ---- hover + click 3: Claim -> "Sent…" -> drenado animado -> Done. ----
const tHoverClaim = 5.9;
await btnClaim.hover();
await page.waitForTimeout(450); // t=6.35
const tClickClaim = 6.35;
await btnClaim.click();
await page.waitForTimeout(150); // t=6.5
await page.waitForTimeout(350); // "Sent — waiting for confirmation…" visible antes del drain — t=6.85
const tDrainStart = 6.85;
await page.waitForTimeout(900); // ventana del drenado animado (900ms en el componente) — t=7.75
const tDrainEnd = 7.75;

const doneText = page.getByText("Done.", { exact: true });
await doneText.waitFor({ state: "visible", timeout: 4000 });
const tDoneVisible = 7.75; // el drain termina justo cuando aparece "Done."
const boxDone = await doneText.boundingBox();
const boxBalanceFinal = await page.locator(".rounded-2xl").first().boundingBox();
const linkTx = page.getByText("View transaction →");
const boxLink = await linkTx.boundingBox();

await page.waitForTimeout(2200); // hold final — cámara hace pull-back y se asienta — t≈9.95

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
      hovers: { tHoverConnect, tHoverVerify, tHoverClaim },
      clicks: { tClickConnect, tClickVerify, tClickClaim },
      identity: { tVerifyingEnd, tVerifiedEnd },
      payoff: { tDrainStart, tDrainEnd, tDoneVisible },
    },
    null,
    2,
  ),
);
console.log("coords: claim-coords.json");

await browser.close();
