// Stills de lanzamiento, todos del producto REAL corriendo contra la cadena.
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const B = "http://localhost:3077";
const VAULT = "0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3";
const b = await chromium.launch({ channel: "chrome" });

async function shot({ name, w, h, mobile = false, route = "/", act }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 1 : 1, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(B + route, { waitUntil: "load" });
  await p.waitForTimeout(2800);
  if (act) await act(p);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log("ok", name);
  await ctx.close();
}

await shot({ name: "01-hero-desktop", w: 1600, h: 900 });
await shot({ name: "02-hero-mobile", w: 540, h: 960, mobile: true });
await shot({ name: "03-claim-real-desktop", w: 1600, h: 900, route: `/claim/${VAULT}` });
await shot({ name: "04-claim-real-mobile", w: 540, h: 960, mobile: true, route: `/claim/${VAULT}` });
await shot({
  name: "05-trust-block-desktop", w: 1600, h: 900,
  act: async (p) => {
    await p.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "Audit");
      const card = el?.closest("div")?.parentElement;
      (card ?? document.body).scrollIntoView({ block: "center" });
    });
    await p.waitForTimeout(1400);
  },
});
await shot({
  name: "06-create-desktop", w: 1600, h: 900, route: "/create",
  act: async (p) => {
    await p.fill('input[placeholder="Aveline Coin"]', "Sindre Sorhus Coin");
    await p.fill('input[placeholder="AVE"]', "SINDRE");
    await p.fill('input[placeholder="github username"]', "sindresorhus");
    await p.waitForTimeout(1800);
  },
});
await shot({
  name: "07-deed-sealed-desktop", w: 1600, h: 900,
  act: async (p) => {
    await p.fill("#rs-lookup", "0x-keezy");
    await p.getByText("Check balance", { exact: true }).click();
    await p.waitForTimeout(4500);
    const y = await p.evaluate(() => {
      const label = [...document.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "Set-aside deed");
      const card = label?.closest("section") ?? label?.parentElement;
      const r = card.getBoundingClientRect();
      return Math.max(0, window.scrollY + r.top - (window.innerHeight - r.height) / 2);
    });
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await p.waitForTimeout(1800);
  },
});
await b.close();
