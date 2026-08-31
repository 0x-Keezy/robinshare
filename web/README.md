# FLEDGE web (attester + dApp de claim)

> ⚠️ **ESTE README DESCRIBE EL RAIL DE FLAP, QUE YA NO ES LA LINEA VIVA.**
>
> RobinShare se porto al launchpad **pons v2** (misma cadena, Robinhood Chain 4663). En el rail
> nuevo no hay `VaultPortal`, ni vanity `0x7777`, ni Guardian, y los contratos son
> `RobinShareVault` + `RobinShareVaultFactory`. Lo de abajo sigue siendo correcto **para la rama
> `flap-rail` y el tag `audited-v3`**, y se conserva por eso.
>
> Para el rail vivo: [`docs/superpowers/specs/2026-08-29-robinshare-pons-port-design.md`](../docs/superpowers/specs/2026-08-29-robinshare-pons-port-design.md)
> (diseno), [`docs/RUNBOOK-launch-pons.md`](../docs/RUNBOOK-launch-pons.md) (operacion) y
> [`PENDIENTES.md`](../PENDIENTES.md) (lo que falta decidir). **El contrato nuevo no esta auditado.**

App Next.js 16 que contiene **el attester** (API routes que verifican GitHub/X y firman vouchers EIP-712) y **el dApp de claim** (lookup de vaults por identidad, prueba de identidad, cobro).

## Cómo funciona

El escrow on-chain es agnóstico a la identidad: solo verifica UNA firma. El attester (este server) hace la verificación web2 y firma el `bindDigest` que el propio vault expone — **cero re-implementación del typed-data** (fuente única de verdad on-chain).

- **wallet**: sin attester, la wallet ya está bindeada al crear el token → `sweep()`.
- **github**: OAuth (`/api/attest/github/start` → GitHub → `/callback`) confirma que el login == la identidad del vault → firma voucher.
- **twitter/X**: oráculo oficial de Flap `XGeneralVerifier` — el usuario tuitea el texto de `expectedTweet`, `/api/x-prove` pide la prueba firmada al oráculo de Flap, y el vault la valida on-chain con `claimByProof`. Sin env, sin Reclaim.

Regla dura: el attester **lee `identityType`/`identityValue`/`bindDigest` del vault on-chain**, nunca confía en datos del cliente.

## Dev

```bash
# 1) anvil fork de Robinhood en otra terminal:
anvil --fork-url https://rpc.mainnet.chain.robinhood.com
# 2) .env.local (copiar de .env.example) — al menos:
#    NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
#    NEXT_PUBLIC_FACTORY_ADDRESS=<factory deployada en el fork>
#    ATTESTER_PK / ATTESTER_STATE_SECRET / GITHUB_*
npm run dev
npx vitest run        # la suite completa: state HMAC, firma bindDigest, gates de identidad de las rutas
npm run build
```

## Deploy (Vercel)

- Proyecto nuevo bajo la cuenta `0xkeezy-3892`, root dir `web/`.
- Envs de `.env.example`. **Secretos server-only** (nunca `NEXT_PUBLIC_`): `ATTESTER_PK`, `ATTESTER_STATE_SECRET`, `GITHUB_CLIENT_SECRET`.
- `APP_BASE_URL` = el dominio de prod (para el redirect del OAuth de GitHub).

## El attester y su modelo de confianza

- `ATTESTER_PK` es una **wallet dedicada NUEVA, sin fondos**, que solo firma vouchers. Su address se pasa al desplegar la **factory** como attester canónico (los escrows no lo dejan elegir al creator — ver review en `contracts/README.md`).
- Riesgo aceptado v1: si la key del attester se compromete, un atacante puede re-bindear los vaults de esa factory. Mitigación: key en env de Vercel (no reusar), montos de piloto. v2: threshold/multi-attester (la ruta X ya no depende de esto — usa el `XGeneralVerifier` on-chain de Flap, no una key propia).
- `scripts/attest-manual.mjs`: escape hatch de la ruta github si el OAuth se cae (verificación humana fuera de banda, misma key). Documentado como centralizado.
