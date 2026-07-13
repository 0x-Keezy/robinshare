// Variante del rig para sitios externos que nunca llegan a networkidle (Framer).
import { chromium } from "playwright";

const [url, prefix, fracsCsv, size] = process.argv.slice(2);
const [w, h] = (size ?? "1440x900").split("x").map(Number);
const fracs = fracsCsv.split(",").map(Number);

const browser = await chromium.launch({
  headless: false,
  channel: "chrome",
  args: ["--window-position=4000,1400", "--window-size=420,300", "--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(url, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(4000); // dejar que Framer hidrate y arranquen las animaciones

for (const f of fracs) {
  const y = await page.evaluate(
    (frac) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const y = Math.round(max * frac);
      scrollTo(0, y);
      return y;
    },
    f,
  );
  await page.waitForTimeout(2200); // animaciones de entrada
  const file = `${prefix}-${String(Math.round(f * 100)).padStart(2, "0")}.png`;
  await page.screenshot({ path: file });
  console.log("shot", file, "y=" + y);
}
await browser.close();
