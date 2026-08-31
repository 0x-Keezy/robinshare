#!/usr/bin/env bash
# preparar-vercel.sh — deja listo el bloque de variables para pegar en Vercel.
#
#   bash preparar-vercel.sh
#
# Genera el ATTESTER_STATE_SECRET, verifica que la llave del attester sea la correcta, y arma el
# bloque. Ninguna llave se escribe en disco ni se muestra: `cast wallet address -i` la pide por
# stdin y solo se imprime la DIRECCION que sale de ella.
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ATTESTER_ESPERADO=0x1E047B17BF45aE7D29287bd6389De4982C343f0A
CLIENT_ID=Ov23lirokUv77e67rn7L
BASE_URL=https://www.robinshareapp.com

echo "== 1/3 · la factory =="
FACTORY=""
ART="$RAIZ/contracts/broadcast/DeployPons.s.sol/4663/run-latest.json"
if [ -f "$ART" ]; then
  FACTORY="$(python -c "
import json
d=json.load(open(r'$ART'))
a=[t['contractAddress'] for t in d['transactions'] if t.get('contractName')=='RobinShareVaultFactory']
print(a[0] if a else '')
" 2>/dev/null || true)"
fi
if [ -n "$FACTORY" ] && [ "$(cast code "$FACTORY" --rpc-url robinhood 2>/dev/null | head -c 4)" = "0x60" ]; then
  echo "   encontrada y viva en la cadena: $FACTORY"
else
  FACTORY="0x_TODAVIA_NO_DEPLOYADA"
  echo "   todavia no hay deploy. Corre primero:  bash deploy-factory.sh"
fi

echo
echo "== 2/3 · la llave del attester =="
echo "   Foundry te la va a pedir a ciegas. NO se guarda ni se muestra: solo se compara"
echo "   la direccion que sale de ella contra la que quedo en la factory."
DIR_ATT="$(cast wallet address -i)"
if [ "${DIR_ATT,,}" = "${ATTESTER_ESPERADO,,}" ]; then
  echo "   OK: $DIR_ATT  (coincide con el attester de la factory)"
else
  echo
  echo "   !!! NO COINCIDE"
  echo "       esa llave da:  $DIR_ATT"
  echo "       la factory espera: $ATTESTER_ESPERADO"
  echo "       Si pegas esta llave en Vercel, TODO claim de GitHub va a fallar en cadena."
  exit 1
fi

echo
echo "== 3/3 · el bloque para Vercel =="
echo "   Settings -> Environment Variables -> Production. Una por una:"
echo
echo "   ---------------------------------------------------------------"
echo "   NEXT_PUBLIC_FACTORY_ADDRESS = $FACTORY"
echo "   NEXT_PUBLIC_RPC_URL         = https://rpc.mainnet.chain.robinhood.com"
echo "   APP_BASE_URL                = $BASE_URL"
echo "   GITHUB_CLIENT_ID            = $CLIENT_ID"
echo "   GITHUB_CLIENT_SECRET        = <el NUEVO, el que rotaste>"
echo "   ATTESTER_PK                 = <la llave que acabas de verificar>"
echo "   ATTESTER_STATE_SECRET       = $(openssl rand -hex 32)"
echo "   ---------------------------------------------------------------"
echo
echo "   El STATE_SECRET de arriba se genero recien y existe solo en esta pantalla:"
echo "   copialo a Vercel ahora. Si cerras la terminal, corre el script de nuevo."
echo "   Despues del deploy de Vercel, pasale a Claude el resultado de:"
echo "   curl $BASE_URL/api/health"
