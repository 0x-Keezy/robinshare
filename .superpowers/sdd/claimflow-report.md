# Claim flow — cinematic (vuelta enfocada)

Encargo: mostrar el flujo REAL de `/claim` (no el tape, no diagramas) con motion premium de estudio. Repo `C:\Users\PC\Flap`. No se tocó `index.html` / `mechanism.html` / `pilot.html`.

## Qué se hizo

### 1. Modo demo en `ClaimClient.tsx`
`web/app/claim/[vault]/ClaimClient.tsx` — con `?demo=1` en la URL, el componente saltea las lecturas on-chain (`publicClient.readContract`) y siembra estado ilustrativo: `identityType=1` (github), `identityValue="arlo_dev"`, `pending=64900000000000000n` (0.0649 ETH — la spec pedía "0.0649 ETH" en el texto pero daba `65000000000000000n` en wei, que en realidad son 0.065 ETH; usé el wei exacto de 0.0649 para que el número en pantalla coincida con el que se pidió ver), `bound=ZERO`, `totalPaid=0`, `description="Fees for @arlo_dev — claimable via GitHub"`.

Los tres botones quedan mockeados sin tocar la UI real (mismo JSX, mismos estilos):
- **Connect wallet** → `demoConnected=true` (sin wallet real).
- **Verify with GitHub** → simula ~1.1s de "Verifying…" y resuelve a un voucher mock (reutiliza el mismo estado `voucher` que usa la ruta real de OAuth, así el JSX del botón "Claim to 0x…" sale gratis).
- **Claim** → simula ~1.4s de "Sent — waiting for confirmation…", después pone `pending=0`, `totalPaid=prev.pending`, `txHash` mock, y `msg="Done."`.

Todo detrás de `isDemo` (leído de `window.location.search`); sin el query param el comportamiento de producción es idéntico al original.

Verificado en vivo (Playwright + browser MCP): `http://localhost:3000/claim/0x0000000000000000000000000000000000000001?demo=1` corre el flujo completo Connect → Verify with GitHub → Claim to 0x8f3a…091b → `0 ETH` / `Done.` / `View transaction →`.

### 2. Captura del flujo real
`web/scripts/_claimflow-capture.mjs` (Playwright, patrón calcado de `_promo-capture.mjs` del propio repo) graba `claim-raw.webm` (1920x1080, dark, 10.24s) sin cursor inyectado — igual que beat3 del teaser, el cursor de marca se compone DESPUÉS en HyperFrames, no durante la grabación (Playwright no dibuja el puntero del sistema). El script también vuelca `claim-coords.json` con las bounding boxes reales del botón/balance/Done y los timestamps exactos de los 3 clicks, para que el cursor del composition apunte a coordenadas medidas, no estimadas.

### 3. Composición cinematográfica — `promo/teaser-pinned/claimflow.html`
Standalone, 1920x1080, **11.9s**, sin audio (según lo pedido).

- **Apertura (0-2.0s)**: `arrow-cine.mp4` (la flecha ya generada) con push sutil (scale 1.0→1.07) + un parche de color localizado (blend-mode `color`, radial-gradient lima) sobre el filo que salía cyan — lo empuja hacia lima sin tocar el resto del cuadro (fondo verde oscuro, madera). Transición: flash lima de 0.35s — "la flecha entrega" hacia el claim flow.
- **Claim flow (2.0-11.9s)**: el video real (`claim-raw.webm`) full-bleed. Cámara de 3 fases (patrón `coordinate-target-zoom`, origin fijo en el centro real del panel — medido, no estimado): 1.0→1.28 (establish/balance), →1.5 (foco en el CTA), →1.85 (climax sobre "Done."). El cursor de marca (triángulo SVG lima, mismo vocabulario que `#beat3-cursor` de `index.html`) vive en su propio wrapper que comparte el MISMO transform-origin/scale/translate que el video (siblings, no wrapper — el contrato de HyperFrames prohíbe envolver `<video>`), así se mantiene clavado al botón real a través del zoom. 3 ripple-bursts en los timestamps reales de click (Connect/Verify/Claim). Un segundo flash pequeño vende el "sweep" del balance a 0.
- **Tratamiento fílmico**: viñeta radial (opacity animada 0.26→0.6), grain estático (SVG `feTurbulence`, determinista, sin `Math.random`), grade estático (`contrast`/`saturate`/`brightness`) en ambos videos. Label mono mínimo ("the builder claims — proving it's them").

