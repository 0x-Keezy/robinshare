// Capturas del explorer publico: la verificacion de la factory y el vault del piloto.
// Son la evidencia que el kit le pide al lector que compruebe, asi que salen sin editar.
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
for (const [name, url, wait] of [
  ["08-explorer-factory-verified", "https://robinhoodchain.blockscout.com/address/0xBf25E1d9082B5Ad0b8C68f072E94C797028c6855?tab=contract", 7000],
  ["09-explorer-vault-piloto", "https://robinhoodchain.blockscout.com/address/0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3?tab=txs", 8000],
]) {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(wait);
  // Se OCULTA el dialogo de cookies para la captura (no se acepta ni se rechaza nada: no se
  // toca ningun boton del banner). Sin esto el overlay ademas atenua la pagina entera y la
  // evidencia sale gris.
  await p.addStyleTag({ content: "#onetrust-consent-sdk,.onetrust-pc-dark-filter,#onetrust-banner-sdk,[id*='cookie'],[class*='cookie-banner']{display:none!important} html,body{filter:none!important}" });
  await p.waitForTimeout(500);
  // El banner de cookies tapa la mitad de abajo. No se acepta ni se rechaza nada: se recorta la
  // captura a la zona de contenido, que es lo unico que el kit necesita mostrar.
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 230, y: 40, width: 1210, height: 660 } });
  const t = await p.evaluate(() => document.body.innerText.slice(0, 260).replace(/\s+/g, " "));
  console.log(name, "->", t.slice(0, 150));
}
await b.close();
