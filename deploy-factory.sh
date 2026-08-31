#!/usr/bin/env bash
# deploy-factory.sh — el deploy de la RobinShareVaultFactory, en un solo comando.
#
#   bash deploy-factory.sh
#
# LA PRIVATE KEY NO PASA POR ACA. Se usa `forge script --interactive`, asi que la pide el propio
# foundry por stdin: no va en los argumentos (donde `ps` la veria), no va en una variable de
# entorno, no queda en el historial del shell y no se escribe en ningun archivo.
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Las direcciones decididas (PENDIENTES 3). Son publicas: no hay secretos aca.
export ATTESTER_ADDRESS=0x1E047B17BF45aE7D29287bd6389De4982C343f0A
export ATTESTER_ADMIN=0x53C4656E84999960daE7f7C39513BfF3C8057E5C
DEPLOYER=0x7dB192cE69C1D6c0fA6d6CA27953c24f380014F0

echo "== 1/4 · la rama =="
RAMA="$(git -C "$RAIZ" rev-parse --abbrev-ref HEAD)"
if [ "$RAMA" != "feat/pons-web" ]; then
  echo "   ESTAS EN '$RAMA'. El deploy de pons vive en feat/pons-web."
  echo "   Corre:  git checkout feat/pons-web"
  exit 1
fi
echo "   ok: $RAMA"

echo
echo "== 2/4 · se puede lanzar hoy? =="
( cd "$RAIZ/web" && DEPLOYER_ADDRESS="$DEPLOYER" node scripts/preflight.mjs ) || {
  echo
  echo "   El preflight encontro un bloqueante. No deployo."
  exit 1
}

echo
echo "== 3/4 · el deploy =="
echo "   Foundry va a pedirte la private key del deployer. Se escribe a ciegas (no se ve)."
echo "   Esto GASTA ETH y es IRREVERSIBLE: attesterAdmin y xVerifier quedan grabados."
printf "   Escribi SI para continuar: "
read -r OK
[ "$OK" = "SI" ] || { echo "   cancelado."; exit 1; }

cd "$RAIZ/contracts"
forge script script/DeployPons.s.sol --rpc-url robinhood --broadcast --interactive 1

echo
echo "== 4/4 · que quedo en la cadena =="
FACTORY="$(python -c "
import json
d=json.load(open('broadcast/DeployPons.s.sol/4663/run-latest.json'))
print([t['contractAddress'] for t in d['transactions'] if t.get('contractName')=='RobinShareVaultFactory'][0])
")"
echo "   FACTORY: $FACTORY"
echo
for f in attester attesterAdmin feeEscrow ponsFactory xVerifier; do
  printf "   %-14s %s\n" "$f" "$(cast call "$FACTORY" "$f()(address)" --rpc-url robinhood)"
done
echo
echo "   Verificar el codigo en el explorer:"
echo "   forge verify-contract $FACTORY src/RobinShareVaultFactory.sol:RobinShareVaultFactory \\"
echo "     --chain-id 4663 --verifier blockscout \\"
echo "     --verifier-url https://robinhoodchain.blockscout.com/api \\"
echo "     --constructor-args \$(cast abi-encode 'c(address,address,address,address,address)' \\"
echo "       $ATTESTER_ADDRESS 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e \\"
echo "       0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e 0x0000000000000000000000000000000000000000 \\"
echo "       $ATTESTER_ADMIN)"
echo
echo "   Pasale esta direccion a Claude para que la verifique: $FACTORY"
