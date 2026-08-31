# RUNBOOK — Launch de RobinShare sobre pons v2 (Robinhood Chain 4663)

> **Estado: LISTO PARA AUDITAR, NO PARA DEPLOYAR.** El ciclo entero esta probado contra los
> contratos REALES de pons en fork (`contracts/test/ForkPons.t.sol`, 10 tests verdes) y el script de
> deploy esta ensayado en SIMULACION contra la cadena real. Lo que falta **no** es tecnico: el
> contrato es nuevo, custodia ETH de terceros y **no esta auditado**. Ver `PENDIENTES.md`.
>
> **Diferencia con `RUNBOOK-launch.md`**: aquel es el rail de **Flap** (`VaultPortal`, vanity
> `0x7777`, badge de Flap, Guardian). Sigue vivo en la rama `flap-rail` + tag `audited-v3`. Este es
> el rail de **pons**, que no tiene ninguna de esas puertas.

## 0. Pre-flight (las llaves de Jose)

- [ ] **ETH en chain 4663** en la wallet deployer. Presupuesto medido en simulacion:
      **~0,00192 ETH** el deploy de la factory + **0,0005 ETH** por launch + gas de 2 transacciones
      mas por launch (`createVault`, `attachToken`). Con 0,02 ETH sobra.
- [ ] **Wallet ATTESTER** nueva y dedicada (`cast wallet new`), SIN fondos. Su address va al
      constructor; su PK va SOLO al env de Vercel (`ATTESTER_PK`). Si no matchean, `/api/health` lo
      delata (`attesterMatches:false`).
- [ ] **`ATTESTER_ADMIN`** — decision abierta, ver `PENDIENTES.md` §3. Su unica funcion es rotar
      el attester. ⚠️ **Eso NO es inocuo**: rotar el attester a una llave propia y firmarse un
      voucher alcanza los fondos de cualquier vault de **GitHub** (probado en
      `ReviewRound2.t.sol::test_attesterAdmin_SI_alcanzaLosFondosDeUnVaultGithub`). No alcanza los
      vaults de wallet ni los de X. `0x0` lo desactiva, y entonces una llave de attester perdida
      **congela para siempre** el ETH de todos los vaults de GitHub. O sea: la eleccion es entre un
      riesgo de liveness y uno de custodia. Leer `PENDIENTES.md` §2 y §3 antes de elegir.
- [ ] **GitHub OAuth app** (`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`) — paso a paso en
      `docs/DEPLOY-WEB.md` (callback: `https://<dominio>/api/attest/github/callback`).
- [ ] **Auditoria del contrato nuevo** — `PENDIENTES.md` §1. **Este es el gate real.**
- [ ] **Identidad piloto + recoveryDays** (propuesta: `github:0x-keezy`, `recoveryDays = 0`).
      Validos: **0 (nunca, el default del producto) o entre 30 y 3650**. 1..29 revierte
      `RecoveryWindowTooShort`.

> X/Twitter **no necesita llave**: usa el `XGeneralVerifier` de Flap, ya vivo en 4663
> (`0xccDaB0d5Bc6E0aCb8B157cffFA062688Aa849c17`). Es infra de un competidor, sin auth ni SLA — ver
> `PENDIENTES.md` §4 antes de promocionar esa ruta.

## 1. Verificar que el rail sigue donde lo dejamos

Todo lo de abajo es **estado mutable** del owner de pons (Safe 2-de-3
`0x263ed295dAFaE1d9AAdD6E56c4B6F9f38eE019Dd`), no constantes del protocolo. Correr esto ANTES de
deployar y ANTES de cada launch.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
R=https://rpc.mainnet.chain.robinhood.com
PONS=0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e