### Verificación
- `npx hyperframes check` — **0 errores** (lint/runtime/layout/motion/contrast), solo 6 infos esperables (`pointer-events: none` en capas decorativas). `check` no soporta apuntar a un archivo suelto en un dir con `index.html` ya presente (mismo hallazgo que `mechanism-report.md`/`pilot-report.md` de sesiones previas) — corrido en una copia aislada del scratchpad con `check .`.
- Snapshots dirigidos en momentos clave (arrow, transición, cada click, climax) — la UI real se lee perfecto en cada uno, el cursor cae exactamente sobre el botón medido, la viñeta y el grain no tapan texto.
- Render: `renders/claimflow.mp4` — h264, 1920x1080, 30fps, **11.9s**, sin audio, 6.9MB. Primer intento de encode crasheó (ffmpeg exit code 3221225477 / access violation nativo, transitorio); segundo intento renderizó limpio.

## Concerns (v1)
- Después del claim, el botón de la card vuelve a mostrar "Verify with GitHub" (porque `pending` vuelve a 0 y la lógica original de producción no oculta el botón en ese caso) — es el comportamiento REAL del componente, no un bug del demo. El encuadre del climax push se centra en el número + "Done." + link, así que en cámara no compite por atención, pero queda ahí si se mira con calma.
- El filo de la flecha sigue teniendo un remanente cyan tenue en el borde exterior del glow (el parche de color es intencionalmente parcial, no una recoloración total) — se ve como grade, no como error, pero si se quiere 100% lima habría que agrandar/intensificar el radial-gradient.

## v2 — más interactivo, más motion (feedback: "mejoró, pero puede sentirse más interactivo, con más motion")

Enriquecimiento, no pivot: se mantiene la UI real, el tratamiento fílmico y la flecha de apertura. Cambios en 3 capas.

### 1. `ClaimClient.tsx` — demo mode con más beats reales
- **Hover real en los 3 CTA** (`ctaCls`/`ghostCls`): `hover:scale-105 hover:brightness-110 active:scale-95` (+ `hover:bg-white/5` en el ghost). Es CSS `:hover`/`:active` de verdad — dispara con el `.hover()` de Playwright, no un efecto simulado.
- **Prueba de identidad como beat visible**: `handleVerifyGithubClick` ahora pasa por `demoVerifying` (spinner + texto "Verifying…" dentro del botón, ~1.1s) → `demoVerified` (chip "Verified via GitHub" con check dibujado a mano, stroke-dasharray, ~0.65s de hold) → recién ahí aparece el botón Claim. Antes era un `setMsg` de texto plano invisible en cámara.
- **Payoff animado del balance**: `handleClaimClick` ya no pone `pending=0n` de un salto. `animateDemoDrain(fromEth, 900)` anima un float (`demoDrainEth`) de 0.0649→0 con ease-out-cubic, drenando el número en pantalla durante 900ms (`.demo-balance-draining` glow + `.demo-balance-sweep` barrido lima), con un ícono `.demo-eth-fly` (rombo lima, doble triángulo estilo ETH) que sale volando de la card. "Done." entra con `.demo-done-pop` + checkmark dibujado (`.demo-check-path`), y el link "View transaction →" entra con `.demo-tx-link-in`.
- **Gotcha de implementación — rAF vs setInterval**: la primera versión de `animateDemoDrain` usaba `requestAnimationFrame`. Verificado en vivo (browser MCP): en una pestaña no enfocada/backgrounded, Chrome pausa rAF indefinidamente y la promesa nunca resuelve — el flujo se cuelga después de "Sent — waiting for confirmation…". Cambiado a `setInterval` cada 30ms, leyendo `Date.now()` real en cada tick (no depende de que el tick llegue puntual). Verificado que ahora sí resuelve y llega a "Done." tanto en foreground como en la captura real de Playwright.
- Keyframes/clases nuevas en `web/app/globals.css` bajo el comentario "/claim demo-mode enrichment", con guard en `@media (prefers-reduced-motion: reduce)`.

### 2. `web/scripts/_claimflow-capture.mjs` — captura con hover + los nuevos beats
Reescrito: antes de cada click, `.hover()` real sobre el botón + hold de 450ms (visible el scale/brightness). Espera explícita a los nuevos estados (`Verifying…` → `Verified` → `Claim to 0x…`) con los mismos tiempos que usa el componente. Vuelca a `claim-coords.json` no solo boxes/clicks sino también `hovers` (tHoverConnect/Verify/Claim) y `payoff` (tDrainStart/tDrainEnd/tDoneVisible).

