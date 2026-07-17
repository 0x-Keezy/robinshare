# Flap Vault Interaction Risk Report — status (FLEDGE response)

Original report generated: 2026-07-17 05:50:20 UTC. Source:
`774664f8_robinshare-contracts-v3-version2.md`. This file is the sign-off copy: the one finding
is marked and annotated with what shipped in v4. See `AUDIT-NOTES.md` (the "Audit v4" section at
the top of the file) for the full write-up, and `test/AuditFixesV4.t.sol` for the tests
themselves.

## Vault Security Rating
High

## Status Guide / 状态说明

| Status | Meaning / 含义 |
|:---:|---|
| **TP** | True Positive — This is a real issue, we will fix it. / 确认问题，我们会修复。 |
| **FP** | False Positive — This is not a real issue, the analysis is incorrect. / 误报，分析有误。 |
| **By Design** | This is intentional behavior, not a bug. / 这是设计如此，非缺陷。 |
| **Acknowledged** | The issue is real but the impact is acceptable, will not fix. / 问题确实存在，但影响在可接受范围内，不修复。 |

---

## Risk Findings

### Finding 1: vaultUISchema input declarations mismatch actual function signatures for claimByProof and recoverUnclaimed (SYS-REQ-INHERITANCE)
- **Severity:** High
- **Confidence:** High
- **Detected by:** attacker_review, rule_review
- **Description:** SocialFeeEscrow.vaultUISchema() declares claimByProof and recoverUnclaimed as taking zero input parameters, but the actual function signatures are claimByProof(IXGeneralVerifier.XGeneralProof,bytes) (two parameters) and recoverUnclaimed(address to) (one parameter). A generic UI/integrator that follows the schema would encode a call with no arguments, producing the wrong function selector (claimByProof() and recoverUnclaimed()), which does not match the deployed functions. As a result the Twitter/X claim route and the creator recovery route cannot be executed through the auto-generated UI the schema is meant to power, blocking legitimate fund claims/recovery via the portal UI.
- **Vulnerable Code:**
  - `SocialFeeEscrow.sol / SocialFeeEscrow.vaultUISchema (methods[1] claimByProof)`
  - `SocialFeeEscrow.sol / SocialFeeEscrow.vaultUISchema (methods[4] recoverUnclaimed)`
  - `SocialFeeEscrow.sol / SocialFeeEscrow.claimByProof`
  - `SocialFeeEscrow.sol / SocialFeeEscrow.recoverUnclaimed`
  - `robinshare-contracts-v3/src/SocialFeeEscrow.sol: vaultUISchema() methods[4] "recoverUnclaimed" declares 0 inputs vs actual recoverUnclaimed(address)`
  - `robinshare-contracts-v3/src/SocialFeeEscrow.sol: vaultUISchema() methods[1] "claimByProof" declares 0 inputs vs actual claimByProof(XGeneralProof,bytes)`

> **Status:** `[x]` TP　`[ ]` FP　`[ ]` By Design　`[ ]` Acknowledged
> **Reason (if FP / By Design / Acknowledged):** —
> **Fixed in v4:** confirmed exactly as reported — both methods declared 0 inputs while taking
> real parameters. `recoverUnclaimed`'s fix was a straight schema correction (it already had an
> expressible signature; it now declares its 1 real input, `to: address`).
>
> `claimByProof` needed more than a schema edit. One honest note for your team: our
> `FieldDescriptor.fieldType` vocabulary (`IVaultSchemasV1.sol`) has no `tuple`/`struct` value —
> only `string`, `address`, `uint16`, `uint256`, `time`, `bool`, `bytes`, `bytes32`. A parameter of
> type `XGeneralProof` (your 4-field struct: `uint128 tweetId`, `string xHandle`, `uint128 xId`,
> `string substring`) is literally inexpressible in the schema as it stands today — and simply
> declaring 4 flat inputs while leaving the real function signature untouched would not have
> fixed anything, since the real function still takes ONE struct parameter: the calldata a
> schema-following UI would produce from 4 separately-encoded top-level scalars would not match
> the real function's ABI-encoded-tuple calldata. So we made a product decision: we flattened
> `claimByProof`'s actual Solidity signature to
> `claimByProof(uint256 tweetId, string xHandle, uint256 xId, string substring, bytes signature)`
> — 5 scalar params, all declarable in the existing vocabulary (`tweetId`/`xId` as `uint256`,
> since the vocabulary has no `uint128` either) — and the function now reconstructs the
> `XGeneralProof` struct internally, in memory, purely to call your `IXGeneralVerifier.verify()`.
> Added explicit bounds checks (`tweetId`/`xId <= type(uint128).max`) before the cast, so an
> out-of-range value reverts instead of silently truncating. All existing security properties are
> unchanged: same substring/handle binding, same oracle signature check, same global
> `tweetId > lastTweetId` replay guard from your v3 finding 6.
>
> Widening the schema (5 inputs on `claimByProof`, 1 on `recoverUnclaimed`) needed real bytecode
> we didn't have — `SocialFeeEscrowFactory` had only 136 B of EIP-170 runtime margin left at the
> time (the vault's entire initcode lived inside the factory's own runtime via
> `new SocialFeeEscrow(...)`). We split that out into a dedicated `SocialFeeEscrowDeployer`
> contract (deployed once by the factory's constructor, gated to that one factory), which moved
> the vault's initcode out of the factory's runtime entirely. The factory's runtime margin is now
> 16,771 B. Full detail (including a selector-consistency test that computes each write method's
> selector from its declared `fieldType`s and asserts it matches the real function selector) in
> `AUDIT-NOTES.md`.
>
> Covered by `test/AuditFixesV4.t.sol`: `test_schema_claimByProof_declara5InputsConFieldTypesExactos`,
> `test_schema_recoverUnclaimed_declara1InputAddress`,
> `test_schema_selectorMatchesRealFunction_paraTodosLosWriteMethods`,
> `test_claimByProof_firmaPlana_endToEnd`, `test_claimByProof_tweetIdOverflow_reverts`,
> `test_claimByProof_xIdOverflow_reverts`, `test_claimByProof_tweetIdEnElLimite_ok`,
> `test_deployer_soloLaFactoryQueLoCreoPuedeLlamarDeploy`,
> `test_deployer_capturaSuFactoryComoInmutable`,
> `test_deployer_dosFactoriesTienenDeployersDistintos`, `test_newVault_viaDeployer_creaUnVaultFuncional`;
> pre-existing `test_claimByProof_*` and `test_F6_*` updated for the new flat signature. Also
> verified against the real Portal on live Robinhood Chain:
> `forge test --match-contract Fork --fork-url robinhood -vv`.