cast call $PONS "launchEnabled()(bool)"        --rpc-url $R   # esperado: true
cast call $PONS "launchFee()(uint256)"         --rpc-url $R   # esperado: 500000000000000
cast call $PONS "maxCreatorTaxBps()(uint256)"  --rpc-url $R   # esperado: 1000
cast call $PONS "launchConfigCount()(uint256)" --rpc-url $R   # esperado: 1
cast call $PONS "feeEscrow()(address)"         --rpc-url $R   # esperado: 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e
```

Si `launchEnabled` diera `false`, el gate publico esta cerrado y solo lanzan direcciones
whitelisteadas: **parar acá**, no hay nada que hacer del lado nuestro.

> El RPC publico esta detras de Cloudflare y **rate-limitea** una rafaga de llamadas (devuelve un
> HTML de challenge, no JSON). Si `cast` empieza a fallar con un 403 lleno de HTML, no es el
> contrato: es la puerta. Esperar y usar `--compute-units-per-second 40` en `forge`.

## 2. Correr el fork test antes de tocar nada

Es la prueba que los mocks no dan: lanza contra el factory REAL, tradea de verdad y cobra de verdad.

```bash
cd contracts
export DEPLOYER_PK=0x...   # la wallet que paga el deploy y el launch. NUNCA la del attester.

forge test --match-contract ForkPonsTest --fork-url robinhood --compute-units-per-second 40 -vv
# esperado: 10 passed; 0 failed
```

> **Un `forge test` pelado NO prueba nada de esto.** Sin `--fork-url` los 10 tests se reportan
> SKIPPED y el suite igual sale con exit 0 — o sea que un CI descuidado queda verde sin haber
> tocado pons. `REQUIRE_FORK=1` convierte ese skip en un fallo:
>
> ```bash
> REQUIRE_FORK=1 forge test --match-contract ForkPonsTest --fork-url robinhood --compute-units-per-second 40
> ```

## 3. Deploy de la factory

```bash
cd contracts

# 3.1 ENSAYO — sin --broadcast NO firma ni manda nada. Imprime el preflight y el costo estimado.
ATTESTER_ADDRESS=0x<attester> ATTESTER_ADMIN=0x<admin-o-vacio> \
  forge script script/DeployPons.s.sol --rpc-url robinhood --compute-units-per-second 40

# 3.2 REAL — recien aca se firma.
ATTESTER_ADDRESS=0x<attester> ATTESTER_ADMIN=0x<admin-o-vacio> \
  forge script script/DeployPons.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK
# anotar FACTORY=0x...
```

El script imprime los `constructor-args` ya encodeados. **No los vuelvas a tipear a mano** — las
cinco direcciones son inmutables en la factory y los vaults las copian a las suyas; un tipeo obliga
a redeployar y abandonar todos los vaults ya creados.

```bash
forge verify-contract $FACTORY src/RobinShareVaultFactory.sol:RobinShareVaultFactory \
  --chain-id 4663 --verifier blockscout \
  --verifier-url https://robinhoodchain.blockscout.com/api \
  --constructor-args <el hex que imprimio el script>
```

Verificacion post-deploy (todas obligatorias):

```bash
cast call $FACTORY "attester()(address)"    --rpc-url $R   # == ATTESTER_ADDRESS
cast call $FACTORY "feeEscrow()(address)"   --rpc-url $R   # == 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e
cast call $FACTORY "ponsFactory()(address)" --rpc-url $R   # == 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e
cast call $FACTORY "xVerifier()(address)"   --rpc-url $R   # == 0xccDaB0d5Bc6E0aCb8B157cffFA062688Aa849c17
cast call $FACTORY "attesterAdmin()(address)" --rpc-url $R # == lo que decidiste en el pre-flight
```

## 4. Web a Vercel

`NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY` + el resto de las env vars. Checklist completo en
`docs/DEPLOY-WEB.md`. Smoke: `/api/health` debe dar 200 con `attesterMatches:true` — hoy da **503**
porque nada de esto existe todavia.

## 5. El launch del piloto

**Opcion A — la pagina `/create` (la via del producto).** Conectar wallet → nombre/ticker → a quien
van las fees → creator tax → firmar **tres** transacciones. La pagina lee `launchFee` y
`maxCreatorTaxBps` en vivo y manda el pin `expectedEconomics`, asi que si pons movio los terminos el
launch revierte en vez de aterrizar bajo otras reglas. Si una de las tres firmas falla, volver a
apretar el boton **retoma donde quedo**: no se rehace lo ya hecho.

**Opcion B — CLI.** El orden NO es negociable: el vault va primero porque la creation code de la
curva de pons incluye el `creatorFeeRecipient`, asi que la direccion del token depende de la del
vault y no se puede predecir al reves.

```bash
# 5.1 · el vault. (uint8 identityType, string handle, address wallet, uint256 recoveryDays)
#      0=wallet · 1=github · 2=twitter. recoveryDays: 0 = nunca (default), o >= 30.
cast send $FACTORY "createVault(uint8,string,address,uint256)" \
  1 "0x-keezy" 0x0000000000000000000000000000000000000000 0 \
  --rpc-url $R --private-key $DEPLOYER_PK
