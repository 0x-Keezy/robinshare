# RobinShare — contract code for review (v3, post-audit)

## Post-v3 — Robinhood's official XGeneralVerifier wired in (2026-07-16)

Flap deployed its official `XGeneralVerifier` on Robinhood Chain and Jose verified it
on-chain (has code, chain id 4663): `0xccDaB0d5Bc6E0aCb8B157cffFA062688Aa849c17` (docs.flap.sh).
Added as `RobinhoodAddresses.X_VERIFIER`; `SocialFeeEscrowFactory._getXVerifier()` now returns it
for `block.chainid == 4663` instead of `address(0)` (BSC 56 unchanged). This resolves the
preaudit High #2 gate for Robinhood specifically: twitter vaults can now be **created** there too
(previously rejected with `"x verifier not deployed on this chain"`), and the twitter claim path
(`claimByProof`) is now live end-to-end on Robinhood, not just BSC.

New TDD coverage in `test/AuditFixes.t.sol`: `test_xVerifier_robinhood_devuelveLaDireccionOficial`,
`test_xVerifier_bsc_sigueSiendoElDeBSC`, `test_twitterVault_enRobinhood_bakeaElVerifier` (all born
red against the pre-fix code, now green). The preexisting `test_twitter_sinVerifier_rechazadoAlCrear`
/ `test_twitter_sinVerifier_charsetRevientaPrimero` (which used to exercise chain 4663 as the
"verifier not deployed" case) moved to BSC Testnet (97, supported by `_getVaultPortal` but with no
`_getXVerifier` entry) to keep covering the anti-brick gate for chains Flap hasn't reached yet.

`forge test`: 95/95 green (92 pre-existing + 3 new). Fork E2E green against live Robinhood RPC.
`SocialFeeEscrowFactory` runtime size: 24,116 B, margin 460 B under the 24576 B EIP-170 cap
(measured with `forge build --sizes`) — still tight but not regressed materially from the 493 B
pre-existing margin.

## v3 — response to GT's formal audit report (f70e5476, 2026-07-16)

The owner reviewed all 6 findings and marked them all **TP** — every one is fixed in this
revision. See `AUDIT-STATUS-f70e5476.md` for the finding-by-finding sign-off copy of your report.

