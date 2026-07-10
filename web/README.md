# FLEDGE web (attester + dApp de claim)

App Next.js 16 que contiene **el attester** (API routes que verifican GitHub/X y firman vouchers EIP-712) y **el dApp de claim** (lookup de vaults por identidad, prueba de identidad, cobro).

## Cómo funciona

El escrow on-chain es agnóstico a la identidad: solo verifica UNA firma. El attester (este server) hace la verificación web2 y firma el `bindDigest` que el propio vault expone — **cero re-implementación del typed-data** (fuente única de verdad on-chain).

- **wallet**: sin attester, la wallet ya está bindeada al crear el token → `sweep()`.
- **github**: OAuth (`/api/attest/github/start` → GitHub → `/callback`) confirma que el login == la identidad del vault → firma voucher.
- **twitter/X**: prueba zkTLS de Reclaim (`/api/attest/twitter/init` + `/verify`) confirma el username → firma voucher.

Regla dura: el attester **lee `identityType`/`identityValue`/`bindDigest` del vault on-chain**, nunca confía en datos del cliente.

## Dev

```bash
# 1) anvil fork de Robinhood en otra terminal:
anvil --fork-url https://rpc.mainnet.chain.robinhood.com
# 2) .env.local (copiar de .env.example) — al menos:
#    NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
#    NEXT_PUBLIC_FACTORY_ADDRESS=<factory deployada en el fork>
#    ATTESTER_PK / ATTESTER_STATE_SECRET / GITHUB_* / RECLAIM_*
npm run dev
npx vitest run        # 10 tests: state HMAC, firma bindDigest, gates de identidad de las rutas
npm run build
```

## Deploy (Vercel)

- Proyecto nuevo bajo la cuenta `0xkeezy-3892`, root dir `web/`.
- Envs de `.env.example`. **Secretos server-only** (nunca `NEXT_PUBLIC_`): `ATTESTER_PK`, `ATTESTER_STATE_SECRET`, `GITHUB_CLIENT_SECRET`, `RECLAIM_APP_SECRET`.
- `APP_BASE_URL` = el dominio de prod (para el redirect del OAuth de GitHub).

## El attester y su modelo de confianza

- `ATTESTER_PK` es una **wallet dedicada NUEVA, sin fondos**, que solo firma vouchers. Su address se pasa al desplegar la **factory** como attester canónico (los escrows no lo dejan elegir al creator — ver review en `contracts/README.md`).
- Riesgo aceptado v1: si la key del attester se compromete, un atacante puede re-bindear los vaults de esa factory. Mitigación: key en env de Vercel (no reusar), montos de piloto. v2: threshold/multi-attester o verifier de Reclaim on-chain.
- `scripts/attest-manual.mjs`: escape hatch si GitHub/Reclaim se caen (verificación humana fuera de banda, misma key). Documentado como centralizado.
