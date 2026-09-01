#!/usr/bin/env bash
# prender-servicios.sh — prende el relayer y el keeper.
#
#   cd /c/Users/PC/Flap && bash prender-servicios.sh
#
# Las dos piezas estan construidas y probadas contra un fork de la cadena real; lo unico que les
# falta es una wallet caliente y una variable. Este script hace todo lo que se puede hacer sin
# tener tus llaves, y te dice exactamente que falta.
#
# CORRELO VOS, EN TU TERMINAL. El paso 1 genera el CRON_SECRET y lo IMPRIME una sola vez, porque
# el mismo valor tiene que ir tambien a GitHub. Si lo corre un agente, ese secreto queda escrito en
# el transcript — ya paso una vez y hubo que rotarlo.
#
# QUE PRENDE, Y POR QUE IMPORTA CADA UNA
#
#   RELAYER — hoy el builder firma el claim y paga su propio gas. Medido en el claim real de Jose:
#             el gas se comio el 36% de lo cobrado. Y peor: necesita tener ETH en una cadena de la
#             que nunca oyo hablar. Con el relayer, el server manda la transaccion y al builder le
#             llega el 100%. Es la promesa central del producto.
#
#   KEEPER  — en pons las fees se quedan EN LA CURVA hasta que alguien llama harvest(). Mientras
#             nadie lo hace, el builder ve MENOS de lo que gano en su pagina, y ese saldo sin
#             barrer es exactamente lo que el owner de pons puede reapuntar retroactivamente.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ/web"

echo "== estado actual =="
REL=$(curl -sS -m 20 https://www.robinshareapp.com/api/relay/claim 2>/dev/null || echo '{}')
CRON=$(curl -sS -m 20 -o /dev/null -w "%{http_code}" https://www.robinshareapp.com/api/cron/keeper 2>/dev/null || echo "?")
echo "   relayer: $REL"
echo "   keeper : HTTP $CRON   (503 = apagado, 401 = prendido y pide token)"
echo

# ── 1 · CRON_SECRET ────────────────────────────────────────────────────────────────────────────
# No es una llave de nadie: es un secreto compartido que se genera aca. Va a Vercel por un pipe
# (nunca se muestra) y despues se imprime UNA vez, porque el mismo valor tiene que ir a GitHub.
echo "== 1/3 · el secreto del cron =="
if timeout 90 vercel env ls production 2>/dev/null | grep -q "CRON_SECRET"; then
  echo "   CRON_SECRET ya esta en Vercel. Si perdiste el valor, borralo y volve a correr esto:"
  echo "     vercel env rm CRON_SECRET production"
else
  SECRETO="$(openssl rand -hex 32)"
  printf '%s' "$SECRETO" | timeout 90 vercel env add CRON_SECRET production >/dev/null 2>&1
  echo "   CRON_SECRET generado y puesto en Vercel."
  echo
  echo "   COPIA ESTE VALOR AHORA — va como secret del repo en GitHub y no se vuelve a mostrar:"
  echo "     $SECRETO"
  unset SECRETO
fi
echo
echo "   En GitHub: Settings -> Secrets and variables -> Actions -> New repository secret"
echo "     CRON_SECRET  = el valor de arriba"
echo "     KEEPER_URL   = https://www.robinshareapp.com/api/cron/keeper"
echo "   (sin estos dos, el workflow no falla: se saltea y lo dice)"

# ── 2 · las dos wallets calientes ──────────────────────────────────────────────────────────────
echo
echo "== 2/3 · las wallets =="
echo "   Hacen falta DOS wallets nuevas y dedicadas. NO uses el deployer ni el attester."
echo "   Son wallets CALIENTES: viven en un servidor. Poco saldo y solo para esto."
echo
for rol in RELAYER KEEPER; do
  if timeable=$(timeout 90 vercel env ls production 2>/dev/null) && echo "$timeable" | grep -q "${rol}_PK"; then
    echo "   ${rol}_PK ya esta en Vercel."
  else
    echo "   ${rol}_PK falta. Corre:  cast wallet new"
    echo "      -> mandale ~0,01 ETH a la Address (el piso interno son 0,002)"
    echo "      -> despues:  cd $RAIZ/web && vercel env add ${rol}_PK production"
  fi
done

# ── 3 · que queda ──────────────────────────────────────────────────────────────────────────────
echo
echo "== 3/3 · cuando termines =="
echo "   cd $RAIZ/web && vercel --prod --yes"
echo
echo "   y despues verifica:"
echo "     curl https://www.robinshareapp.com/api/relay/claim        -> {\"enabled\":true}"
echo "     curl -H \"Authorization: Bearer <CRON_SECRET>\" \\"
echo "          https://www.robinshareapp.com/api/cron/keeper        -> modo:\"send\""
echo
echo "   Sin KEEPER_PK el cron corre igual en DRY-RUN y te dice cuanto habria barrido —"
echo "   sirve para medir el problema antes de fondear una wallet caliente."
