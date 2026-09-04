# Brief-contrato · dirección `tape` — el recibo, gritado

**Fecha**: 2026-09-04 · **Vertical**: DeFi/fintech en registro **afiche** · **Alcance**: una dirección
nueva, navegable en `/v/tape`. No toca producción (`legend` sigue siendo el default).

> Este brief es contrato. Si el build se desvía, gana el brief.

## De dónde sale

Jose trajo **staqsend.cash** y pidió "una versión en este estilo con nuestra misma tech". La referencia
del usuario **es el benchmark**, no algo de lo que diferenciarse ([[la-referencia-del-usuario-es-el-benchmark-no-el-enemigo]]).

Pero hay un dato que cambia el encuadre y hay que decirlo arriba de todo: **STAQ no es una referencia
de estilo, es un competidor directo**. Mismo launchpad (pons), misma cadena (Robinhood Chain 4663),
mismo producto (lanzar una moneda a nombre de un `@` que no tiene wallet, que cobra después con un
login social). Encima llega con más: cuatro proveedores de identidad (X, GitHub, Twitch, YouTube),
un producto de envío directo ("stack"), y token propio con buyback.

Consecuencia de diseño, y es la restricción principal de este brief: **copiar su afiche haría que
RobinShare se lea como un clon de STAQ**. Se toma su *registro* (campo de color plano, display gorda,
mayúsculas, contundencia) y se separa a propósito en los ejes que dan identidad.

## Design-read (una línea)

*Alguien scrollea X en el celular, ve esto tres segundos y entiende que puede lanzarle una moneda a un
dev que ni sabe. El único trabajo de la página es que se entienda rápido y dé ganas de escribir un handle.*

## Fase -1 · LOCKS (no se re-discuten)

- **El copy honesto**: `CUSTODY_LINE_PARTS`, `AUDIT_LINE`, `CONFLICT_LINE`. Los renderiza esta página
  y `test/copy.test.ts` la audita como superficie. Intocable.
- **Verde Robinhood `#00C805`** = SOLO dato en vivo (la altura de bloque). Nunca decorativo.
- **Datos reales de la cadena.** El lookup y el bloque salen del RPC. Nada mock, ningún handle inventado.
- **Dos rutas de identidad** (GitHub, wallet). La tercera no se nombra — la factory va con su verificador
  en cero y el gate lo exige.

## Concept spine

**EL RECIBO, GRITADO.** `legend` es un acta susurrada: serif, papel, sello, silencio. Esta dirección es
**el mismo documento pegado en una pared**. No cambia lo que dice ni lo que promete — cambia el volumen.
De ahí sale todo: campo de color plano en vez de atmósfera, mayúsculas en vez de versalitas, y el
artefacto signature deja de ser un sello notarial y pasa a ser **un ticket impreso**.

## Locks de diseño

**Color** — campo lima `#CCFF00` (el acento propio de RobinShare, ahora ocupando la página) con tinta
`#0D120E`. Las secciones alternan lima ↔ tinta. `#00C805` sólo para el bloque en vivo.
**BANS**: naranja (es el acento secundario de STAQ), degradados, glows, cualquier verde tercero.

**Tipografía** — display **Gabarito** (900, mayúsculas, tracking cerrado): gorda y geométrica, con
autoridad. **BAN explícito: Bagel Fat One** (la de STAQ, burbuja/marcador) y Bricolage Grotesque (su
cuerpo). Cuerpo **Archivo** y datos **IBM Plex Mono**, las dos ya en el proyecto: dos de tres caras se
reusan, la que cambia es la que da la personalidad.

**El artefacto signature: EL RECIBO.** Un ticket de papel con borde dentado y perforación, levemente
rotado, impreso en mono con la identidad que escribiste, la tasa, el vault y **la altura de bloque real
a la que se leyó la cadena**. Es 100 % DOM + CSS (`mask-image` para el dentado), no se puede pegar en
otro sitio, y es lo que el producto hace. **Cero ilustración 3D** — ahí es donde STAQ pone stickers
claymórficos de billetes y cohetes, y es su firma, no la nuestra.

**Wow (Tier-1, responde al input)** — escribís un handle y **el recibo se imprime**: el ticket baja
línea por línea y el bloque se congela. Nada de autoplay.

## Anti-convergencia — el comparador es STAQ, no mis builds

| Eje | RobinShare `tape` | staqsend.cash | ¿difiere? |
|---|---|---|---|
| Display | **Gabarito 900** geométrica gorda | Bagel Fat One (burbuja) | ✅ |
| Paleta | lima + tinta, **sin naranja** | lima + tinta + naranja + verde medio | ✅ |
| Hero/layout | titular a la izquierda + **recibo impreso** a la derecha | titular + **stickers 3D** flotando | ✅ |
| Wow | el recibo se imprime al escribir | chip de handle que rota solo (autoplay) | ✅ |
| Assets | **cero imágenes**: DOM/CSS/SVG puro | renders claymórficos, blobs, halftones | ✅ |
| Copy | declarativo honesto, hereda `CUSTODY_LINE` | imperativo publicitario | ✅ |

**6 de 6.** Y contra mis propios builds del cluster (Family Office, Calldog, TELLER): campo de color
plano y cero imagen generada es lo contrario de las seis escenas full-bleed de Family Office.

## Secciones

1. **Hero** (lima) — nav, titular, el recibo, dos CTA.
2. **Los cuatro hechos** (tinta) — cifras grandes en mono. Datos, no eslóganes.
3. **Tres movimientos** (tinta) — 01/02/03, numerales lima gigantes.
4. **El buscador** (lima) — la herramienta real: escribís, la cadena contesta, el recibo se imprime.
5. **Lo que no podemos prometer** (tinta) — `CUSTODY_LINE_PARTS` en cuerpo grande y legible, no en
   letra chica. Es el diferenciador del producto, no un disclaimer.
6. **Cierre + pie** (lima) — CTA, docs, direcciones.

## Fuera de alcance

No se toca `legend` ni el default de producción. Esta dirección se juzga en `/v/tape` y recién si gana
se discute promoverla.