# anotar el TX HASH que imprime y sacar el vault del recibo:
cast receipt <TX_HASH> --rpc-url $R
#   -> el log de VaultCreated emitido por $FACTORY. En Blockscout viene ya decodificado con
#      el campo `vault`; en el recibo crudo es el 3er valor del `data`.
VAULT=0x...   # pegarlo aca
cast call $FACTORY "isVault(address)(bool)" $VAULT --rpc-url $R   # DEBE dar true

# 5.2 · el pin de la economia (opcional pero MUY recomendado; 0x00.. lo desactiva)
ECON=$(cast call $PONS "previewLaunchEconomics(uint256,address)(bytes32)" \
  0 0x0000000000000000000000000000000000000000 --rpc-url $R)

# 5.3 · el launch. msg.value DEBE ser exactamente launchFee (ni un wei de mas).
#      creatorFeeRecipient = $VAULT · buybackEnabled = false · pairToken = 0x0 (ETH nativo)
#      creatorTaxBps <= maxCreatorTaxBps (1000 = 10%). SALT: cualquier valor no usado por esta
#      wallet — pons NO exige vanity, no hay nada que minar.
#
#      ⚠️ TODO STRING VACIO DEL TUPLE VA ENTRE COMILLAS — no solo los de `socials`, tambien
#      `logo` y `description` si los dejas en blanco. Sin las comillas `cast` tira
#      `parser error` apuntando al primer campo vacio. (Cazado dos veces: una en el review y
#      otra corriendolo de verdad contra un anvil forkeado.) Este comando esta VERIFICADO con
#      `cast calldata`: encodea y da el selector 0xf35abbcf.
SALT=$(cast keccak "robinshare/piloto/1")
# OJO: `cast call` imprime `500000000000000 [5e14]`, o sea DOS palabras. Metido directo en
# `--value $(...)` la sustitucion se parte y `cast send` recibe `[5e14]` como argumento suelto.
FEE=$(cast call $PONS "launchFee()(uint256)" --rpc-url $R | awk '{print $1}')
echo "FEE=$FEE"   # tiene que imprimir 500000000000000, sin corchetes
cast send $PONS \
  "launchToken((string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32),uint256,address)(address,address)" \
  '(RobinShare Pilot,RSHARE,https://github.com/0x-keezy.png,fees routed to a builder,("","","","https://github.com/0x-keezy",""),'"$VAULT"',1000,false,'"$ECON"','"$SALT"')' \
  0 0x0000000000000000000000000000000000000000 \
  --value $FEE \
  --rpc-url $R --private-key $DEPLOYER_PK

# TOKEN y CURVE salen del evento TokenLaunched. Van INDEXADOS, asi que estan en los topics
# del log de $PONS: topic[1] = token, topic[2] = curve (32 bytes, con 12 ceros de padding).
cast receipt <TX_HASH_DEL_LAUNCH> --rpc-url $R
TOKEN=0x...   # pegarlos aca
CURVE=0x...

# VERIFICAR ANTES DE ATAR. Si alguna de estas dos no da lo esperado, NO sigas:
cast call $CURVE "deployer()(address)" --rpc-url $R                 # DEBE dar $VAULT
cast call $PONS "getLaunchedToken(address)((address,address,address,address,address,uint256,uint24,int24,uint16,bool,uint8,uint256,uint256,uint256,bool))" $TOKEN --rpc-url $R

