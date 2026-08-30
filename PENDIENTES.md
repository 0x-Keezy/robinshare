# PENDIENTES — decisiones que bloquean el deploy de RobinShare sobre pons

> **Dueño: Jose.** Ninguna de estas la puede tomar un agente: todas involucran plata, custodia de
> llaves, o exponer a terceros. El código está listo y verificado; **esto** es lo que falta.
>
> Última actualización: 2026-08-30 · rama `feat/pons-web` · repo `C:\Users\PC\Flap`

---

## 1. Auditoría del contrato nuevo — auditor y presupuesto

**Es el gate real. Todo lo demás es menor al lado de esto.**

El audit de GT/David Zhang aprobó el árbol `audited-v3`, que es el rail de **Flap**. Ese `AUDIT-NOTES`
dice textualmente *"deployed bytecode must build from here"*. `RobinShareVault` +
`RobinShareVaultFactory` son **contratos nuevos**: entrypoint reescrito, `harvest`/`sweepCurve`
nuevos, salida de ERC-20 nueva, reloj re-anclado, y el Guardian eliminado entero. **No hay ninguna
línea de ese audit que se porte.**

Y custodian ETH de terceros — el modelo del producto es que la plata espere *indefinidamente* a
alguien que todavía no tiene wallet.

**Lo que ya se hizo para que la auditoría sea barata:**
- El vault bajó a **8.126 B** y la factory a **13.340 B** (la versión Flap pesaba 22–24 KB).
- 131 tests unitarios + **7 tests de fork contra los contratos reales de pons**, incluido el ciclo
  completo de plata y los tres rechazos (par ERC-20, buyback activo, launch ajeno).

**Qué hace falta decidir:** quién audita, con qué presupuesto y en qué plazo.

**Riesgo de no decidirlo:** el proyecto queda exactamente donde estuvo 6 semanas esperando el badge
de Flap — trabado, pero ahora por otra puerta.

---

## 2. Custodia y sucesión de la llave del attester

Hoy **no existe**. Hay que crear una wallet dedicada (`cast wallet new`), sin fondos, cuya address va
al constructor de la factory y cuya PK va **solo** al env de Vercel (`ATTESTER_PK`).

Lo que esa llave puede hacer: firmar vouchers de bind para vaults de **GitHub**. No puede mover ETH,
no puede redirigir fees, no puede tocar los vaults de X ni los de wallet.

Lo que pasa si se pierde **y** `attesterAdmin` quedó en `0x0`: los vaults de GitHub se quedan **sin
ninguna ruta de bind**, y con el default `recoveryDays = 0` tampoco hay recovery. El ETH queda
congelado para siempre. Es el finding 5 (High) del audit v3, por otra puerta.

**Qué hace falta decidir:** dónde vive la PK, quién más la tiene, y qué pasa si Jose no está.

---

## 3. Qué dirección va como `attesterAdmin` (o si va en `0x0`)

`attesterAdmin` es un co-gate acotado a propósito: **solo puede rotar el attester**. No firma
vouchers, no toca fondos, no tiene ninguna otra potestad.

- Con una dirección: hay sucesión si la llave del attester se pierde. El costo es que esa dirección
  puede rotar el attester a una que controle, y desde ahí firmar vouchers de bind — o sea, **puede
  desviar los claims de GitHub**, aunque no puede sacar un wei directamente.
- Con `0x0`: nadie más puede rotar, y una llave perdida congela todo (ver §2).

**Recomendación técnica** (la decisión sigue siendo de Jose): una dirección **distinta** de la del
attester y de la del deployer — idealmente un multisig o una hardware wallet fría. Poner la misma
dirección del attester no agrega nada; poner la del deployer concentra el riesgo.

---

## 4. ¿Se conserva la ruta X, o se construye un attester propio?

La ruta de X depende **enteramente de infra de un competidor**:

- el prover `verifyx.taxed.fun` es un servicio HTTP de **Flap**, sin auth y sin SLA;
- el verifier on-chain (`0xccDaB0d5Bc6E0aCb8B157cffFA062688Aa849c17`) es un **proxy upgradeable** de
  un Safe **2-de-5**, con implementación **no verificada**.

Lo bueno, medido: es **agnóstico del rail** — firma substrings arbitrarios, sin registro de vaults,
así que técnicamente funciona igual lanzando en pons.

Lo incómodo: le estaríamos pidiendo firmas al competidor para un producto lanzado en el launchpad
rival, y si apagan el servicio (o cambian la implementación del proxy) los vaults de X quedan sin
ruta de claim. `xVerifier` es **inmutable en el vault**: no se puede reapuntar después.

**Las opciones:**
1. **Conservarla como está** y decirlo en el copy. Cero trabajo, dependencia viva.
2. **No ofrecer X en el lanzamiento** — solo GitHub y wallet. La factory ya soporta `xVerifier = 0`,
   pero entonces `createVault` con tipo X revierte, o sea que es una decisión de producto, no un
   flag.
3. **Attester propio para X** (mismo patrón que GitHub: OAuth de X + firma nuestra). Es trabajo real
   y agrega una segunda llave a custodiar (§2), pero saca la dependencia.

**No decidirlo equivale a elegir la opción 1**, que es la que está implementada hoy.

---

## 5. Disclosure del conflicto de interés

Jose es parte del equipo de **PonsVault**, un competidor directo en la misma cadena. RobinShare se
lanza en pons.

**Qué hace falta decidir:** si se declara, dónde (la landing, el README del repo, el pitch), y con
qué palabras. No es una decisión técnica y no la puede tomar un agente por él.

---

## 6. Push del repo (menor, pero sigue abierto)

`0x-Keezy/robinshare` es **público**. Sin pushear hoy:

- la rama **`flap-rail`** (`c512884`) — solo local, guarda el producto entero sobre Flap;
- la rama **`feat/pons-web`** — todo el port a pons;
- los commits de `main` desde `24b5670`.

El bloqueante técnico que había (el spec documentaba la cadena de ataque del attester *antes* de que
estuviera arreglada) **ya cayó**: el fix está aplicado y con test de regresión en las dos ramas.
Ahora es puramente decisión de Jose cuándo se hace público.
