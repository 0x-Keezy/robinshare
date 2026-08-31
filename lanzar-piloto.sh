#!/usr/bin/env bash
# lanzar-piloto.sh — el launch de la moneda, con las mismas guardas que el deploy.
#
#   cd /c/Users/PC/Flap && bash lanzar-piloto.sh
#
# Son DOS corridas del mismo comando: la 1a crea el vault y para, la 2a lo lee de la cadena, lo
# verifica y lanza. El script te dice en cual estas.
#
# POR QUE EXISTE: el comando a mano se corrio con la llave del ATTESTER en vez de la del DEPLOYER
# y murio con "insufficient funds ... have 0". No paso nada malo —el attester no tiene fondos, asi
# que no habia con que firmar— pero el mensaje de foundry no dice "esa es la llave equivocada",
# dice una direccion y un numero. Aca se chequea ANTES.
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export FACTORY=0xBf25E1d9082B5Ad0b8C68f072E94C797028c6855
DEPLOYER=0x7dB192cE69C1D6c0fA6d6CA27953c24f380014F0
ATTESTER=0x1E047B17BF45aE7D29287bd6389De4982C343f0A
RPC="${RPC:-https://rpc.mainnet.chain.robinhood.com}"

# Los parametros de la moneda. Se congelan en el launch: cambiarlos despues es imposible.
export NAME="${NAME:-RobinShare Pilot}"
export SYMBOL="${SYMBOL:-RSHARE}"
export IDENTITY_TYPE="${IDENTITY_TYPE:-1}"          # 1 = github
export IDENTITY_VALUE="${IDENTITY_VALUE:-0x-keezy}"
export RECOVERY_DAYS="${RECOVERY_DAYS:-0}"          # 0 = irrevocable
export CREATOR_TAX_BPS="${CREATOR_TAX_BPS:-1000}"   # 10%
export LOGO="${LOGO:-https://github.com/0x-keezy.png}"
export DESCRIPTION="${DESCRIPTION:-fees routed to a builder}"

echo "== 1/3 - en que fase estamos =="
IDH=$(cast call "$FACTORY" "identityHashFor(uint8,string,address)(bytes32)" \
      "$IDENTITY_TYPE" "$IDENTITY_VALUE" 0x0000000000000000000000000000000000000000 --rpc-url "$RPC")
VAULTS=$(cast call "$FACTORY" "getVaults(bytes32)(address[])" "$IDH" --rpc-url "$RPC" | tr -d '[] ')
if [ -z "$VAULTS" ]; then
  echo "   no hay vault para '$IDENTITY_VALUE' todavia -> esta corrida CREA EL VAULT y para."
  FASE=1
else
  echo "   vault encontrado: $VAULTS"
  TOK=$(cast call "$VAULTS" "token()(address)" --rpc-url "$RPC" 2>/dev/null || echo "")
  if [ "$TOK" != "0x0000000000000000000000000000000000000000" ] && [ -n "$TOK" ]; then
    echo "   y YA tiene moneda atada: $TOK"
    echo "   No hay nada que lanzar. El piloto ya esta hecho."
    echo "   Claim: https://www.robinshareapp.com/claim/$VAULTS"
    exit 0
  fi
  echo "   sin moneda atada -> esta corrida LANZA LA MONEDA."
  FASE=2
fi

echo
echo "== 2/3 - la llave =="
echo "   Tiene que ser la del DEPLOYER ($DEPLOYER), la que tiene el ETH."
printf "   Pega la private key del deployer y Enter (no se va a ver nada): "
read -s -r PK
echo
[ -n "$PK" ] || { echo "   no escribiste nada. cancelado."; exit 1; }
PK="$(printf '%s' "$PK" | tr -d '[:space:]\r"'"'"'`')"
case "$PK" in 0x*|0X*) PK="0x${PK#0[xX]}" ;; *) PK="0x$PK" ;; esac
HEX="${PK#0x}"
if [ "${#HEX}" -ne 64 ] || case "$HEX" in *[!0-9a-fA-F]*) true;; *) false;; esac; then
  echo "   ESA NO PARECE UNA PRIVATE KEY: recibi ${#HEX} caracteres hex (esperaba 64)."
  echo "   En Git Bash el pegado NO es Ctrl+V: usa CLICK DERECHO o Shift+Insert."
  unset PK HEX; exit 1
fi
unset HEX
DIR="$(cast wallet address --private-key "$PK")"
if [ "${DIR,,}" = "${ATTESTER,,}" ]; then
  echo "   ESA ES LA LLAVE DEL ATTESTER, no la del deployer."
  echo "     El attester solo FIRMA desde el server y no tiene fondos a proposito."
  echo "     La que paga es $DEPLOYER."
  unset PK; exit 1
fi
if [ "${DIR,,}" != "${DEPLOYER,,}" ]; then
  echo "   ESA NO ES LA LLAVE DEL DEPLOYER."
  echo "     da:       $DIR"
  echo "     esperaba: $DEPLOYER"
  unset PK; exit 1
fi
BAL=$(cast balance "$DIR" --rpc-url "$RPC")
echo "   llave ok: $DIR ($(cast from-wei "$BAL") ETH)"

echo
echo "== 3/3 - fase $FASE =="
cd "$RAIZ/contracts"
forge script script/LaunchPons.s.sol --rpc-url "$RPC" --broadcast \
  --compute-units-per-second 40 --private-key "$PK"
unset PK

if [ "$FASE" = "1" ]; then
  echo
  echo "   Vault creado. CORRE ESTE MISMO COMANDO OTRA VEZ para lanzar la moneda."
else
  V=$(cast call "$FACTORY" "getVaults(bytes32)(address[])" "$IDH" --rpc-url "$RPC" | tr -d '[] ')
  T=$(cast call "$V" "token()(address)" --rpc-url "$RPC")
  echo
  echo "   ===================================================="
  echo "   vault: $V"
  echo "   token: $T"
  echo "   claim: https://www.robinshareapp.com/claim/$V"
  echo "   ===================================================="
  echo "   Pasale estas direcciones a Claude para que las verifique."
fi
