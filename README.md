# FLEDGE — Social Fee Escrow (Flap × Robinhood Chain)

Un token de Flap cuyos **fees de trading se acumulan para UNA persona** identificada por su **wallet, GitHub o Twitter/X** — sin que necesite wallet de antemano — y que ella cobra probando su identidad (firma directa / OAuth GitHub / zkTLS Reclaim).

- **Chain:** Robinhood Chain (4663) · VaultPortal `0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B`
- **Spec de diseño:** [docs/superpowers/specs/2026-07-10-fledge-social-fee-escrow-design.md](docs/superpowers/specs/2026-07-10-fledge-social-fee-escrow-design.md)
- **Plan A (contratos):** [docs/superpowers/plans/2026-07-10-fledge-contracts.md](docs/superpowers/plans/2026-07-10-fledge-contracts.md)
- **Plan B (attester + dApp + launch):** [docs/superpowers/plans/2026-07-10-fledge-web.md](docs/superpowers/plans/2026-07-10-fledge-web.md)

**Modelo de trabajo:** Fable 5 diseñó el spec y los plan-packs; **Opus 4.8 ejecuta** task por task (superpowers:subagent-driven-development o executing-plans).

**Invariante madre:** el ETH del escrow solo puede salir hacia la wallet que probó la identidad (o al creator vía `recoverUnclaimed`, solo si NUNCA hubo bind y venció el plazo elegido al launch). Sin owner, sin pause, sin upgrade, sin funciones privilegiadas. `receive()` vacío — siempre.
