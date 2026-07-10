# FLEDGE contracts

`SocialFeeEscrow` + `SocialFeeEscrowFactory` — el motor on-chain de FLEDGE sobre Flap × Robinhood Chain (4663).

## Qué es cada contrato

- **`SocialFeeEscrow`** — inmutable. Recibe el tax (ETH nativo) del TaxProcessor de Flap y solo lo entrega a la wallet que probó la identidad (wallet / github / twitter). Sin owner, sin pause, sin upgrade, sin funciones privilegiadas. `receive()` VACÍO (regla dura: si revierte, el tax se pierde al fee receiver de Flap sin retry).
- **`SocialFeeEscrowFactory`** — la llama `VaultPortal.newTokenV6WithVault`. Valida/normaliza la identidad on-chain, despliega un escrow por token, mantiene el registro `identityHash → vaults[]`, y expone `vaultDataSchema()` para el form auto-generado de flap.sh.

## Invariantes (fijadas por los tests)

1. El ETH solo sale hacia `boundWallet` (identidad probada) o al `creator` vía `recoverUnclaimed` (solo si nunca hubo bind y venció el plazo). Ningún otro egress. **Peor caso de bug = fondos trabados, nunca robo por tercero.**
2. `receive()` nunca revierte (probado con stipend 2300 y fuzz).
3. Voucher no replayable (nonce), no válido en otro vault (verifyingContract) ni otra chain (chainId) ni tras `deadline`.
4. Sin funciones privilegiadas ⇒ el mandato Guardian de Flap se satisface por vacuidad (no dependemos del Guardian de Robinhood, aún sin resolver).

## Correr

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge build
forge test                                                       # unit (40 tests); el fork test skipea sin --fork-url
forge test --match-contract ForkTest --fork-url robinhood -vvv   # e2e real contra la chain
```

## Hallazgos de fork test (2026-07-10) — verificados on-chain

El fork test lanza un token real vía el `VaultPortal` de Robinhood Chain y corre launch → tax → claim. **Resultado: E2E VERDE.** El token real igualó exactamente al predicho localmente.

- **Vanity obligatorio `0x7777`.** El portal revierte `InvalidVanity(address)` (selector `0x7576ca0a`) si el tax token no termina en `7777`.
- **⚠️ `predictTaxTokenV1Address` es el predictor EQUIVOCADO para la ruta V6.** Da el address de un impl distinto (V1) que NO coincide con el que el portal calcula para `newTokenV6WithVault`.
- **Derivación correcta del tax token V6** (crackeada contra el revert y verificada con match EXACTO en el launch real):
  ```
  tokenAddr = CREATE2(
      deployer      = Portal (0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09),
      salt          = el salt raw (bytes32, sin transformar),
      initCodeHash  = keccak256(EIP-1167 minimal-proxy(TAX_TOKEN_V3_IMPL 0x7777…3333))
                    = 0x6ce33cede557fe3331031c87bf9be28f493a6086cdc8770ac0a4c7dd7320dea7
  )
  ```
  → **el salt se mina LOCALMENTE** (keccak puro, sin RPC) buscando sufijo `7777`. Ver `scripts/mine-salt.mjs` y `_predictV6` en `test/Fork.t.sol`.
- **⚠️ El vault se crea ANTES del check de vanity** (natspec + confirmado: un staticcall/eth_call del launch revierte con returndata VACÍA, no `InvalidVanity`). Por eso NO se puede minar el salt vía `eth_call` del launch — hay que predecir el address off-chain con la derivación de arriba.
- **Params válidos del launch (verificados):** `dexThresh = FOUR_FIFTHS (1)`, `migratorType = V2_MIGRATOR (1)`, `dexId = DEX0 (0)`, `lpFeeProfile = LP_FEE_PROFILE_STANDARD (0)`, `tokenVersion = TOKEN_TAXED_V3 (6)`, `quoteToken = address(0)` (ETH nativo), `value = quoteAmt` (dev-buy). Receta piloto: `buyTaxRate/sellTaxRate = 300` (3%), `mktBps = 10000` (100% al escrow), `antiFarmerDuration = 3 days`, `taxDuration = 3153600000` (~100 años).
- **Enums:** `DexThreshType` vive en `IPortalCommonTypes`; el resto (`MigratorType`, `DEXId`, `V3LPFeeProfile`, `TokenVersion`) en `IPortalTypes`.

## Deploy

```bash
forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK
```

## ⚠️ GUARDIAN placeholder

`src/flap/RobinhoodAddresses.sol` tiene `GUARDIAN = 0x…dEaD` (placeholder). Este proyecto **no lo usa** (cero funciones privilegiadas), pero no lo trates como real. El deploy no depende de él.

## Build notes

- `via_ir = true` (necesario: `newVault` + `description()` con `string.concat` tocan stack-too-deep sin él).
- OZ v5.4.0. Interfaces Flap vendored de AppleHood; un shim en `src/flap/oz-shims/` alias-ea `IAccessControlUpgradeable` (OZ v4 upgradeable) a la `IAccessControl` de v5.
