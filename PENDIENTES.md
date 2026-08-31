# PENDIENTES — decisiones que bloquean el deploy de RobinShare sobre pons

> **Dueño: Jose.** Ninguna de estas la puede tomar un agente: todas involucran plata, custodia de
> llaves, o exponer a terceros. El código está listo y verificado; **esto** es lo que falta.
>
> Última actualización: 2026-08-30 · rama `feat/pons-web` · repo `C:\Users\PC\Flap`

---

## 1. Auditoría del contrato nuevo — ~~auditor y presupuesto~~ DECIDIDO: va sin auditar

> **DECISIÓN DE JOSE, 2026-08-31: se lanza SIN auditoría.** Queda cerrada como decisión; lo de
> abajo se conserva como el registro de qué se estaba comprando y qué no.
>
> **Consecuencias que siguen vivas y hay que tratar en consecuencia:**
> - La divulgación de §8 pasa de ser opcional a ser lo único que le queda al usuario para saber
>   dónde está parado. El README ya lo dice arriba de todo.
> - El piloto con plata propia deja de ser "el paso prudente" y pasa a ser **el único banco de
>   pruebas real** antes de lanzar para terceros.
> - Los hallazgos de las dos rondas adversariales (y sus fixes, en el historial de
>   `feat/pons-web`) son ahora la única revisión externa que tuvo este código.

El audit de GT/David Zhang aprobó el árbol `audited-v3`, que es el rail de **Flap**. Ese `AUDIT-NOTES`
dice textualmente *"deployed bytecode must build from here"*. `RobinShareVault` +
`RobinShareVaultFactory` son **contratos nuevos**: entrypoint reescrito, `harvest`/`sweepCurve`
nuevos, salida de ERC-20 nueva, reloj re-anclado, y el Guardian eliminado entero. **No hay ninguna
línea de ese audit que se porte.**

Y custodian ETH de terceros — el modelo del producto es que la plata espere *indefinidamente* a
alguien que todavía no tiene wallet.

**Lo que ya se hizo para que la auditoría sea barata:**
- El vault pesa **9.034 B** y la factory **14.751 B** (la versión Flap pesaba 22–24 KB).
- **55 tests unitarios del rail nuevo + 10 de fork contra los contratos reales de pons**,
  incluido el ciclo completo de plata, la graduación real cruzando 4,2 ETH, los tres rechazos (par
  ERC-20, buyback activo, launch ajeno) y las regresiones de las dos rondas adversariales.
  (`forge test` reporta **149**, pero 94 de esos son del rail de Flap que **no** se porta — el
  número que hay que mirar para juzgar la cobertura de `RobinShareVault` /
  `RobinShareVaultFactory` es **55**, más los 10 de fork.)
