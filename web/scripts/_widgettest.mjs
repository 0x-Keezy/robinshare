import { chromium } from "playwright";
const browser = await chromium.launch({ headless: false, channel: "chrome", args: ["--window-position=4000,1400", "--window-size=420,300"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.fill('input[placeholder="your-handle"]', "torvalds");
await page.waitForTimeout(7000); // ~3 fills del feed
await page.screenshot({ path: process.argv[2] });
const total = await page.textContent("text=and counting");
console.log("counter line:", total);
await browser.close();
