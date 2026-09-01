# Brief-contrato · facelift de marca y tipografía de RobinShare

**Fecha**: 2026-09-01 · **Vertical**: DeFi/fintech · **Alcance**: marca + tipografía + atmósfera.
La arquitectura de secciones y el copy honesto NO se tocan.

> Este brief es contrato. Si el build se desvía, gana el brief.

## Design-read (una línea)

*Alguien que no sabe que le deben plata entra, escribe su handle de GitHub, y descubre que hay un
vault con su nombre. El único trabajo de la página es que le crea.*

## Fase -1 · ADN: lo que está LOCKEADO y no se re-discute

- **Verde Robinhood `#00C805`** — es la identidad de la cadena, no una elección estética. Se usa
  **sólo para dato en vivo** (el tape, el dot, el block number). Nunca decorativo.
- **El copy honesto**: `CUSTODY_LINE`, `AUDIT_LINE`, `CONFLICT_LINE`, y las tres promesas del
  producto. Costaron dos auditorías adversariales y varias correcciones. Intocables.
- **Los datos reales**: block number del RPC, el lookup de vaults contra la cadena. Nada mock.
- **Tema oscuro por defecto con toggle a claro** — ya existe y hay usuarios que lo eligieron.

Los ejes lockeados quedan FUERA del cómputo anti-convergencia.

## El diagnóstico: por qué se lee como AI slop

Tres tells concretos, no "gusto":

1. **Archivo Black gigante en mayúsculas.** Es el display por defecto del molde suizo-snappy. Lo
   usa medio internet y no dice nada sobre este producto.
2. **La pluma es un render con glow neón y specks de humo.** El código lo admite: se le puso una
   máscara radial *"sin máscara leía a render de IA"*. Enmascarar un tell no lo quita.
3. **El arco.** Converge con **Recurve** — tu propio launchpad, misma cadena, mismo vertical, que
   ya usa un *"mark de arco SVG bespoke"* y se llama literalmente por un arco recurvo.

## Concept spine

**Una orden permanente a nombre de alguien.** RobinShare no es un juego de Robin Hood: es un
**apartado** — cada trade separa una parte y la guarda a nombre de una persona que quizá ni sabe.
El registro visual es el de un **acta**: papel, tinta, una firma que se sostiene sola.

De ahí sale todo: la serif de autoridad (el acta), el mono (los números de un libro contable), y la
pluma — que deja de ser el sombrero de Robin Hood y pasa a ser **el instrumento con que se firma**.
La pluma se queda; el arco se va.

## Locks de diseño (decididos acá, no durante el build)

**Tipografía**
- Display: **Fraunces** (variable, ejes `opsz`/`SOFT`/`WONK`). Serif de autoridad — el registro que
  el playbook de DeFi permite y que **ningún hermano del cluster usó**: Recurve=Cabinet Grotesk,
  iStock=Anton, Overwrite=Geist/Space Grotesk, AFTERHOURS=lettering propio.
- Datos: **IBM Plex Mono** (se queda: el playbook exige mono tabular para cifras financieras).
- Cuerpo: **Archivo** se queda como texto corrido; sale sólo del display.
- **BANS**: Archivo Black, Anton, Inter suelta, cualquier display meme.

**Color** — base ya lockeada. Lo que cambia es el *tratamiento*: el lima deja de ser decorativo y
queda como acento contable (≤3 usos + 1 clímax). El verde, sólo dato en vivo.

**La marca nueva**: `SetAsideMark`. Una barra larga (el trade) con una porción separada y sostenida
aparte (lo que se aparta). Dibuja lo que el producto hace, en dos formas. Sin arco, sin flecha.

**La pluma**: deja de ser PNG con glow. Pasa a **SVG de trazo autorado** — barbas dibujadas, tinta
sobre papel, sin fósforo. Un render enmascarado nunca deja de ser un render.

**Atmósfera**: grano + viñeta sostenidos TODO el scroll (hoy el hero tiene tratamiento y el resto
queda plano — el gate lo marca).

## Anti-convergencia vs el cluster DeFi/fintech

Ejes libres = 5 (la paleta está lockeada por ADN). Umbral = `ceil(0.66×5)` = **4**.

| Eje | RobinShare (nuevo) | vs el cluster | ¿difiere? |
|---|---|---|---|
| Display | **Fraunces** serif variable | Cabinet Grotesk · Anton · Geist · lettering propio | ✅ |
| Hero/layout | el **lookup como protagonista** | hero split + panel (Recurve), showroom 3D (iStock) | ✅ |
| Wow | escribís tu handle → **la cadena responde** | instrumento Chainlink, tienda 3D, calc de payoff | ✅ |
| Assets | **SVG autorado** (marca + pluma), cero render | arco SVG, GLB real, boards generados | ✅ |
| Copy | se conserva (honesto declarativo) | Recurve también es honesto-DeFi | ❌ |

**4 de 5.** Pasa.

## Gate de este build

Además del mecánico: cero `Archivo_Black`, cero `BowMark`, cero PNG con glow, atmósfera presente
después del hero, y **el copy honesto intacto** (lo verifica `copy.test.ts`, que ya existe).