- Una ronda de review con **tres agentes frescos** (seguridad · conformidad al spec · "¿esto
  funcionaría en la cadena real?"), con todo lo bloqueante y alto ya cerrado. Los hallazgos y sus
  fixes están en los commits de `feat/pons-web`; el auditor humano debería empezar por ahí.

**Qué hace falta decidir:** quién audita, con qué presupuesto y en qué plazo.

**Riesgo de no decidirlo:** el proyecto queda exactamente donde estuvo 6 semanas esperando el badge
de Flap — trabado, pero ahora por otra puerta.

---

## 2. Custodia y sucesión de la llave del attester

Hoy **no existe**. Hay que crear una wallet dedicada (`cast wallet new`), sin fondos, cuya address va
al constructor de la factory y cuya PK va **solo** al env de Vercel (`ATTESTER_PK`).

Lo que esa llave puede hacer, dicho con precisión — **la versión anterior de este documento decía
que "no puede mover ETH", y era falso**; dos revisores lo reprodujeron con un PoC:

> Firmar vouchers de bind para vaults de **GitHub**. Y como en esa ruta la firma del attester **es**
> la prueba de identidad, quien tenga la llave puede bindear cualquier vault de GitHub a la wallet
> que quiera y cobrarlo — incluso uno que el dev real ya reclamó y todavía no vació. Es inherente a
> atestiguar un OAuth on-chain, no un bug del contrato, pero **tratala como una llave de custodia,
> no como una llave de firma**.

Lo que **no** puede: tocar los vaults de X (dependen del `XGeneralVerifier`, no del attester), ni
los de wallet (ahí `boundWallet` lo fija el constructor), ni hacerlo en silencio (rotar emite
`AttesterRotated`, bindear emite `Bound`).

Lo que pasa si se pierde **y** `attesterAdmin` quedó en `0x0`: los vaults de GitHub se quedan **sin
ninguna ruta de bind**, y con el default `recoveryDays = 0` tampoco hay recovery. El ETH queda
congelado para siempre. Es el finding 5 (High) del audit v3, por otra puerta.

**Qué hace falta decidir:** dónde vive la PK, quién más la tiene, y qué pasa si Jose no está.

---

## 3. Qué dirección va como `attesterAdmin` (o si va en `0x0`)

`attesterAdmin` es un co-gate cuya única función es rotar el attester. No firma vouchers ni tiene
ninguna otra potestad **directa** — pero leé §2 antes de elegir la dirección: rotar el attester a
una llave propia y firmarse un voucher **sí alcanza los fondos** de cualquier vault de GitHub, en
dos transacciones. Está probado en
`contracts/test/ReviewRound2.t.sol::test_attesterAdmin_SI_alcanzaLosFondosDeUnVaultGithub`.

O sea que la elección real es entre dos riesgos, no entre riesgo y seguridad:

- **Con una dirección**: hay sucesión si la llave del attester se pierde (riesgo de *liveness*
  cubierto), a cambio de un segundo actor con alcance de custodia sobre los vaults de GitHub.
- **Con `0x0`**: nadie más puede rotar. Una llave perdida **congela para siempre** el ETH de todos
  los vaults de GitHub (ver §2), pero no hay segundo actor.

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

---

## 7. ¿Se construye el relayer del claim?

**Es una promesa del producto que hoy no se cumple.**

El contrato **sí** soporta que un tercero pague el gas del primer claim: `claimAndBind` valida la
firma del attester, no `msg.sender`. Está probado contra la cadena real — en
`ForkPons.t.sol::test_fork_fullCycle_nativePair` **un dev con 0 ETH cobró**, con un relayer
mandando la transacción. Y la ruta de X se cambió en este port justamente para que también fuera
relayable (§7.1 del spec).

Pero **el producto no tiene relayer**: `web/app/api/` sólo tiene `attest`, `health`, `token-image`
y `x-prove`. Hoy el gas del claim lo paga quien reclama. El copy ya se corrigió para decir la
verdad, pero la promesa original —"no necesita wallet ni ETH"— era la más vendible que teníamos.

> **ACTUALIZADO 2026-08-31 — YA ESTÁ CONSTRUIDO.** `POST /api/relay/claim` + la política
> anti-abuso en `web/lib/relay.ts` (18 tests). La UI pregunta por el estado del relayer y sólo
> ofrece el botón sin gas si contesta que está prendido; si no, cae al camino de siempre.
>
> **Lo único que falta es tuyo: fondear la wallet.** Poné `RELAYER_PK` en Vercel y queda vivo;
> sin esa env var la ruta responde 503 y no pasa nada. Detalle y defensas en
> `docs/RUNBOOK-launch-pons.md` §8.b.

**Qué queda por decidir:** con cuánto saldo la fondeás y quién la vigila. El gasto está acotado
por las defensas, pero es una wallet caliente y eso no lo decide un agente.

---

## 8. ¿La landing declara que el contrato no está auditado?

Al sacar los conteos de tests del copy (dos direcciones se contradecían entre sí, 95 vs 71, y
ninguno coincidía con el suite real) quedó a la vista una pregunta que no es técnica: **una página
que custodia plata de terceros, ¿debería decir que el contrato todavía no pasó por una auditoría
externa?**

Decirlo es lo más honesto y cuesta conversiones. No decirlo no es mentir —la página no afirma lo
contrario— pero se apoya en que nadie pregunte. **Es decisión de Jose**, y depende de §1: si la
auditoría se contrata antes del launch, la pregunta desaparece sola.

---

## 9. ¿Quién corre y quién fondea el keeper de `sweepCurve()`?

El repo trata el barrido como **obligatorio** y no como una optimización: el runbook §8 dice
literalmente *"`sweepCurve()` no es opcional"*, y el spec §12.1 lo pone como la **única** mitigación
del redirect retroactivo de pons (el owner puede reapuntar las fees con 3 días de aviso, y el cambio
alcanza todo lo que no se haya barrido). Medido: en 404 s tradearon 118 curvas de pons y el operador
barrió 15.

Pero hoy eso existe sólo como una línea de `cast send` en el runbook con un `$KEEPER_PK` que no está
definido en ninguna parte. **No hay keeper.**

> **ACTUALIZADO 2026-08-31 — YA ESTÁ CONSTRUIDO.** `web/scripts/keeper.mjs`. Recorre los vaults
> de la factory, simula `harvest()` en cada uno (gratis) para saber cuánto saldría —incluido lo
> que está en la curva, que `pendingAmount()` no ve— y sólo manda los que superan un piso.
> Dry-run por default; hay que pedir `--send`.
>
> **Probado end-to-end** contra un anvil forkeando la cadena: con 1 ETH de volumen,
> `pendingAmount()` mostraba **0** y el keeper barrió **0,107 ETH** por **0,000114 ETH** de gas.
>
> `KEEPER_PK` **no necesita ningún privilegio** — `harvest()` es permissionless. Si se pierde, se
> pierde la automatización y nada más.

**Qué queda por decidir:** dónde corre el cron (VPS, GitHub Actions, tu máquina) y con qué wallet.
Es barato, pero alguien lo tiene que pagar y mirar.

---

## 10. Handles que nadie puede reclamar: el arreglo del contrato no cierra la clase

La ronda de review cerró tres formas *sintácticas* de handle imposible (`-torvalds`, `torvalds-`,
`tor--valds` — las reglas reales de GitHub). Pero un revisor mostró en fork que la **clase** sigue
abierta por dos puertas que el contrato no puede ver:

- **nombres reservados de GitHub** (`settings`, `about`, `login`, `security`…) pasan la validación y
  no son perfiles de nadie;
- más simple todavía: un handle **válido y no registrado** (`zzq-nonexistent-abc-9x`). El atacante lo
  registra él mismo y cobra como "la identidad", o espera el recovery.

Con `recoveryDays > 0` cualquiera de las dos convierte el clawback **opcional** del launcher en uno
**garantizado**, que es justo el ataque que el producto existe para impedir.

**Por qué no se "arregló" en el contrato:** la lista de nombres reservados cambia y no se puede
mantener on-chain, y la existencia de una cuenta no es verificable desde Solidity.

**Qué hace falta decidir:** una de estas, y es de producto, no técnica.
1. Dejar `recoveryDays = 0` como el **único** valor permitido en la UI (el default ya lo es), y
   ofrecer recovery sólo por CLI para quien sepa lo que hace.
2. Chequear en `/create` que el handle exista en GitHub antes de permitir `recoveryDays > 0`.
   Mitiga el caso realista sin tocar el contrato; es bypasseable por CLI.
3. Aceptarlo y decirlo (hoy `/create` ya avisa en el texto de ayuda del campo).
