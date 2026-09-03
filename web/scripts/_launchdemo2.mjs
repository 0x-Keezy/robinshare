// DEMO DE LANZAMIENTO v2 — el producto entero, no solo el lookup.
//
// La v1 mostraba un solo gesto (buscar un nombre y ver el acta) y Jose pidio que ademas se vea el
// COBRO y que sea mas explicativo. Asi que este recorre los tres pasos que el producto promete:
//   1. buscar a alguien            -> la cadena contesta que todavia no tiene nada
//   2. nombrarlo en /create        -> el formulario real, con la aritmetica del fee a la vista
//   3. como se cobra               -> /docs#claiming, las dos rutas de identidad
//   4. (solo version B) el recibo  -> /claim del vault del piloto, que es el UNICO cobro real
//                                     que existe... y por eso lleva el handle de Jose en el
//                                     encabezado. Por eso son dos versiones y elige el.
//
// REGLA: no se actua un cobro que no paso. Conectar una wallet y firmar no lo puedo hacer, y
// pintar un cobro falso sobre un vault real es exactamente lo que se saco de este producto cuando
// `?demo=1` resulto ser una pagina de phishing en el propio dominio. Lo que se filma es estado
// real de la cadena o texto del propio sitio.
//
// Uso: node scripts/_launchdemo2.mjs <outDir> [conRecibo]
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = process.argv[2];
const CON_RECIBO = process.argv[3] === "conRecibo";
fs.mkdirSync(OUT, { recursive: true });
const B = "http://localhost:3077";
const HANDLE = "ponsdotfamily";
const VAULT = "0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3";

const b = await chromium.launch({ channel: "chrome" });

/// Scroll a mano y con easing: `scrollIntoView({behavior:"smooth"})` no llega a destino antes de
/// que se corte la toma, y ademas los Reveal se disparan por IntersectionObserver — un salto seco
/// los deja sin animar.
async function scrollTo(p, y, steps = 30, ms = 40) {
  const from = await p.evaluate(() => window.scrollY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await p.evaluate((v) => window.scrollTo(0, v), from + (y - from) * (1 - Math.pow(1 - t, 3)));
    await p.waitForTimeout(ms);
  }
}

async function yOf(p, texto) {
  return p.evaluate((txt) => {
    const el = [...document.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === txt);
    const card = el?.closest("section") ?? el?.parentElement;
    if (!card) return window.scrollY;
    const r = card.getBoundingClientRect();
    return Math.max(0, window.scrollY + r.top - (window.innerHeight - r.height) / 2);
  }, texto);
}

async function run({ tag, w, h, mobile }) {
  const dir = `${OUT}/raw-${tag}`;
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
    recordVideo: { dir, size: { width: w, height: h } },
  });
  const p = await ctx.newPage();

  // ── 1. Alguien puede haber lanzado una moneda a tu nombre ────────────────────────────────
  await p.goto(B, { waitUntil: "load" });
  await p.waitForTimeout(2600);
  const input = p.locator("#rs-lookup");
  await input.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await input.click();
  await p.waitForTimeout(350);
  await input.type(HANDLE, { delay: 85 });
  await p.waitForTimeout(700);
  await p.getByText("Check balance", { exact: true }).click();
  await p.waitForTimeout(3600); // la cadena contesta

  // ── 2. El acta, con el nombre y el sello al bloque real ──────────────────────────────────
  await scrollTo(p, await yOf(p, "Set-aside deed"));
  await p.waitForTimeout(2800);

  // ── 3. Nombrarlo: el formulario real, con la aritmetica del fee a la vista ───────────────
  await p.goto(`${B}/create`, { waitUntil: "load" });
  await p.waitForTimeout(2200);
  await p.fill('input[placeholder="Aveline Coin"]', "Pons Family Coin");
  await p.waitForTimeout(400);
  await p.fill('input[placeholder="AVE"]', "PONS");
  await p.waitForTimeout(400);
  await p.fill('input[placeholder="github username"]', HANDLE);
  await p.waitForTimeout(1400);
  // bajar hasta la fila del tax, que es donde se ve cuanto paga el trader y cuanto cobra el builder
  const yTax = await p.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "Creator tax → vault");
    const box = el?.parentElement;
    if (!box) return window.scrollY;
    const r = box.getBoundingClientRect();
    return Math.max(0, window.scrollY + r.top - 120);
  });
  await scrollTo(p, yTax, 26, 40);
  await p.waitForTimeout(3200);

  // ── 4. Como se cobra: las dos rutas, dichas por el sitio ─────────────────────────────────
  await p.goto(`${B}/docs#claiming`, { waitUntil: "load" });
  await p.waitForTimeout(2400);
  await scrollTo(p, await p.evaluate(() => {
    const s = document.getElementById("claiming");
    return s ? window.scrollY + s.getBoundingClientRect().top - 90 : window.scrollY;
  }), 20, 40);
  await p.waitForTimeout(3400);

  if (CON_RECIBO) {
    // ── 5. El recibo. Estado REAL del unico vault que cobro: 0 ETH pendiente, 0,000214 pagados.
    await p.goto(`${B}/claim/${VAULT}`, { waitUntil: "load" });
    await p.waitForTimeout(4200);
    await p.screenshot({ path: `${OUT}/recibo-${tag}.png` });
    await p.waitForTimeout(1600);
  } else {
    await p.waitForTimeout(1200);
  }

  await ctx.close();
  const file = fs.readdirSync(dir).find((f) => f.endsWith(".webm"));
  fs.renameSync(`${dir}/${file}`, `${OUT}/demo-${tag}.webm`);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("ok", `${OUT}/demo-${tag}.webm`);
}

await run({ tag: "desktop", w: 1600, h: 900, mobile: false });
await b.close();