# 5.4 · atar vault <-> token. Permissionless: lo puede mandar cualquiera, y el contrato lo
#      verifica DOS veces contra el registro de pons (que las fees apunten aca, y que lo haya
#      lanzado nuestro propio launcher) — no hay que confiar en quien llama.
cast send $VAULT "attachToken(address)" $TOKEN --rpc-url $R --private-key $DEPLOYER_PK
```

> **El orden importa y el squat es real.** `attachToken` acepta un solo launch y despues queda
> fijo, asi que conviene mandar 5.4 apenas confirme 5.3. Un extrano no puede secuestrarlo (el
> contrato exige que el `deployer` del launch sea el mismo que creo el vault), pero un vault sin
> atar acumula fees en la curva sin ruta para barrerlas.

## 6. Verificacion post-launch (todas obligatorias)

```bash
cast call $PONS "getLaunchedToken(address)((address,address,address,address,address,uint256,uint24,int24,uint16,bool,uint8,uint256,uint256,uint256,bool))" $TOKEN --rpc-url $R
```

- [ ] `creatorFeeRecipient` == `$VAULT`.
- [ ] `pairToken` == `0x0`. **Si no lo es, `attachToken` revierte `PairMustBeNative` y el launch no
      sirve**: las fees se acreditarian en el ledger por-token del escrow y el vault entregaria cero.
- [ ] `buybackEnabled` == `false`.
- [ ] `cast call $CURVE "deployer()(address)"` == `$VAULT` — es lo que autoriza al vault a barrer.
      (Si no, `sweepCurve()` revierte `NotFeeSweepOperator` para siempre.)
- [ ] `cast call $VAULT "token()(address)"` == `$TOKEN` y `curve()` == `$CURVE`.
- [ ] `cast call $VAULT "recoveryAfter()(uint64)"` == lo elegido (0 = irrevocable). Es lo que la UI
      muestra como badge.
- [ ] Comprar una pizca en la curva → `cast send $VAULT "sweepCurve()"` → 
      `cast call 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e "balanceOf(address)(uint256)" $VAULT`
      debe subir → `cast send $VAULT "pull()"` → `cast balance $VAULT` debe subir.

## 7. Smoke del claim real

- Abrir `https://<dominio>/claim/$VAULT`, conectar, flujo GitHub → `claimAndBind` → el ETH llega a
  la payout wallet. Probado en fork: **un dev con 0 ETH cobro 0,08025 ETH sobre 0,75 ETH de volumen
  con un relayer pagando el gas** (`ForkPons.t.sol::test_fork_fullCycle_nativePair`).
- Despues: mas trades → `withdraw()` desde la payout wallet. Probado en fork (0,0321 ETH).

> ⚠️ **El relayer del fork test NO existe en el producto.** El contrato acepta que un tercero
> mande el `claimAndBind` (por eso el test lo prueba con un dev de 0 ETH), pero la web no tiene
> ninguna ruta que lo haga: hoy el gas del claim lo paga quien reclama. Construirlo necesita una
> wallet caliente fondeada → `PENDIENTES.md`.

### El take del creador: dos regimenes, y no hay que confundirlos

| Cuando | Take del creador sobre el volumen | Por que |
|---|---|---|
| En el **instante** del launch (t=0) | **72,3%** | el snipe tax arranca en 9.900 bps y **se suma al bucket del creador** |
| Dentro de la ventana de 3 s | entre 72,3% y 10,7% | el snipe tax **decae rapido**: `startBps >> ((elapsed*14)/window)`, o sea que a 1 s ya cayo ~5x |
| Pasados los 3 s | **10,7%** | `creatorTaxBps` 10% + el 70% de la base fee de 1% |

Las dos cifras estan fijadas contra la cadena real en
`ForkPons.t.sol::test_fork_feeSplit_dosRegimenes`. **La que hay que usar para cualquier
proyeccion es 10,7%**: la de la ventana solo se cobra si alguien tradea en los 3 segundos
posteriores al lanzamiento. Una version anterior de este runbook publicaba la primera como si
fuera la de todos los dias — un 7x.
- La ruta X como fast-follow con un tweet real, **no como gate del launch** (depende de infra de
  Flap sin SLA).
- Post en X: SOLO despues del claim verde.

## 8. Operacion continua: barrer temprano

