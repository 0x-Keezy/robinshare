# RobinShare — contract code for review (v2, post-preaudit)

This package responds to your preaudit of 2026-07-15. It now contains the full `src/` tree,
**the complete test suite** (`test/`, per "blocks sign-off"), and `foundry.toml`.

## Fixes in response to the preaudit

| # | Your finding | Resolution | Covering tests |
|---|---|---|---|
| High 1 | VaultPortal gate not hardcoded | **Fixed as you recommended**: constructor param removed entirely; `newVault` gates on the inherited `_getVaultPortal()` (per-chain hardcoded, your reference pattern). A `vaultPortal()` view exposes the effective gate for post-deploy verification. | `test_portalGate_*` (3) |
| High 2 | Twitter vaults permanently bricked while `xVerifier == 0` on the chain | **Fixed as you recommended**: the factory rejects `newVault()` for `identityType=twitter` when `_getXVerifier()` returns zero on the current chain. | `test_twitter_sinVerifier_*` (2), `test_twitter_conVerifier_creaEnBSC` |
| Critical | TYPE_WALLET vaults have zero recovery path if the wallet can't receive ETH | **Fixed**: new `identityWallet` immutable (the original identity, never mutated) + `rebindWallet(address newPayout)` gated to `msg.sender == identityWallet`. A misconfigured contract wallet that can't *receive* can still *execute* a call and rotate its payout to a working address — preserving the trust model (only the proven identity directs funds). A wallet that can neither receive nor execute is equivalent to a burned key in any design; that residual case is now covered by the Guardian hatch below. | `test_rebindWallet_*` (4) |
| High | `recoverUnclaimed()` push-only to a possibly-broken `creator` | **Fixed**: signature is now `recoverUnclaimed(address to)`. Since the destination became caller-chosen, the function is no longer permissionless: gated to `msg.sender == creator`. | `test_recover_*` (3 new + 4 updated) |
| Medium | No Guardian anywhere | **Adopted your Option A** (explicit product decision by the owner): `emergencyWithdrawNative(address to)` gated by the inherited `onlyGuardian` (official per-chain Guardian, `0x0000b487…0000` on 4663). CEI, full-balance rescue, does not touch `totalPaid`. | `test_emergencyWithdraw_*` (3) |
| High (new) | Attester key immutable everywhere, no rotation path | **Fixed** (product decision): `factory.attester` is now storage with `rotateAttester(address)` gated to the *current attester key itself* (no admin, no Guardian). Vaults no longer store the attester — they hold an immutable `attesterSource` (the factory) and read the current attester **live** at claim time, so a rotation instantly invalidates old-key vouchers across every vault, past and future. The read-side ABI (`attester()` view on vault and factory) is unchanged. | `test_rotateAttester_*` (3) |

Notes on EIP-712 mechanics: unchanged (your review passed them) — `bindDigest`, nonce, deadline,
domain separator per vault all as reviewed.

## Verification we ran before sending

- **71/71 unit tests green** (includes 16 new tests born red against the pre-fix code).
- **Fork E2E green against live Robinhood Chain** (`forge test --match-contract ForkTest
  --fork-url robinhood`): real launch through the real VaultPortal (exercising the hardcoded
  gate) → tax → GitHub claim (attester read live from the factory) → sweep.

## Contracts under review (ours)

- `src/SocialFeeEscrow.sol` — the vault (wallet / GitHub / X identity; claim paths per type;
  `rebindWallet`; `recoverUnclaimed(to)`; Guardian `emergencyWithdrawNative`).
- `src/SocialFeeEscrowFactory.sol` — Portal-gated factory (hardcoded gate), on-chain identity
  normalization, canonical rotatable attester, twitter-verifier availability gate.

Everything under `src/flap/` is your own interfaces/bases vendored for compilation
(not under review). `src/flap/oz-shims/` shims the upgradeable-OZ import path.

## Build

Foundry, `solc 0.8.26`, `optimizer_runs = 200`, `via_ir = true`. Deps: OpenZeppelin Contracts
v5.4.0 + forge-std (tests). Full repo: <https://github.com/0x-Keezy/robinshare>.

Contact: @K3zzi (TG) · @0xKeezy
