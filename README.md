# RobinShare — route trading fees to the builders who earned them

**RobinShare** lets anyone launch a token on [Flap](https://flap.sh) (Robinhood Chain) whose
trading fees accrue to **one person** — identified by their **GitHub, X handle, or wallet** —
without that person needing a wallet up front. They claim by proving the identity: a GitHub
login, a tweet verified by Flap's on-chain oracle, or a direct signature.

Robin Hood is about sharing with others. Here, that means sharing with the devs who actually
earned it.

- **Chain:** Robinhood Chain (4663) · VaultPortal `0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B`
- **X:** [@RobinShareApp](https://x.com/RobinShareApp)

## How it works

1. **Name them** — pick a builder by GitHub, X, or wallet. Their coin lists on Flap in seconds.
2. **Fees accrue** — a launch-set cut of every trade (1–10%, probed on-chain against the live
   portal) lands in an immutable escrow vault under their name.
3. **They claim** — they prove it's them (GitHub OAuth voucher, a tweet verified by Flap's
   `XGeneralVerifier` oracle, or a wallet signature) and sweep the ETH.

**Core invariant:** escrowed ETH can only ever move to the wallet that proved the identity (or
back to the creator via `recoverUnclaimed(address to)`, only if the vault was *never* bound and
the creator-chosen recovery window elapsed). No owner. No pause. No upgrade path. One privileged
function only: `emergencyWithdrawNative`, an emergency-only hatch gated to Flap's public
per-chain Guardian multisig (never us) — adopted in the Flap preaudit as the recovery of last
resort. Payout rotation (`rebindWallet`) and attester rotation (`rotateAttester`) are self-gated:
the proven identity and the attester key rotate themselves, no admin in either path. `receive()`
stays empty — always.

## Repo layout

| Path | What |
|---|---|
| `contracts/` | Foundry — `SocialFeeEscrow` + `SocialFeeEscrowFactory` (51 tests incl. fork E2E against the live chain) |
| `web/` | Next.js 16 — landing, `/create` (launch from the browser: local salt mining, vanity `7777`), `/claim/[vault]`, GitHub OAuth attester routes, X oracle proxy |
| `docs/` | Design specs, plans, runbook, deploy guides |

## Development

```bash
# contracts
cd contracts && forge test          # unit + fork E2E (needs RPC for fork tests)

# web
cd web && npm install && npm run dev
```

See [docs/RUNBOOK-launch.md](docs/RUNBOOK-launch.md) for the exact launch procedure and
[docs/DEPLOY-WEB.md](docs/DEPLOY-WEB.md) for deploying the attester.

## Security notes

- The escrow is immutable and bound to a single identity at launch — reviewed adversarially
  (multi-lens) before the current design: third-party theft was found impossible by all lenses.
- The GitHub path relies on a factory-canonical attester (constructor arg, not creator-supplied —
  a creator-supplied attester would enable self-signed rugs, which is why it isn't one).
- The X path uses Flap's own on-chain oracle (`XGeneralVerifier`), not our infrastructure.

Not affiliated with Robinhood. Built on Flap's public infrastructure.