**Grounding gotcha importante**: los primeros timestamps a mano (sumando los `waitForTimeout` del script) NO coincidieron con el video real más allá del primer par de clicks — el beat de "Verifying…/Verified" tardó ~0.5-0.65s más en la grabación real que lo que sugerían los `sleep()` nominales del componente (probablemente jitter de timers de fondo durante la grabación Playwright+ffmpeg concurrente). Se corrigió extrayendo frames reales de `claim-raw.webm` con `ffmpeg -ss <t> -frames:v 1` en una rejilla fina (cada 0.15-0.25s) alrededor de cada transición, en vez de confiar en la aritmética de los `waitForTimeout`. Los tiempos finales en `claimflow.html` están grounded contra esos frames, no contra el script.

Captura nueva: `claim-raw.webm` 1920x1080, 25fps, **10.72s** (antes 10.24s).

### 3. `promo/teaser-pinned/claimflow.html` — cámara reactiva + overlays de payoff
- **Cámara reactiva** (pedido explícito #5): en vez de 3 empujes planos, ahora hay un `CAM` group (`#claim-video, #cursor-cam, #ripple-cam, #comet-cam`) con: push de acercamiento → **lean de hover** (+scale sutil, ease sine.out) en cada uno de los 3 hovers → **flinch/settle de click** (yoyo rápido) en cada click → push de viaje más largo durante el beat de identidad (ahora ~2.4s, cubre verifying+verified reales) → **impact-snap + climax push** en el click de Claim (llega exactamente cuando "Done." aparece) → **pull-back** (exhale, scale 1.9→1.78) para asentar el encuadre final.
- **Halo de anticipación de hover** (`#hover-glow`, vive dentro de `#cursor-cam`): resplandor suave sostenido mientras el cursor "espera" sobre el botón, distinto del ripple de click — vende que alguien está a punto de clickear antes de clickear.
- **Ripples de click** retimados a los 3 clicks reales (ya no simulados: 4.45 / 5.3 / 8.7 en tiempo de comp).
- **Comet de payoff** (`#comet-cam` + `.comet-dot`): partícula lima que sale de la zona del balance y se arquea fuera de cuadro durante la ventana de drenado — complementa (no reemplaza) el ícono real `.demo-eth-fly` que ya vive en el DOM capturado.
- **`#done-glow`**: pulso radial suave detrás de "Done." (el check + pop reales ya vienen en el video capturado; esto solo suma peso).
- `data-duration` del root/escena2 subió de 11.9/9.9 a **12.3/10.3** (más contenido: hover + identity beat + drenado).
- Lint fix: `gsap_exit_missing_hard_kill` en el 3er ripple (su fade terminaba cerca del `data-start` de `#flash2`) — se agregó un `tl.set([".ripple-1",".ripple-2"],{opacity:0},9.2)` explícito.

### Verificación (v2)
- `npx hyperframes check .` (copia aislada, mismo workaround de siempre) → **0 errores**, 8 info de lint (`pointer-events:none` en capas decorativas, esperable) + 3 info de layout (`escaped_container` en ripples/done-glow durante el zoom — intencional, mismo patrón que v1).
- Snapshots dirigidos (`npx hyperframes snapshot . --at ...`) en: hover con halo visible sobre "Connect wallet", click con ripple grande sobre "Claim to 0x8f3a…091b", el spinner "Verifying…" legible a media escena, el drenado (0.0331 ETH) + comet + flash simultáneos, "Done." + check + link asentados tras el pull-back. Todos LEÍDOS con Read — la interacción SE VE en cada uno.
- Render: `renders/claimflow.mp4` — h264, 1920x1080, 30fps, **12.3s**, sin audio, 9.4MB. Primer intento volvió a crashear con el mismo ffmpeg exit 3221225477 transitorio ya documentado en v1; segundo intento limpio.

### Concerns (v2)
- El drenado real corre en tiempo real dentro del navegador (setInterval, no rAF) — es determinista en cuanto a la curva (ease-out-cubic sobre `Date.now()`), pero el momento exacto en que arranca dentro de la grabación puede variar unos ~50-100ms entre corridas de captura por jitter del sistema. Si se vuelve a capturar, conviene re-groundear los tiempos de `claimflow.html` con el mismo método de frames de ffmpeg en vez de reusar los de este pase.
- Mismo comportamiento real ya documentado en v1: el botón vuelve a "Verify with GitHub" después del claim (pending vuelve a 0). Sigue fuera de cuadro del climax push.

## v3 — finishing premium (feedback: "mucho mejor, pero mejorable")

Pasada de acabado sobre el pase v2: audio (el salto más grande, estaba mudo), el fix del estado post-claim, la flecha a lima puro, y un tratamiento fílmico más rico con un hold real en el clímax.

### 1. Fix — "Verify with GitHub" ya no reaparece tras el claim
`web/app/claim/[vault]/ClaimClient.tsx` — el bug de v1/v2 era real: en modo demo `bound` nunca se setea (no hay escritura on-chain), así que cuando `pending` vuelve a `0n` y `voucher` vuelve a `null` tras el claim, el guard `!isBound && identityType===1 && !voucher && !demoVerified` volvía a ser `true` → el botón "Verify with GitHub" reaparecía.

Fix: nuevo estado `demoClaimed` (terminal, solo demo), seteado a `true` al final de `handleClaimClick`. Gatea el botón de verify (`&& !demoClaimed`) y agrega un chip final reutilizando la clase `.demo-verified-chip` ya existente: **"Claimed — fees released"** con el mismo check dibujado a mano. El área de CTA queda en un estado terminal coherente — reclamaste → listo — en vez de invitar a verificar de nuevo. "Done." + "View transaction →" (ya existentes, fuera de la card) siguen apareciendo igual.

Verificado en vivo (Playwright, `?demo=1`): a t=9.9s post-claim se lee "0 ETH" / "Claimed — fees released" / "Done." / "View transaction →" — sin rastro de "Verify with GitHub".

### 2. Audio — de mudo a diseñado
Capa completa nueva en `claimflow.html`, 12 `<audio>` como hijos directos de `#root` (contrato HyperFrames), tracks 30+:
- **Bed continuo** (`bed-ambient.mp3`) 0-12.9s, fade-in 0.4s, **duck** a 0.16 justo antes del impacto del claim (evita que se sume al pico más fuerte y clippee), recupera, fade-out final 12.4-12.9s — es el único punto de silencio real, y es el cierre, no un hueco.
- **Ticks** (`sfx-key-tick.mp3`) en los 3 hovers; **click/pop** (`sfx-whoosh-short.mp3`) en los 3 clicks + ripple; **chime** (`sfx-ping.mp3`) en "Verified via GitHub"; **impacto** (`sfx-impact-lockup.mp3`) en el momento real en que el balance empieza a drenar (no en el click del Claim — ver grounding abajo, quedan ~0.5s aparte); **whoosh** (`sfx-whoosh.mp3`) cuando el ETH vuela; **tono de confirmación** (`sfx-ping.mp3` de nuevo, motivo reutilizado a propósito) en "Done.". Todo bundled (media-use, sin credenciales) — mismo catálogo que ya usa `index.html`.
- Volumen vía `data-volume` estático en los one-shots; el bed usa tweens de GSAP sobre `volume` (patrón documentado en `hyperframes-core` — `tl.to("#bed-ambient",{volume:...})`, no hay que fingir el fade con clips duplicados).
- `sfx-impact-lockup.mp3` resultó estar masterizado muy caliente (max_volume nativo del archivo = **0.0 dB**) — a `data-volume=0.6` el render completo picaba a -1.0dB (al filo). Bajado a **0.48** → render final **max_volume -2.2dB**, mean -16.0dB (verificado con `ffprobe -af volumedetect`, sin clipping, bed audible incluso en la ventana silenciosa 10.6-12.4s).

### 3. Flecha a lima puro
`#arrow-grade` (blend `color`, ya existía) agrandado e intensificado (0.8→0.95 de opacidad), + `#arrow-grade-2` nuevo (blend `hue`, radio más ancho y suave) para llegar al remanente cyan del borde exterior del glow que quedaba en v1/v2 sin tocar el resto del cuadro (fondo, madera). Verificado por snapshot a t=1.2s: filo 100% lima, sin cyan.

### 4. Tratamiento fílmico más rico + ritmo
- Grano: 0.05→0.068 de opacidad, frecuencia más fina (0.85→0.95) — "un poco más presente pero fino".
- `#grade-tint` nuevo: wash full-frame `soft-light`, sombras hacia paper-dark, highlights con un toque de lima — un grade coherente de toda la pieza, no dos clips con filtros sueltos.
- Bloom (v3, nuevo): `#button-bloom` (bleed lima detrás del CTA, breathing finito — `repeat:11`, nunca `repeat:-1`, con hard-kill explícito) y `#balance-bloom` (glow que reacciona al payoff: construye en el impacto, sostiene en el hold, se apaga al final) + `filter: drop-shadow` en `.ripple` para que el anillo de click también "brille".
- Hold en el clímax: con el re-grounding (ver abajo) el pull-back termina en comp 11.43 y la composición cierra en 12.9 → **~1.5s de hold estático real** con "Done." + "0 ETH" + "Claimed — fees released" + "View transaction" todos en cuadro, más un cierre limpio (squeeze final de viñeta 12.5-12.9, sin blackout duro).

### 5. Re-grounding de tiempos — el hallazgo más importante de este pase
El fix del punto 1 exigía recapturar el video (`_claimflow-capture.mjs`), y eso quiso decir re-groundear TODA la coreografía de cámara/audio de v2, no solo el tail. Tres métodos probados, en orden de confianza creciente:
1. **Sumas nominales** de los `waitForTimeout` del script (método v1/v2): descartado — la deriva real puede superar 1s para cuando se llega al beat de identidad.
2. **Instrumentación de reloj real** (`Date.now()` relativo a `t0` en `newPage()`): parecía autoritativo pero seguía desalineado 0.1-0.3s contra los píxeles reales del video — el pipeline de captura/encode de Chrome retrasa el tiempo real una cantidad variable bajo la carga concurrente de chrome+ffmpeg+dev-server de este entorno.
3. **Detección automática de scene-change por ffmpeg**, recortado a la zona del botón/status (`ffmpeg -i claim-raw.webm -vf "crop=700:200:600:470,select='gt(scene,0.015)',showinfo" -f null -`) — la única que coincidió con el contenido real del archivo. Confirmado a mano contra extracción de frames en dos puntos independientes antes de confiarle el resto.

`_claimflow-capture.mjs` quedó reescrito para medir con `Date.now()` real (mejor que v1/v2, aunque el punto 3 fue necesario igual) y documentar el método de grounding definitivo en el header, para la próxima vez que haga falta recapturar.

### Verificación (v3)
- `npx hyperframes check .` (copia aislada, mismo workaround de siempre) → **0 errores**, 1 warning (`composition_file_too_large`, 306 líneas — aceptable para una pieza única de 12.9s), 10 info (`pointer-events:none` esperable).
- Snapshots dirigidos post-fix con re-grounding: hover+ripple sobre "Verify with GitHub" (4.6s), "Verified via GitHub" + chime (6.6s), hover sobre "Claim to 0x8f3a…091b" (8.6s), **flash + comet + balance a mitad de drenado (0.0376 ETH) simultáneos** (9.6s), climax con balance-bloom + "0 ETH" + chip + "Done." + link (10.4s), cierre con viñeta cerrada (12.75s). Todos leídos con Read — la sincronización se ve, no se asume.
- Render: `renders/claimflow.mp4` — h264/aac, 1920x1080, **12.9s**, **6.5MB**, CON audio. `ffprobe`: stream de video + audio confirmados. `volumedetect`: mean -16.0dB, max -2.2dB (sin clipping), bed presente incluso en la ventana de hold silenciosa.

### Concerns (v3)
- El offset de grounding (t_comp = t_raw + 0.72, media-start=1.28) es específico de ESTA captura (`claim-raw.webm` actual, 12.24s). Si se vuelve a capturar, hay que re-derivar el offset — no asumir que el mismo número sirve, el pipeline de encode de este entorno tiene jitter variable run-a-run (documentado en el header de `_claimflow-capture.mjs`).
- `sfx-whoosh.mp3` y `sfx-whoosh-short.mp3` son el mismo archivo (hash idéntico, ya documentado para `index.html`) — reusado a propósito en distintos volúmenes/momentos, no es un error.
- El lint de `composition_file_too_large` (306 líneas) es solo sugerencia de estilo — no se dividió en sub-composiciones porque es una pieza única, no vale la pena la indirección para este entregable.
