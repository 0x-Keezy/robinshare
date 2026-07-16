# RobinShare — contract code for review

Scope requested: contract code only. This zip contains the full `src/` tree plus `foundry.toml`
(compiler settings), nothing else.

## Contracts under review (ours)

| File | LOC | Role |
|---|---|---|
| `src/SocialFeeEscrow.sol` | 284 | The vault. Immutable, no owner, empty `receive()`. Holds trading fees for ONE social identity (wallet / GitHub / X). Claim paths: EIP-712 voucher signed by the canonical attester (`claimAndBind`, GitHub-only), direct `sweep()` for wallet-type, and `claimByProof` via Flap's on-chain `XGeneralVerifier` oracle for X. Parametric `recoverUnclaimed` (`recoveryDays` set at launch, 0 = never, never after bind). |
| `src/SocialFeeEscrowFactory.sol` | 190 | Portal-only factory (`newVault` called by the VaultPortal during token launch). On-chain identity normalization, canonical attester injected via constructor (creators cannot choose it), vault registry, schema v2.2. |

## Vendored context (yours / shims — not under review)

- `src/flap/` — interfaces and base contracts vendored from Flap's public code
  (`IVaultFactory`, `IVaultSchemasV1`, `IXGeneralVerifier`, `VaultBaseV2`,
  `VaultFactoryBaseV2`, `RobinhoodAddresses`, …).
- `src/flap/oz-shims/` — minimal shim for the upgradeable-OZ import path your bases expect.

## Build

- Foundry, `solc 0.8.26`, `optimizer_runs = 200`, `via_ir = true` (see `foundry.toml`).
- External dep: OpenZeppelin Contracts **v5.4.0** (`ECDSA`, `EIP712`, `Strings`) — standard
  remapping `openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/`.

## Reference

- Full repo (tests included — 52 unit + fork E2E against Robinhood Chain mainnet):
  <https://github.com/0x-Keezy/robinshare> (`contracts/` folder).
- X claim path verified against the live `XGeneralVerifier` on BNB (`0xcA8D…b3E4`);
  Robinhood address is constructor-injected, pending your deployment.

Contact: @K3zzi (TG) · @0xKeezy
