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
// (0.0649 -> 0) al clickear Claim.
//
// v3 (grounding fix): los timestamps YA NO son sumas manuales de los
// waitForTimeout emitidos. Un pase anterior mostró que esa convención "aprox"
// se desalinea fuerte entre corridas (~0.5-1.3s de deriva acumulada por t=5s,
// jitter real de Chrome/Playwright/ffmpeg concurrentes, no un bug del
// componente) — cualquier cámara/audio construido contra los tiempos
// NOMINALES del script queda perceptiblemente desincronizado del video real.
// Ahora cada evento mide tiempo real de reloj (`Date.now()`) relativo a
// `t0` = justo antes de `page.goto` (el punto más cercano al arranque real
// de `recordVideo`, que empieza a grabar en `ctx.newPage()`), y ese elapsed_s
// medido es el que se vuelca a claim-coords.json. Es la fuente de verdad para
// re-groundear claimflow.html — no more hand math.
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
const t0 = Date.now(); // recordVideo begins ~here (newPage), not at goto
const now = () => (Date.now() - t0) / 1000;

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(1500); // hidratación + efecto demo (seed del estado)

// ---- establish — balance + "Connect wallet" en reposo ----
const btnConnect = page.getByRole("button", { name: "Connect wallet" });
await btnConnect.waitFor({ state: "visible" });
const boxConnect = await btnConnect.boundingBox();
const boxBalance = await page.locator(".rounded-2xl").first().boundingBox();
await page.waitForTimeout(800);

// ---- hover + click 1: Connect wallet -> Verify with GitHub ----
await btnConnect.hover();
const tHoverConnect = now();
await page.waitForTimeout(450); // hold del hover, visible el scale/brightness
await btnConnect.click();
const tClickConnect = now();
await page.waitForTimeout(150);

const btnVerify = page.getByRole("button", { name: "Verify with GitHub" });
await btnVerify.waitFor({ state: "visible" });
const tConnectResolved = now(); // real moment the button flips to "Verify with GitHub"
const boxVerify = await btnVerify.boundingBox();
await page.waitForTimeout(250); // settle antes del siguiente hover

// ---- hover + click 2: Verify with GitHub -> "Verifying…" -> "Verified" -> Claim ----
await btnVerify.hover();
const tHoverVerify = now();
await page.waitForTimeout(450);
await btnVerify.click();
const tClickVerify = now();

// beat "Verifying…" (spinner) — dura ~1100ms en el componente (demo mode);
// esperamos al estado real en vez de sumar un sleep nominal
const verifyingText = page.getByText("Verifying…", { exact: true });
await verifyingText.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
const tVerifyingStart = now();

const verifiedChip = page.getByText("Verified via GitHub", { exact: true });
await verifiedChip.waitFor({ state: "visible", timeout: 3000 });
const tVerifyingEnd = now(); // = tVerifiedStart, chip just appeared

const btnClaim = page.getByRole("button", { name: /^Claim to/ });
await btnClaim.waitFor({ state: "visible", timeout: 4000 });
const tVerifiedEnd = now(); // chip gone, Claim button visible
const boxClaim = await btnClaim.boundingBox();
await page.waitForTimeout(550); // hold legible sobre "Claim to 0x8f3a…091b"

// ---- hover + click 3: Claim -> "Sent…" -> drenado animado -> Done. ----
await btnClaim.hover();
const tHoverClaim = now();
await page.waitForTimeout(450);
await btnClaim.click();
const tClickClaim = now();

const sentText = page.getByText("Sent — waiting for confirmation…", { exact: true });
await sentText.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
const tDrainStart = now(); // real moment "Sent…" appears, right before the drain animates

const doneText = page.getByText("Done.", { exact: true });
await doneText.waitFor({ state: "visible", timeout: 4000 });
const tDoneVisible = now(); // real moment "Done." appears (drain just finished)
const tDrainEnd = tDoneVisible;
const boxDone = await doneText.boundingBox();
const boxBalanceFinal = await page.locator(".rounded-2xl").first().boundingBox();
const linkTx = page.getByText("View transaction →");
const boxLink = await linkTx.boundingBox();

await page.waitForTimeout(2200); // hold final — cámara hace pull-back y se asienta
const tEnd = now();

const vid = page.video();
await ctx.close(); // flushea el webm a disco
const tmpPath = await vid.path();
const finalPath = `${OUT}/claim-raw.webm`;
fs.renameSync(tmpPath, finalPath);
console.log("video:", finalPath);
console.log("measured (s):", {
  tHoverConnect,
  tClickConnect,
  tConnectResolved,
  tHoverVerify,
  tClickVerify,
  tVerifyingStart,
  tVerifyingEnd,
  tVerifiedEnd,
  tHoverClaim,
  tClickClaim,
  tDrainStart,
  tDoneVisible,
  tEnd,
});

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
      // measured real elapsed seconds since recordVideo start (Date.now()
      // relative to t0 at newPage()) — NOT nominal sums, see header comment
      hovers: { tHoverConnect, tHoverVerify, tHoverClaim },
      clicks: { tClickConnect, tClickVerify, tClickClaim },
      identity: { tConnectResolved, tVerifyingStart, tVerifyingEnd, tVerifiedEnd },
      payoff: { tDrainStart, tDrainEnd, tDoneVisible },
      tEnd,
    },
    null,
    2,
  ),
);
console.log("coords: claim-coords.json");

await browser.close();
