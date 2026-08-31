#!/usr/bin/env bash
# probar-cobro.sh — genera fees y las lleva al vault, para poder probar el claim.
#
#   cd /c/Users/PC/Flap && bash probar-cobro.sh
#
# Hace dos cosas: compra una pizca de tu propia moneda (eso genera las creator fees) y despues
# corre `harvest()`, que las barre de la curva al vault. Recien ahi hay algo que cobrar.
#
# Por defecto compra 0,002 ETH. Cambialo con:  COMPRA=0.003 bash probar-cobro.sh
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"

V=0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3
DEPLOYER=0x7dB192cE69C1D6c0fA6d6CA27953c24f380014F0
RPC="${RPC:-https://rpc.mainnet.chain.robinhood.com}"
COMPRA="${COMPRA:-0.002}"

TOK=$(cast call $V "token()(address)" --rpc-url "$RPC")
CUR=$(cast call $V "curve()(address)" --rpc-url "$RPC")
[ "$TOK" != "0x0000000000000000000000000000000000000000" ] || { echo "el vault no tiene moneda atada."; exit 1; }

echo "== estado =="
echo "   vault : $V"
echo "   token : $TOK"
echo "   curva : $CUR"
echo "   saldo del vault ahora: $(cast from-wei $(cast balance $V --rpc-url "$RPC")) ETH"
WEI=$(cast to-wei "$COMPRA" ether)
echo
echo "   Voy a comprar $COMPRA ETH de tu propia moneda y despues barrer las fees al vault."
echo "   Con el 10% de tax, deberian llegar ~$(python -c "print('%.6f' % (float('$COMPRA')*0.107))") ETH."
printf "   Escribi SI para continuar: "
read -r OK
[ "$OK" = "SI" ] || { echo "   cancelado."; exit 1; }

printf "   Pega la private key del deployer y Enter (no se va a ver nada): "
read -s -r PK; echo
[ -n "$PK" ] || { echo "   nada. cancelado."; exit 1; }
PK="$(printf '%s' "$PK" | tr -d '[:space:]\r"'"'"'`')"
case "$PK" in 0x*|0X*) PK="0x${PK#0[xX]}" ;; *) PK="0x$PK" ;; esac
HEX="${PK#0x}"
if [ "${#HEX}" -ne 64 ] || case "$HEX" in *[!0-9a-fA-F]*) true;; *) false;; esac; then
  echo "   ESA NO PARECE UNA PRIVATE KEY: recibi ${#HEX} caracteres hex (esperaba 64)."
  unset PK HEX; exit 1
fi
unset HEX
DIR=$(cast wallet address --private-key "$PK")
[ "${DIR,,}" = "${DEPLOYER,,}" ] || { echo "   esa no es la del deployer (da $DIR)."; unset PK; exit 1; }
echo "   llave ok: $DIR"

echo
echo "== 1/2 - comprando $COMPRA ETH =="
cast send "$CUR" "buy(uint256,uint256,address)" "$WEI" 0 "$DIR" \
  --value "$WEI" --private-key "$PK" --rpc-url "$RPC" | grep -E "^status|^transactionHash"
echo "   tokens recibidos: $(cast from-wei $(cast call "$TOK" "balanceOf(address)(uint256)" "$DIR" --rpc-url "$RPC" | awk '{print $1}'))"

echo
echo "== 2/2 - harvest() (barre la curva -> vault) =="
echo "   antes:  $(cast from-wei $(cast balance $V --rpc-url "$RPC")) ETH"
cast send "$V" "harvest()" --private-key "$PK" --rpc-url "$RPC" | grep -E "^status"
unset PK
SAL=$(cast balance $V --rpc-url "$RPC")
echo "   ahora:  $(cast from-wei $SAL) ETH"
echo
echo "   ============================================================"
echo "   Hay $(cast from-wei $SAL) ETH esperando en el vault."
echo "   Ahora entra a:"
echo "   https://www.robinshareapp.com/claim/$V"
echo "   ============================================================"
