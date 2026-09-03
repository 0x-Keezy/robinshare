// Captura el demo de lanzamiento con DATOS REALES: se busca el handle del piloto contra la
// cadena y se filma lo que la cadena contesta (el vault existe, el acta se llena, el sello cae).
// Nada de mock. Uso: node scripts/_launchdemo.mjs <outDir>
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const B = "http://localhost:3077";
const HANDLE = "ponsdotfamily";

const b = await chromium.launch({ channel: "chrome" });

async function run({ tag, w, h, mobile }) {
  const dir = `${OUT}/raw-${tag}`;
  fs.mkdirSync(dir, { recursive: true });
  // OJO: `recordVideo.size` NO escala con `deviceScaleFactor`. Filmar a dsf 3 con size 3x deja
  // la pagina dibujada en px CSS 1:1 arriba a la izquierda de un lienzo tres veces mas grande, con
  // el resto en gris (probado). Se filma 1:1 y el vertical se toma de un viewport de 540x960 —
  // que sigue por debajo del breakpoint sm (640), o sea layout de telefono— para que el encode a
  // 1080x1920 sea un 2x exacto y no un 2,77x borroso.
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
    recordVideo: { dir, size: { width: w, height: h } },
  });
  const p = await ctx.newPage();
  await p.goto(B, { waitUntil: "load" });
  await p.waitForTimeout(3000); // hidratacion + primer block del RPC

  const input = p.locator("#rs-lookup");
  await input.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await input.click();
  await p.waitForTimeout(400);
  await input.type(HANDLE, { delay: 90 });
  await p.waitForTimeout(900);
  await p.getByText("Check balance", { exact: true }).click();
  await p.waitForTimeout(4200); // la cadena contesta + el sello cae

  // bajar al acta, que ahora lleva el nombre y el sello puesto. El scroll se hace a mano y en
  // pasos: `scrollIntoView({behavior:"smooth"})` sobre un ancestro grande no llega a destino
  // antes de que se corte la grabacion, y ademas el sello se dispara por IntersectionObserver.
  const y = await p.evaluate(() => {
    const label = [...document.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "Set-aside deed");
    const card = label?.closest("section") ?? label?.parentElement;
    if (!card) return 0;
    const r = card.getBoundingClientRect();
    return Math.max(0, window.scrollY + r.top - (window.innerHeight - r.height) / 2);
  });
  const steps = 34;
  const from = await p.evaluate(() => window.scrollY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = 1 - Math.pow(1 - t, 3);
    await p.evaluate((v) => window.scrollTo(0, v), from + (y - from) * eased);
    await p.waitForTimeout(45);
  }
  await p.waitForTimeout(3200);
  await p.screenshot({ path: `${OUT}/deed-sealed-${tag}.png` });
  await p.waitForTimeout(1200);
  await ctx.close();

  const file = fs.readdirSync(dir).find((f) => f.endsWith(".webm"));
  fs.renameSync(`${dir}/${file}`, `${OUT}/demo-${tag}.webm`);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("ok", `${OUT}/demo-${tag}.webm`);
}

await run({ tag: "desktop", w: 1600, h: 900, mobile: false });
await run({ tag: "mobile", w: 540, h: 960, mobile: true });
await b.close();
