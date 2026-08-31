/// Las promesas del producto, en UN solo lugar.
///
/// Por que existe este archivo: la landing tiene NUEVE direcciones de arte, y cada una repetia
/// la misma promesa con sus propias palabras. Cuando el rail cambio de Flap a pons, cuatro de
/// ellas quedaron afirmando cosas falsas y nadie lo vio, porque nadie relee nueve archivos de
/// ~500 lineas por una frase. Con una constante compartida, la verdad se corrige en un lugar y
/// `test/copy.test.ts` puede exigir que TODAS la usen.
///
/// Cada clausula de abajo es verificable, y cada una salio de un hallazgo de review:
///
///  · "no owner, no upgrades, no emergency hatch" — cierto del vault: no hay `onlyOwner`, no hay
///    proxy, y el Guardian del rail viejo se elimino entero.
///  · "whoever launches can never redirect the fees" — cierto, PERO solo si no fijaron una
///    ventana de recovery; por eso la frase la nombra en vez de omitirla. El badge de
///    `/claim/<vault>` lo lee de `recoveryAfter()` on-chain.
///  · "pons can redirect ... 3-day timelock" — el owner del launchpad (un Safe 2-de-3) puede
///    reasignar el `creatorFeeRecipient` de cualquier token. Es retroactivo sobre lo no barrido
///    y `renounceOwnership` esta deshabilitado de forma permanente.
///  · "on GitHub vaults our attester signature is what proves it" — inherente a atestiguar un
///    OAuth on-chain: en esa ruta la firma ES la prueba, asi que esa llave es de confianza.
///    Decirlo importa porque cuatro paginas afirmaban "0 admin keys" a secas.
///  · "ETH-paired launches only" — impuesto por el contrato: `attachToken()` rechaza cualquier
///    launch con `pairToken != 0`.
export const CUSTODY_LINE =
  "Permissionless. The vault has no owner, no upgrades and no emergency hatch, and whoever " +
  "launches a coin can never redirect its fees — unless they set a recovery window at launch, " +
  "which the vault publishes on-chain. Two powers are not ours to disclaim: pons, the launchpad, " +
  "can point a coin's creator fees elsewhere behind a public 3-day timelock, and on a GitHub " +
  "vault our attester signature is what proves the identity, so that key is trusted (X and " +
  "wallet vaults do not depend on it). ETH-paired launches only. Not affiliated with Robinhood, " +
  "pons or Flap.";

/// Version corta para los lugares donde no entra el parrafo entero. Dice MENOS, pero no dice
/// nada distinto: nunca puede afirmar "cero llaves" a secas.
export const CUSTODY_LINE_SHORT =
  "Permissionless. No owner, no upgrades, no emergency hatch — but pons can redirect a coin's " +
  "creator fees behind a public 3-day timelock, and GitHub claims trust our attester key. " +
  "ETH-paired launches only.";

/// Lo que un builder necesita de verdad para cobrar. La version anterior decia que no hacia
/// falta "ni wallet ni ETH", y la segunda mitad era falsa: el contrato SOPORTA que un tercero
/// pague el gas (probado en fork), pero el producto no tiene relayer, asi que hoy el gas lo paga
/// quien reclama.
export const CLAIM_REQUIREMENTS =
  "They don't need a wallet for you to launch it. To collect, they connect one — and if the " +
  "relayer is funded, they don't need any ETH either: we send the claim and pay the gas. " +
  "Otherwise they pay for one transaction.";
