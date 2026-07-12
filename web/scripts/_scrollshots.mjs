// Captura N posiciones de scroll con GPU REAL (lección vault: headless=SwiftShader miente).
// Uso: node scripts/_scrollshots.mjs <url> <outPrefix> [fracciones ej. 0,0.2,0.5,0.8]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3000';
const prefix = process.argv[3] || 'shot';
const fracs = (process.argv[4] || '0,0.18,0.36,0.5,0.64,0.8,0.95').split(',').map(Number);
const [vw, vh] = (process.argv[5] || '1440x900').split('x').map(Number);

// Ventana CHICA en la esquina (Windows clampea posiciones offscreen a la pantalla
// visible → una ventana grande encima invita al usuario a tocarla y contamina la
// captura con selección/scroll). El viewport emulado sigue siendo 1440x900.
const b = await chromium.launch({
  headless: false, // headed = GPU del sistema
  channel: 'chrome',
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
    '--window-position=4000,1400',
    '--window-size=420,300',
  ],
});
const p = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 220)); });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(4000); // preloader + primer frame WebGL

// sanity del renderer: confirmar que NO es SwiftShader (software)
const glInfo = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return { canvas: false };
  try {
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { canvas: true, gl: false };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      canvas: true,
      w: c.width, h: c.height,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
    };
  } catch (e) { return { canvas: true, err: String(e).slice(0, 120) }; }
});
console.log('gl:', JSON.stringify(glInfo));

for (const f of fracs) {
  // recalcular H y VERIFICAR que el scroll llegó (defensa contra reflows/interferencia)
  let actual = -1, target = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    target = await p.evaluate((frac) => {
      const H = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.round(H * frac);
      window.getSelection()?.removeAllRanges();
      window.scrollTo({ top: y, behavior: 'instant' });
      return y;
    }, f);
    await p.waitForTimeout(400);
    actual = await p.evaluate(() => window.scrollY);
    if (Math.abs(actual - target) < 6) break;
  }
  await p.waitForTimeout(1200); // asentar damping de cámara + reveals
  const out = `${prefix}-${String(Math.round(f * 100)).padStart(2, '0')}.png`;
  await p.screenshot({ path: out });
  console.log('shot', out, `y=${actual}/${target}`);
}
await b.close();
console.log('done');
