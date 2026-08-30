# RUNBOOK — Launch de RobinShare sobre pons v2 (Robinhood Chain 4663)

> **Estado: LISTO PARA AUDITAR, NO PARA DEPLOYAR.** El ciclo entero esta probado contra los
> contratos REALES de pons en fork (`contracts/test/ForkPons.t.sol`, 7 tests verdes) y el script de
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
- [ ] **`ATTESTER_ADMIN`** — decision abierta, ver `PENDIENTES.md` §3. Es un co-gate que SOLO puede
      rotar el attester (no toca fondos, no firma vouchers). `0x0` lo desactiva, y entonces una
      llave de attester perdida **congela para siempre** el ETH de todos los vaults de GitHub.
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
forge test --match-contract ForkPonsTest --fork-url robinhood --compute-units-per-second 40 -vv
# esperado: 7 passed; 0 failed
```

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
# sacar VAULT del evento VaultCreated del receipt:
#   cast logs --address $FACTORY "VaultCreated(bytes32,uint8,string,address,address,uint64)" ...

# 5.2 · el pin de la economia (opcional pero recomendado; 0x00.. lo desactiva)
ECON=$(cast call $PONS "previewLaunchEconomics(uint256,address)(bytes32)" \
  0 0x0000000000000000000000000000000000000000 --rpc-url $R)

# 5.3 · el launch. msg.value DEBE ser exactamente launchFee (ni un wei de mas).
#      creatorFeeRecipient = $VAULT · buybackEnabled = false · pairToken = 0x0 (ETH nativo)
#      creatorTaxBps <= maxCreatorTaxBps (1000 = 10%). SALT: cualquier valor no usado por esta
#      wallet — pons NO exige vanity, no hay nada que minar.
SALT=$(cast keccak "robinshare/piloto/1")
cast send $PONS \
  "launchToken((string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32),uint256,address)(address,address)" \
  "(RobinShare Pilot,RSHARE,https://github.com/0x-keezy.png,fees routed to a builder,(,,,https://github.com/0x-keezy,),$VAULT,1000,false,$ECON,$SALT)" \
  0 0x0000000000000000000000000000000000000000 \
  --value 500000000000000 --rpc-url $R --private-key $DEPLOYER_PK
# sacar TOKEN y CURVE del evento TokenLaunched

# 5.4 · atar vault <-> token. Permissionless: lo puede mandar cualquiera, y el contrato lo
#      verifica contra el registro de pons — no hay que confiar en quien llama.
cast send $VAULT "attachToken(address)" $TOKEN --rpc-url $R --private-key $DEPLOYER_PK
```

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
  la payout wallet. Probado en fork: **un dev con 0 ETH cobro 0,54225 ETH con un relayer pagando el
  gas** (`ForkPons.t.sol::test_fork_fullCycle_nativePair`).
- Despues: mas trades → `withdraw()` desde la payout wallet. Probado en fork (0,2169 ETH).
- La ruta X como fast-follow con un tweet real, **no como gate del launch** (depende de infra de
  Flap sin SLA).
- Post en X: SOLO despues del claim verde.

## 8. Operacion continua: barrer temprano

`sweepCurve()` **no es opcional**. Medido: en una ventana de 404 s tradearon 118 curvas de pons y el
operador barrio solo 15; 5 de 7 curvas activas muestreadas tenian **0,857 ETH fuera del escrow** en
un solo instante. Ademas el owner de pons puede redirigir el `creatorFeeRecipient` con 3 dias de
aviso, y el cambio es **retroactivo sobre todo lo que no se haya barrido**. Barrer seguido es lo que
achica esa ventana.

Es permissionless — lo puede correr cualquiera, incluido un cron:

```bash
cast send $VAULT "harvest()" --rpc-url $R --private-key $KEEPER_PK   # sweepCurve + pull
```

Sin saldo es un **no-op**, no un revert (el `claim()` de pons revierte `NoBalance()`; el vault
consulta el balance antes).

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
