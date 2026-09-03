// Auditoría responsive completa: rutas x viewports. Mide overflow (y QUIÉN lo causa),
// tap targets chicos, texto minúsculo, elementos que se salen, y saca screenshots.
// Uso: node scripts/_respaudit.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3077";
const outDir = process.argv[3] ?? "./_respshots";
fs.mkdirSync(outDir, { recursive: true });

const routes = [
  ["home", "/"],
  ["create", "/create"],
  ["claim", "/claim/0x000000000000000000000000000000000000dEaD"],
];
const sizes = [
  [320, 568, "iphone-se1"],
  [360, 740, "android-small"],
  [375, 667, "iphone-se2"],
  [390, 844, "iphone-14"],
  [414, 896, "iphone-plus"],
  [430, 932, "iphone-pro-max"],
  [480, 854, "phone-landscape-ish"],
  [600, 960, "small-tablet"],
  [768, 1024, "ipad-portrait"],
  [834, 1112, "ipad-air"],
  [1024, 768, "ipad-landscape"],
  [1180, 820, "ipad-pro-land"],
  [1280, 800, "laptop"],
  [1440, 900, "macbook"],
  [1600, 900, "desktop"],
  [1920, 1080, "fhd"],
  [2560, 1440, "qhd"],
  [3440, 1440, "ultrawide"],
];

const probe = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const overflow = de.scrollWidth - vw;
  const desc = (el) => {
    const cls = typeof el.className === "string" ? el.className.slice(0, 60) : "";
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls.trim().split(/\s+/).slice(0, 3).join(".") : ""} "${txt}"`;
  };
  const all = [...document.querySelectorAll("body *")];
  // culpables de overflow: los que se pasan del ancho, quedándonos con el más externo
  const offenders = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.position === "fixed") continue;
    if (r.right > vw + 1 || r.left < -1) {
      // ¿algún ancestro ya reportado? entonces este es hijo del culpable
      if (offenders.some((o) => o.el.contains(el))) continue;
      offenders.push({ el, right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
    }
  }
  // tap targets chicos
  const tappable = [...document.querySelectorAll("a,button,input,select,[role=button]")];
  const smallTaps = tappable
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40))
    .map(({ el, r }) => ({ d: desc(el), w: Math.round(r.width), h: Math.round(r.height) }));
  // texto muy chico
  const tiny = all
    .filter((el) => el.children.length === 0 && (el.textContent || "").trim().length > 2)
    .map((el) => ({ el, fs: parseFloat(getComputedStyle(el).fontSize) }))
    .filter(({ fs }) => fs < 11.5)
    .map(({ el, fs }) => ({ d: desc(el), fs: +fs.toFixed(1) }));
  // headings: tamaño real
  const heads = [...document.querySelectorAll("h1,h2,h3")].map((el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return { tag: el.tagName, fs: +parseFloat(st.fontSize).toFixed(1), w: Math.round(r.width), h: Math.round(r.height), txt: (el.textContent || "").trim().slice(0, 46) };
  });
  // usos de 100vh / 100vw (problemáticos en móvil)
  const vhUsers = all
    .filter((el) => {
      const s = el.getAttribute("style") || "";
      return /\b100vh\b|\b100vw\b/.test(s);
    })
    .map((el) => desc(el));
  return {
    vw,
    overflow,
    scrollHeight: de.scrollHeight,
    offenders: offenders.map((o) => ({ d: desc(o.el), right: o.right, left: o.left, w: o.w })).slice(0, 12),
    smallTaps: smallTaps.slice(0, 12),
    smallTapCount: smallTaps.length,
    tiny: tiny.slice(0, 8),
    tinyCount: tiny.length,
    heads,
    vhUsers: vhUsers.slice(0, 8),
  };
};

const browser = await chromium.launch({ channel: "chrome" });
const report = [];
for (const [rname, route] of routes) {
  for (const [w, h, label] of sizes) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      isMobile: w < 768,
      hasTouch: w < 768,
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    await page.goto(`${base}${route}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const data = await page.evaluate(probe);
    data.route = rname;
    data.size = `${w}x${h}`;
    data.label = label;
    data.errs = errs;
    report.push(data);
    const tag = `${rname}-${w}`;
    await page.screenshot({ path: `${outDir}/${tag}-top.png` });
    // scroll a media página y al fondo
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.45));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${outDir}/${tag}-mid.png` });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${outDir}/${tag}-bot.png` });
    console.log(`${rname} ${w}x${h} overflow=${data.overflow} offenders=${data.offenders.length} smallTaps=${data.smallTapCount} tiny=${data.tinyCount} h1=${data.heads[0]?.fs ?? "-"}`);
    await ctx.close();
  }
}
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log("\nwrote", `${outDir}/report.json`);
