# RUNBOOK — Launch del token piloto FLEDGE en Robinhood Chain

> Todo verificado contra la chain real vía fork test (ver `contracts/README.md § Hallazgos`).
> **GATE:** no ejecutar sin las 5 llaves de abajo. El runbook se ESCRIBE ya; se EJECUTA cuando estén.

## 0. Pre-flight (5 llaves)

- [ ] **ETH en chain 4663** en la wallet deployer (>= 0.05 ETH: gas + ~$1 fee + dev-buy).
- [ ] **Wallet ATTESTER** nueva y dedicada (sin fondos). Su address = `ATTESTER_ADDRESS` (canónico de la factory); su PK va SOLO al env de Vercel del attester.
- [ ] **App de Reclaim** (dev.reclaimprotocol.org): `RECLAIM_APP_ID` + `RECLAIM_APP_SECRET` + provider "Twitter/X username" (`RECLAIM_PROVIDER_ID_TWITTER`).
- [ ] **GitHub OAuth app**: `GITHUB_CLIENT_ID`/`SECRET`, callback = `https://<dominio>/api/attest/github/callback`.
- [ ] **Identidad piloto + recoveryDays** (propuesta: `github:0x-keezy`, recoveryDays=0).

## 1. Deploy de la factory (con attester canónico)

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
ATTESTER_ADDRESS=0x<addr-del-attester> \
  forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK
# anotar FACTORY=0x...  (y confirma "Canonical attester" en el log)

# verificar en Blockscout:
forge verify-contract $FACTORY src/SocialFeeEscrowFactory.sol:SocialFeeEscrowFactory \
  --chain-id 4663 --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api \
  --constructor-args $(cast abi-encode "constructor(address,address)" \
      0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B 0x<addr-del-attester>)
```
Luego: setear `NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY` en Vercel y redeploy del `web/`.

## 2. vaultData del piloto (4 campos — el attester NO va acá, es canónico de la factory)

```bash
# (string identityType, string identityValue, address identityWallet, uint256 recoveryDays)
VAULT_DATA=$(cast abi-encode "f(string,string,address,uint256)" \
  "github" "0x-keezy" "0x0000000000000000000000000000000000000000" 0)
```

## 3. Salt (minería LOCAL, sin RPC — el portal exige vanity 0x7777)

```bash
node scripts/mine-salt.mjs 7777      # -> {"salt":"0x..","token":"0x..7777","iterations":N}
# guardar SALT=0x.. y TOKEN_PREDICHO=0x..7777
```

## 4. Launch

**Opción A — página `/create` (recomendada, la vía del producto):** con la web deployada y `NEXT_PUBLIC_FACTORY_ADDRESS` seteada, entrás a `https://<dominio>/create`, conectás la wallet, elegís nombre/símbolo + a quién van las fees (github/x/wallet) + dev-buy, y firmás. La página mina el salt local, arma los params y llama al VaultPortal. Verificado end-to-end por la vía JS contra un anvil fork (token real == predicho, escrow creado, attester canónico).

**Opción B — CLI (llamada directa al VaultPortal), para automatizar:**

Params verificados en fork: `dexThresh=1 (FOUR_FIFTHS)`, `migratorType=1 (V2_MIGRATOR)`, `dexId=0 (DEX0)`, `lpFeeProfile=0`, `tokenVersion=6 (TOKEN_TAXED_V3)`, `quoteToken=0x0`, `mktBps=10000`, tax 3%/3%, `taxDuration=3153600000`, `antiFarmerDuration=259200`. `value = quoteAmt` (dev-buy, ej. 0.01 ETH).

```bash
cast send 0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B \
  "newTokenV6WithVault((string,string,string,uint8,bytes32,uint8,address,uint256,bytes,bytes32,bytes,uint8,uint8,uint16,uint16,uint64,uint64,uint16,uint16,uint16,uint16,uint256,address,address,uint8,address,bytes))" \
  "(Fledge Pilot,FLEDGE,{},1,$SALT,1,0x0000000000000000000000000000000000000000,10000000000000000,0x,0x0000000000000000000000000000000000000000000000000000000000000000,0x,0,0,300,300,3153600000,259200,10000,0,0,0,0,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000,6,$FACTORY,$VAULT_DATA)" \
  --value 0.01ether --rpc-url https://rpc.mainnet.chain.robinhood.com --private-key $DEPLOYER_PK
```

## 5. Verificación post-launch (todas obligatorias)

```bash
# el escrow del piloto (identityHash de github:0x-keezy)
IDH=$(cast call $FACTORY "identityHashFor(string,string,address)(bytes32)" "github" "0x-keezy" 0x0000000000000000000000000000000000000000 --rpc-url https://rpc.mainnet.chain.robinhood.com)
ESCROW=$(cast call $FACTORY "getVaults(bytes32)(address[])" $IDH --rpc-url https://rpc.mainnet.chain.robinhood.com)
```
- [ ] Token visible en flap.sh/robinhood/board y en Blockscout; su address == `TOKEN_PREDICHO`.
- [ ] `cast call $ESCROW "taxToken()(address)"` == token lanzado.
- [ ] `cast call $ESCROW "attester()(address)"` == `ATTESTER_ADDRESS` (canónico).
- [ ] `cast call $ESCROW "description()(string)"` legible.
- [ ] Comprar una pizca vía flap.sh → `cast balance $ESCROW` sube (el tax se despacha por lotes; puede demorar).

## 6. Smoke de claim real

- Abrir `https://<dominio>/claim/$ESCROW`, conectar wallet, flujo GitHub → `claimAndBind` → ETH llega a la payout.
- Post en X: SOLO después de este paso verde (pasar por quality-gate antes de publicar).

## 7. Rollback / incidentes

- El launch NO es reversible (token vivo). Si el escrow no recibe tax: revisar `mktBps=10000` en el tx y el `marketAddress` del token (Helper `0xb10bD2672aE63735d677164A54B573a016f0203C`).
- Si el attester falla: `web/scripts/attest-manual.mjs` (verificación humana; documentar).
- Fondos SIEMPRE seguros: sin bind no hay egress salvo `recoverUnclaimed` (si se configuró recoveryDays>0).
