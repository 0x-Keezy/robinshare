#!/usr/bin/env bash
# crear-wallets-calientes.sh — crea el relayer y el keeper, y los deja cargados en Vercel.
#
#   cd /c/Users/PC/Flap && bash crear-wallets-calientes.sh
#
# Hace TODO menos lo unico que no se puede automatizar: mandarles ETH. Al terminar imprime las dos
# direcciones para que les mandes saldo, y nada mas.
#
# LAS LLAVES NUNCA SE MUESTRAN. Las genera `cast wallet new` en TU maquina, van por un pipe directo
# a `vercel env add`, y se borran de memoria. No aparecen en pantalla, ni en el historial del
# shell, ni en un archivo, ni en el repo. Corre esto VOS: si lo corre un agente, las llaves pasan
# por su transcript.
#
# QUE ES CADA UNA, Y POR QUE ES CALIENTE
#
#   RELAYER — manda el `claimAndBind` por el builder y paga ese gas. Sin el, el builder firma y
#             paga: medido en el claim real, el gas se comio el 36% de lo cobrado — y antes de eso
#             necesita conseguir ETH en una cadena de la que nunca oyo hablar.
#
#   KEEPER  — llama `harvest()` para que las fees pasen de la curva al vault. `harvest()` es
#             PERMISSIONLESS: esta wallet no tiene ningun privilegio sobre nada, solo paga gas.
#
# Las dos viven en un servidor. Poco saldo, dedicadas, y NUNCA el deployer ni el attester: si
# alguna se filtra, lo peor que puede pasar es que alguien le queme el gas.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ/web"

command -v cast >/dev/null || { echo "falta foundry (cast). Instalalo o abri Git Bash con el PATH correcto."; exit 1; }
command -v vercel >/dev/null || { echo "falta el CLI de vercel (npm i -g vercel)."; exit 1; }

EXISTENTES="$(timeout 90 vercel env ls production 2>/dev/null || true)"
DIRS=""

crear() {
  local rol="$1" desc="$2"
  if printf '%s' "$EXISTENTES" | grep -q "${rol}_PK"; then
    echo "   ${rol}_PK ya estaba en Vercel — no la toco."
    return
  fi
  # `cast wallet new` imprime la Address y la Private key; se capturan y solo se muestra la Address.
  local salida addr pk
  salida="$(cast wallet new)"
  addr="$(printf '%s' "$salida" | grep -i "Address" | awk '{print $NF}')"
  pk="$(printf '%s' "$salida" | grep -i "Private key" | awk '{print $NF}')"
  unset salida
  if [ -z "$addr" ] || [ -z "$pk" ]; then
    echo "   no pude leer la salida de 'cast wallet new' para ${rol}"; unset pk; return 1
  fi
  printf '%s' "$pk" | timeout 90 vercel env add "${rol}_PK" production >/dev/null 2>&1
  unset pk
  echo "   ${rol}_PK creada y cargada en Vercel  ($desc)"
  DIRS="${DIRS}${rol}|${addr}"$'\n'
}

echo "== creando las wallets =="
crear RELAYER "paga el gas del claim del builder"
crear KEEPER  "paga el gas del harvest"

echo
if [ -z "$DIRS" ]; then
  echo "== no habia nada que crear =="
else
  echo "=========================================================================="
  echo " MANDALE ~0,01 ETH A CADA UNA (Robinhood Chain, 4663)"
  echo "=========================================================================="
  printf '%s' "$DIRS" | while IFS='|' read -r rol addr; do
    [ -n "$rol" ] && printf "   %-8s %s\n" "$rol" "$addr"
  done
  echo "=========================================================================="
  echo " El piso interno de las dos son 0,002 ETH: por debajo se apagan solas y el"
  echo " producto cae al camino de siempre en vez de fallar a medias."
fi

echo
echo "== cuando ya les mandaste ETH =="
echo "   cd $RAIZ/web && vercel --prod --yes"
echo
echo "   y pasale a Claude estas direcciones para que verifique el saldo y que las dos"
echo "   rutas quedaron vivas. Las DIRECCIONES son publicas; las llaves no salen de aca."