`sweepCurve()` **no es opcional**. Medido: en una ventana de 404 s tradearon 118 curvas de pons y el
operador barrio solo 15; 5 de 7 curvas activas muestreadas tenian **0,857 ETH fuera del escrow** en
un solo instante. Ademas el owner de pons puede redirigir el `creatorFeeRecipient` con 3 dias de
aviso, y el cambio es **retroactivo sobre todo lo que no se haya barrido**. Barrer seguido es lo que
achica esa ventana.

Es permissionless — lo puede correr cualquiera, incluido un cron. **Hay un keeper escrito** que
recorre todos los vaults de la factory y barre sólo los que valen la pena:

```bash
cd web
# dry-run: dice qué barrería y no manda nada
NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY node scripts/keeper.mjs

# de verdad, y cada 15 minutos
KEEPER_PK=0x... NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY node scripts/keeper.mjs --send --watch 900
```

Decide simulando `harvest()` en cada vault (un `eth_call`, gratis), que devuelve **exactamente**
cuánto saldría incluyendo lo que está en la curva — que es justo lo que `pendingAmount()` no ve.
Sólo manda si supera `MIN_HARVEST_WEI` (default 0,0002 ETH), para no gastar gas moviendo polvo.

**Probado end-to-end** contra un anvil que forkea la cadena: con 1 ETH de volumen real,
`pendingAmount()` mostraba **0** mientras la curva tenía las fees; el keeper detectó **0,107 ETH**,
los barrió, y el vault quedó con 0,107 ETH. Gas: **0,000114 ETH**.

`KEEPER_PK` no necesita ningún privilegio: si se pierde, sólo se pierde la automatización.

A mano, para un solo vault:

```bash
cast send $VAULT "harvest()" --rpc-url $R --private-key $KEEPER_PK   # sweepCurve + pull
```

Sin saldo es un **no-op**, no un revert (el `claim()` de pons revierte `NoBalance()`; el vault
consulta el balance antes).

## 8.b El relayer del claim (opcional, pero es la promesa del producto)

Sin relayer, para cobrar el dev necesita ETH en 4663 — una cadena de la que nunca oyó hablar. O
sea que tiene que bridgear plata **antes** de poder cobrar plata. Con relayer, el server manda su
`claimAndBind` y paga el gas.

El contrato ya lo permitía (`claimAndBind` valida la **firma** del attester, no `msg.sender`;
probado en fork con un dev de 0 ETH). Lo que faltaba era la ruta, que ya está:

```bash
# prenderlo: una env var en Vercel
RELAYER_PK=0x<wallet dedicada, con poco saldo, sólo para esto>

# ver el estado en vivo
curl https://<dominio>/api/relay/claim
# → { "enabled": true, "address": "0x…", "balanceWei": "…" }
```

Si `RELAYER_PK` no está, la ruta responde 503, la UI **no ofrece** el botón sin gas y el dev firma
él mismo. O sea: se puede deployar sin relayer y prenderlo después, sin tocar código.

**Lo que lo protege de que te vacíen el saldo** (todo en `web/lib/relay.ts`, con 22 tests):

1. sólo se relayan vouchers firmados por **nuestro** attester vigente, sobre un digest que el
   server recalcula — y el attester sólo firma tras un OAuth real que matchea la identidad;
2. un vault ya bindeado no se relaya (límite natural por vault, sin estado nuestro);
3. el vault tiene que estar **atado a una moneda real**: para hacernos gastar gas hay que haber
   pagado un launch de pons (0,0005 ETH), que cuesta más que el gas;
4. piso de saldo y **simulación antes de firmar**: un claim que revertiría no se paga;
5. **techo de precio de gas** (`RELAYER_MAX_FEE_WEI`, default 2 gwei). La defensa 3 es en
   realidad una afirmación sobre el gas price — a 0,25 gwei el launch fee es 17× el gas, pero por
   encima de ~4,2 gwei se invierte y el ataque se vuelve rentable. El techo la ancla;
6. **sólo firmas canónicas**. Para toda firma existe una gemela malleada que recupera la misma
   dirección; el `ECDSA` de OpenZeppelin la rechaza en el contrato, así que aceptarla en el server
   sólo servía para pagar gas de transacciones que iban a revertir;
