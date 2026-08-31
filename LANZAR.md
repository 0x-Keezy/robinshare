# LANZAR — la hoja de ruta, en orden

Todo lo construible está hecho. Esto es lo que falta, y **cada paso depende de vos**.
El detalle completo está en [`docs/RUNBOOK-launch-pons.md`](docs/RUNBOOK-launch-pons.md); esto es
la versión corta.

> El contrato **no está auditado** y decidiste lanzar igual ([`PENDIENTES.md`](PENDIENTES.md) §1).
> Por eso el paso 4 —lanzar primero para vos mismo— no es una formalidad: es el único banco de
> pruebas real que vas a tener antes de lanzar para otra persona.

---

## Antes de empezar · estar en la rama correcta

```bash
git checkout feat/pons-web
```

Todo esto vive en `feat/pons-web`. En `main` no existen ni `DeployPons.s.sol` ni `LaunchPons.s.sol`
ni este archivo, así que si te equivocás de rama los comandos fallan solos — pero los scripts del
rail **viejo** (`Deploy.s.sol`, `LaunchPilot.s.sol`) sí están, y deployarían el rail de Flap. Por
eso ahora se niegan a correr salvo que pidas explícitamente `I_MEAN_THE_FLAP_RAIL=true`.

---

## Paso 0 · Las dos wallets (5 minutos)

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cast wallet new     # ésta es la del ATTESTER. Guardá la PK. NO le mandes fondos.
```

Y necesitás una **wallet deployer** con ETH en Robinhood Chain (4663). Medido: el deploy + el
piloto son **~0,0065 ETH**; con **0,02** vas cómodo. Puede ser una que ya tengas, pero **tiene que
ser distinta de la del attester**.

> ⚠️ La llave del attester **es una llave de custodia**, no de firma: quien la tenga puede bindear
> cualquier vault de GitHub a la wallet que quiera. Tratala como tal (`PENDIENTES.md` §2).

**`ATTESTER_ADMIN` — ya decidido**: una **wallet fría distinta** del deployer y del attester
(`PENDIENTES.md` §3). Cubre el riesgo de perder la llave del attester —que congelaría el ETH de
todos los vaults de GitHub— aceptando un segundo actor con alcance de custodia, pero en frío.

O sea que necesitás **tres direcciones distintas**: deployer, attester y admin. El preflight
verifica que lo sean, y después del deploy que el `attesterAdmin` on-chain sea el correcto — es
**inmutable**, así que equivocarse ahí obliga a redeployar.

---

## Paso 1 · ¿Se puede lanzar hoy? (30 segundos)

```bash
cd web
DEPLOYER_ADDRESS=0x... ATTESTER_ADDRESS=0x... ATTESTER_ADMIN=0x... node scripts/preflight.mjs
```

No manda nada y no necesita ninguna private key. Si sale con **LISTO PARA LANZAR**, seguí.

Con las tres direcciones también verifica lo que decidiste en §3: que sean **distintas** entre sí.
Y si les pasás una dirección con el casing roto, te dice que el checksum no cierra en vez de un
"inválida" a secas — minúsculas y checksum correcto pasan las dos.

---

## Paso 2 · Deploy de la factory (~0,0022 ETH)

```bash
cd ../contracts     # (venís de web/)

# ensayo: sin --broadcast no firma ni manda nada
ATTESTER_ADDRESS=0x... ATTESTER_ADMIN=0x... \
  forge script script/DeployPons.s.sol --rpc-url robinhood --compute-units-per-second 40

# real
ATTESTER_ADDRESS=0x... ATTESTER_ADMIN=0x... \
  forge script script/DeployPons.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK
```

Anotá la dirección de la factory. El script imprime los `constructor-args` para
`forge verify-contract` — no los vuelvas a tipear.

---

## Paso 3 · Conectar la web

Crear la **GitHub OAuth App** (github.com/settings/developers → New OAuth App; el callback exacto
está en `docs/DEPLOY-WEB.md`) y poner en Vercel:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_FACTORY_ADDRESS` | el paso 2 |
| `ATTESTER_PK` | la PK del `cast wallet new` del paso 0 |
| `ATTESTER_STATE_SECRET` | `openssl rand -hex 32` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | la OAuth App |
| `APP_BASE_URL` | tu dominio, exacto |

