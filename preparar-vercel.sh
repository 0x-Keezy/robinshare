#!/usr/bin/env bash
# preparar-vercel.sh — deja listo el bloque de variables para pegar en Vercel.
#
#   cd /c/Users/PC/Flap && bash preparar-vercel.sh
#
# La llave del attester se pide con `read -s` (a ciegas, fuera del historial) y SOLO se usa para
# calcular su direccion y compararla. No se guarda ni se imprime.
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ATTESTER_ESPERADO=0x1E047B17BF45aE7D29287bd6389De4982C343f0A
CLIENT_ID=Ov23lirokUv77e67rn7L
BASE_URL=https://www.robinshareapp.com
RPC="${RPC:-https://rpc.mainnet.chain.robinhood.com}"   # el alias `robinhood` solo existe dentro de contracts/; la URL explicita funciona desde cualquier dir

echo "== 1/3 - la factory =="
# OJO con la ruta: `python` aca es el de Windows y NO entiende las rutas estilo MSYS que usa Git
# Bash (`/c/Users/...`). Por eso se hace `cd` al directorio y se le pasa una ruta RELATIVA — con la
# absoluta fallaba en silencio (el `|| true` se comia el error) y el script decia "todavia no hay
# deploy" con la factory ya deployada.
FACTORY=""; ART="contracts/broadcast/DeployPons.s.sol/4663/run-latest.json"
if [ -f "$RAIZ/$ART" ]; then
  FACTORY="$(cd "$RAIZ" && python -c "
import json
d=json.load(open('$ART'))
a=[t['contractAddress'] for t in d['transactions'] if t.get('contractName')=='RobinShareVaultFactory']
print(a[0] if a else '')
" 2>/dev/null || true)"
fi
if [ -n "$FACTORY" ] && [ -n "$(cast code "$FACTORY" --rpc-url "$RPC" 2>/dev/null | tr -d '0x\n')" ]; then
  echo "   viva en la cadena: $FACTORY"
else
  FACTORY="0x_TODAVIA_NO_DEPLOYADA"
  echo "   todavia no hay deploy. Corre primero: bash deploy-factory.sh"
fi

echo
echo "== 2/3 - la llave del attester =="
printf "   Pega la private key del ATTESTER y Enter (no se va a ver nada): "
read -s -r PK
echo
[ -n "$PK" ] || { echo "   no escribiste nada. cancelado."; exit 1; }
case "$PK" in 0x*) ;; *) PK="0x$PK" ;; esac
DIR="$(cast wallet address --private-key "$PK")"
unset PK
if [ "${DIR,,}" != "${ATTESTER_ESPERADO,,}" ]; then
  echo "   NO COINCIDE."
  echo "     esa llave da:      $DIR"
  echo "     la factory espera: $ATTESTER_ESPERADO"
  echo "   Si la pegas asi en Vercel, TODO claim de GitHub falla en cadena."
  exit 1
fi
echo "   ok: $DIR"

echo
echo "== 3/3 - el bloque para Vercel (Settings > Environment Variables > Production) =="
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
echo "   El STATE_SECRET existe solo en esta pantalla: copialo ahora."
echo "   Despues del deploy de Vercel, pasale a Claude:  curl $BASE_URL/api/health"