7. **un candado por vault tomado de forma síncrona**, antes de tocar la red. Con el chequeo al
   entrar y la marca cuatro round-trips después, 25 pedidos concurrentes conseguían 25
   transacciones firmadas — un doble click alcanzaba.

Lo que **no** cubre, dicho claro: alguien con una cuenta real de GitHub que pague launches de
verdad puede hacernos pagar el gas de sus propios claims. Es gasto acotado por launch y no le da
acceso a fondos ajenos.

## 9. Rollback / incidentes

- **El launch NO es reversible.** El token queda vivo.
- **No hay Guardian.** Se elimino entero: no existe `emergencyWithdrawNative` ni
  `setRescueForward` ni ninguna llave de emergencia. El unico camino por el que sale ETH es
  `withdraw()` al `boundWallet`, o `recoverUnclaimed` si el launcher fijo un plazo y nadie probo la
  identidad todavia.
- **Un vault huerfano es inofensivo**: si `createVault` salio pero el launch no, ese vault nunca
  recibe fees. No hay que hacer nada con el.
- **Launch sin `attachToken`**: recuperable en cualquier momento y por cualquiera, desde la pagina
  `/claim/<vault>` o con el `cast send` de §5.4. Mientras tanto las fees se acumulan en la curva
  (no se pierden, pero tampoco se pueden barrer).
- **`boundWallet` que no puede recibir ETH**: no es un incidente. El payout es PULL — la plata
  espera en el vault, y la identidad puede rotar la wallet con las rutas de claim o `rebindWallet`.
- **Attester perdido**: lo rota el attester vigente o `attesterAdmin`. Si `attesterAdmin` quedo en
  `0x0`, **no hay sucesor** y los vaults de GitHub quedan sin ruta de bind. Decision de §0.
- **pons redirige las fees de nuestro token**: hay 3 dias de aviso publico y auditable
  (`CreatorFeeRecipientChangeProposed`). Vale la pena monitorear ese evento.
- **El token gradua** (cruza 4,2 ETH de reserva real): pasa solo, dentro del `buy()` que cruza el
  umbral — no hay que disparar nada. Verificado en fork
  (`test_fork_postGraduation_noRompeElVaultYLoBarridoSigueCobrable`): la graduacion **barre y
  acredita al vault en el camino**, asi que no se pierde nada en el borde, y el claim sigue
  funcionando. **Pero desde ahi el vault ya no tiene ninguna ruta propia hacia las fees del pool**:
  `sweepCurve()` queda en no-op permanente y dependemos del `feeSweepOperator` de pons. Es una
  perdida de LIVENESS, no de fondos. Solo gradua ~1% de los launches.

## Apendice: gotchas

- **NO usar las cuentas default de anvil como receptoras en un fork de Robinhood.** En la chain real
  esas addresses tienen delegaciones EIP-7702 de un sweeper (`0x0436…f2d7`): el ETH que reciben
  desaparece y parece un bug del contrato. Usar addresses frescas (`cast wallet new` / `makeAddr`).
- **`msg.value` del launch es EXACTO.** Un wei de mas revierte `LaunchFeeNotPaid()`.
- **El salt es por-cuenta.** Reusarlo con los mismos terminos revierte porque el par ya existe en esa
  direccion. No hay que minar nada: pons no pide vanity.
- **No pinnees el bloque del fork.** El RPC publico de RH Chain **no es archival**: un fork pinneado a un bloque viejo muere con `metadata is not found`. Correr el fork test contra `latest` (que es lo que hace el comando de arriba) siempre funciona. Si hiciera falta pinnear —para cachear y que las corridas siguientes sean instantaneas— usar el RPC de Alchemy, que si es archival (`https://robinhood-mainnet.g.alchemy.com/v2/<KEY>`; la key de Jose vive en el `.env` gitignoreado de otro proyecto, NUNCA en este repo).
- **`launchFee` y `maxCreatorTaxBps` se mueven.** Son setters del owner de pons. Por eso §1 existe y
  por eso la web los lee en vivo en vez de hardcodearlos.