| # | Finding | Severity | Resolution | Covering tests |
|---|---|---|---|---|
| 1 | `_parseType` used a standalone `revert(unicode"...")` instead of the mandated `require(cond, "msg")` form (SYS-REQ-LITERAL-ERRORS) | High | Replaced with `require(false, unicode"...")`, same condition, same message, same order (charset/length errors still surface first from `newVault`'s call sites). | `test_F1_parseType_tipoInvalido_usaFormaRequire`, plus the pre-existing `test_tipoInvalido_y_recoveryCap` unaffected (same revert string). |
| 2 | UI-facing view strings (`description()`, `vaultUISchema()`, `vaultDataSchema()`, `tokenCreationPolicies()`) were English-only while every require/revert is bilingual (SYS-REQ-MULTILANG) | High | Every user-facing view string now carries a `English / 中文` form. `description()` builds a full English sentence and a full Chinese mirror (not fragment-by-fragment) so both read grammatically, joined by `" / "`. Schema/method/field descriptions on both contracts got inline `"... / ..."` translations. Chinese text was kept deliberately terse on the **factory** side (see finding-2/EIP-170 note below) since every added byte counts against the 24576 B runtime cap; the **vault** side had 10 KB+ of headroom so its translations are fuller. | `test_F2_description_esBilingue`, `test_F2_vaultUISchema_esBilingue`, `test_F2_factorySchemas_sonBilingues`. |
| 3 | `recoveryDays` had no minimum (only `<= 3650`), letting a creator seize an unclaimed social escrow before the real identity had a fair chance to claim it (COM-FUND-DIVERSION) | High | Added a floor: `recoveryDays == 0 \|\| recoveryDays >= 30` (0 still means "never"; upper bound `<= 3650` unchanged). `vaultDataSchema()`'s `recoveryDays` field description now states the 30–3650 range. | `test_F3_recoveryDays_menorA30_reverts`, `test_F3_recoveryDays_cero_siempreOk`, `test_F3_recoveryDays_treinta_ok`, `test_F3_recoveryDays_treintaCincuenta_ok`, `test_F3_recoveryDays_masDelMax_reverts` (existing `test_tipoInvalido_y_recoveryCap` upper-bound case unaffected). |
| 4 | Non-upgradeable vault had no Guardian-controlled `receive()` forward switch — only after-the-fact `emergencyWithdrawNative` (SYS-REQ-RESCUE-MECHANISM) | High | New Guardian-only `setRescueForward(bool on, address to)` + `rescueForward`/`rescueTo` storage. `receive()` now best-effort forwards `msg.value` to `rescueTo` via `.call` when the switch is on, emitting `Forwarded`; it **never reverts** — if the forward fails the ETH simply stays in the vault (still rescuable via `emergencyWithdrawNative`). Confirmed viable against Flap's actual tax-delivery mechanism: `.call` under Rule 005 (<1M gas), not a 2300-gas stipend (`test/Fork.t.sol`). | `test_F4_receive_sinSwitch_acumulaNormal`, `test_F4_guardian_activaForward_ySeForwardea`, `test_F4_forwardATargetQueRevierte_receiveNuncaRevierte`, `test_F4_setRescueForward_soloGuardian`, `test_F4_setRescueForward_onSinDestino_reverts`, `test_F4_receiveConForward_gasBajo1M`. |
| 5 | `rotateAttester` was self-gated (`msg.sender == attester` only) — the Guardian had no path to rotate a lost/compromised attester key, which would permanently break `claimAndBind` for every GitHub vault (SYS-REQ-GUARDIAN-ACCESS) | High | Gate is now `msg.sender == attester \|\| msg.sender == _getGuardian()`. NatSpec/comments that claimed "self-gated: ni admin ni Guardian" corrected on both the `attester` state var and the function itself. | `test_F5_guardian_puedeRotarAttester`, `test_F5_attesterVigente_siguePudiendoRotar`, `test_F5_randomAddress_noPuedeRotar`, `test_F5_rotarPorGuardian_vaultsLeenElNuevoEnVivo`; pre-existing `test_rotateAttester_soloElVigente` updated (new message text, needs a supported chain since `_getGuardian()` is now evaluated in the OR) and `test_rotateAttester_voucherViejoMuere_nuevoFirma` / `test_rotateAttester_zero_reverts` unaffected. |
| 6 | Twitter claim replay guard was per-claimer (`lastTweetId[msg.sender]`), so a wallet named in an older but still oracle-valid tweet could rebind/sweep *after* a newer tweet had already bound a different wallet, diverting the newer wallet's accrued balance | Low | `lastTweetId` is now a single global `uint128` (was `mapping(address => uint128)`). `claimByProof` requires `proof.tweetId > lastTweetId` (global) before accepting, mirroring how `bindNonce` globally invalidates old GitHub vouchers. **ABI change**: the public getter went from `lastTweetId(address) → uint128` to `lastTweetId() → uint128`. Grepped `C:\Users\PC\Flap\web` for `lastTweetId` — no references found, so no web-side follow-up is needed today; flagging in case a future integration reads it. | `test_F6_replayGlobal_walletViejaNoPuedeRobarTrasRebindMasNuevo` (the exact scenario from the finding), `test_F6_replayGlobal_tweetIdCrecienteSigueFuncionandoParaRebind` (legit re-bind still works); pre-existing `test_claimByProof_happyPath` updated for the new getter signature. |

### EIP-170 margin after v3 (measured, not estimated)

`forge build --sizes` after all 6 fixes:

| Contract | Runtime size | Margin vs 24576 B |
|---|---|---|
| `SocialFeeEscrow` | 14,122 B | 10,454 B (comfortable — F4's new storage/functions and F2's fuller bilingual strings fit easily) |
| `SocialFeeEscrowFactory` | 24,083 B | **493 B** (tight — ~2%) |

F2 (bilingual views) and F4 (rescue-forward) are exactly the bytecode risk flagged in the task:
the factory's `vaultDataSchema()`/`tokenCreationPolicies()` Chinese strings pushed the factory
**over** the limit on the first pass (measured: -636 B, i.e. undeployable). Trimmed the added
Chinese/English copy (kept meaning, cut verbosity) plus shortened one pre-existing, unrelated
`_validateBeforeLaunch` message to recover margin. Current 493 B margin is real and verified, but
thin — any future factory-side addition (new field, longer message, another require) should
re-run `forge build --sizes` before merging, since ~2% headroom leaves little room before this
needs an actual refactor (e.g., moving descriptions to a lookup pattern) rather than copy edits.

### Verification run for v3

- `forge test`: **92/92 green** (71 pre-v3 + 21 new: `test/AuditFixesV3.t.sol`).
- `forge test --match-contract ForkTest --fork-url robinhood -vv`: green against the live chain
  (real launch → tax → GitHub claim → sweep, same flow as v2, run again after the v3 changes).
- `forge build --sizes`: see table above.

### Claims elsewhere that are now stale because of v3 (flagged, not rewritten here)

Guardian's surface grew twice in v3 (F4's `setRescueForward`, F5's guardian-cogated
`rotateAttester`), on top of the preaudit's `emergencyWithdrawNative`. That makes a few
public-facing claims imprecise:

- `C:\Users\PC\Flap\web\app\directions\terminal\TerminalHome.tsx:175` — "*no owner keys. no
  custody. immutable code — the one emergency hatch is flap's guardian, not ours.*" The Guardian
  now has **three** gated entry points (`emergencyWithdrawNative`, `setRescueForward`,
  `rotateAttester`), not "the one emergency hatch". "no owner keys" itself stays accurate (Guardian
  is Flap's public address, never FLEDGE's/the creator's) but the "one hatch" phrasing should be
  pluralized or reworded.
- `C:\Users\PC\Flap\web\app\directions\manga\MangaHome.tsx:167` and
  `C:\Users\PC\Flap\web\app\directions\sherwood\SherwoodHome.tsx:348` — "`71 tests ✓`" / "`71 tests
  green`" badges are now stale (92 tests as of v3).
- `C:\Users\PC\Flap\contracts\README.md` — predates even the v2 preaudit round in places ("Sin
  funciones privilegiadas" in the header bullets, a "⚠️ GUARDIAN placeholder" section claiming the
  Guardian is unused/a placeholder, stale "40 tests"/"52 tests" counts). Already inaccurate before
  v3; more so now. Not rewritten here per scope — flagging for a follow-up pass.

---

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