Verificá: `curl https://<dominio>/api/health` tiene que dar **200** con `attesterMatches: true`.
Si da `false`, la PK no corresponde al attester de la factory y **todo claim de GitHub va a
fallar** — el preflight del paso 1 también lo caza.

---

## Paso 4 · El piloto, con tu propia plata (~0,0042 ETH)

> El launch fee son 0,0005, pero el gas es ~7× eso: `launchToken` despliega el token **y** la
> curva (8,26M de gas). Medido en fork.

```bash
cd ../contracts
export FACTORY=0x...                  # el del paso 2
export DESCRIPTION="fees routed to a builder"    # queda en el token, para siempre
export NAME="RobinShare Pilot"  SYMBOL=RSHARE
export IDENTITY_TYPE=1                # 1 = github
export IDENTITY_VALUE=0x-keezy
export RECOVERY_DAYS=0                # 0 = irrevocable, el default del producto
export CREATOR_TAX_BPS=1000           # 10%
export LOGO=https://github.com/0x-keezy.png

# ensayo (--sender para que también valide que tenés con qué pagar)
forge script script/LaunchPons.s.sol --rpc-url robinhood --compute-units-per-second 40 \
  --sender $(cast wallet address $DEPLOYER_PK)
# real
forge script script/LaunchPons.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK

# y DESPUÉS, verificando contra la cadena (no contra la simulación):
VERIFY_VAULT=0x... VERIFY_TOKEN=0x... forge script script/LaunchPons.s.sol --rpc-url robinhood
```

Hace las tres transacciones y se niega **antes de gastar** si algo está mal: la factory
equivocada, el tax fuera de rango, pons con el launch cerrado, o **un vault que ya existe para esa
identidad** (`ALLOW_SECOND_VAULT=true` para forzarlo — sin esa guarda, un reintento tras un
timeout del RPC lanza una segunda moneda con el mismo ticker). Al final imprime la URL de claim
del builder.

**Después**: comprá una pizca de tu propia moneda, entrá a `/claim/<vault>`, y cobrá con el flujo
de GitHub. Ahí es donde el producto deja de ser código y pasa a existir.

---

## Paso 5 · Las dos piezas opcionales

Ninguna hace falta para el piloto; las dos importan cuando lances para otros.

**Relayer** — sin él, el builder paga su propio gas para cobrar. Con él, no necesita ETH.
Una env var más en Vercel:

```
RELAYER_PK=0x<wallet dedicada, con poco saldo, sólo para esto>
```

Si no está, la ruta responde 503 y la UI ofrece el camino normal. Se prende después sin tocar
código.

**Keeper** — en pons las fees se quedan en la curva hasta que alguien las empuja, y el cambio de
recipient de pons es **retroactivo sobre lo no barrido**. Un cron:

```bash
cd web
KEEPER_PK=0x... NEXT_PUBLIC_FACTORY_ADDRESS=0x... node scripts/keeper.mjs --send --watch 900
```

`harvest()` es permissionless: esa wallet no necesita ningún privilegio.

---

## Lo que sigue sin estar probado, y conviene que sepas

- **La ruta X nunca funcionó de punta a punta**, en ningún lado. El fork sólo prueba que el
  verifier real rechaza una firma forjada; el camino positivo necesita un tweet real. Para el
  piloto usá **GitHub**.
- **El claim real en mainnet** sólo existe en fork y en anvil. El paso 4 es lo que lo convierte
  en un hecho.
- Post-graduación el vault **no tiene ruta propia** a las fees del pool: depende del operador de
  pons. Gradúa ~1% de los launches.

## Decisiones que siguen abiertas

`PENDIENTES.md` — el push del repo (§6), el disclosure del conflicto con PonsVault (§5), si la
landing declara que no está auditado (§8, pesa más ahora), y si conservás la ruta X pese a
depender de infra de Flap (§4).
