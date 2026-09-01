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
/// DECLARACION 1 — el contrato no paso por una auditoria externa (`PENDIENTES.md` seccion 8).
///
/// Decision de Jose del 2026-08-31, y viene atada a la seccion 1: el lanzamiento va sin auditar.
/// Una pagina que custodia plata de terceros y no lo dice no esta mintiendo —nunca afirma lo
/// contrario— pero se apoya en que nadie pregunte. Decirlo cuesta conversiones; ese es el precio.
///
/// Se declara en frase propia y no diluida adentro del parrafo para que siga siendo citable, y
/// `test/copy.test.ts` prohibe ademas afirmar lo contrario en cualquier superficie.
export const AUDIT_LINE = " This contract has not been audited.";

/// DECLARACION 2 — el conflicto de interes (`PENDIENTES.md` seccion 5).
///
/// Quien construye RobinShare tambien trabaja en PonsVault, un competidor directo en la misma
/// cadena, y RobinShare se lanza en pons. No hay obligacion formal de declararlo; se declara
/// igual, porque si sale despues por otro lado sale peor. Decision de Jose del 2026-08-31: en la
/// landing Y en el README.
export const CONFLICT_LINE =
  " Disclosure: the person who builds RobinShare also works on PonsVault, a competing product on " +
  "this chain.";

/// Las dos declaraciones, juntas. Se COMPONEN adentro de `CUSTODY_LINE` en vez de agregarse a
/// mano en cada pagina: las nueve direcciones de arte tienen footer propio pero todas renderizan
/// `CUSTODY_LINE`, asi que componerlas aca las pone en las nueve sin tocar nueve archivos — y sin
/// que una decima direccion futura pueda nacer sin ellas.
export const DISCLOSURES = AUDIT_LINE + CONFLICT_LINE;

export const CUSTODY_LINE =
  "Permissionless. The vault has no owner, no upgrades and no emergency hatch, and whoever " +
  "launches a coin can never redirect its fees, unless they set a recovery window at launch, " +
  "which the vault publishes on-chain. Two powers are not ours to disclaim: pons, the launchpad, " +
  "can point a coin's creator fees elsewhere behind a public 3-day timelock, and on a GitHub " +
  "vault our attester signature is what proves the identity, so that key is trusted (wallet " +
  "vaults do not depend on it). ETH-paired launches only. Not affiliated with Robinhood, " +
  "pons or Flap." +
  DISCLOSURES;

/// Version corta para los lugares donde no entra el parrafo entero. Dice MENOS, pero no dice
/// nada distinto: nunca puede afirmar "cero llaves" a secas.
export const CUSTODY_LINE_SHORT =
  "Permissionless. No owner, no upgrades, no emergency hatch, but pons can redirect a coin's " +
  "creator fees behind a public 3-day timelock, and GitHub claims trust our attester key. " +
  "ETH-paired launches only." +
  DISCLOSURES;

/// Lo que un builder necesita de verdad para cobrar. La version anterior decia que no hacia
/// falta "ni wallet ni ETH", y la segunda mitad era falsa: el contrato SOPORTA que un tercero
/// pague el gas (probado en fork), pero el producto no tiene relayer, asi que hoy el gas lo paga
/// quien reclama.
export const CLAIM_REQUIREMENTS =
  "They don't need a wallet for you to launch it. To collect, they connect one, and if the " +
  "relayer is funded, they don't need any ETH either: we send the claim and pay the gas. " +
  "Otherwise they pay for one transaction.";


/// Traduce el error crudo de una wallet a algo que un builder pueda accionar.
///
/// POR QUE EXISTE: al intentar cobrar, la pagina mostraba 500 caracteres de tripas de viem —
/// "Requested resource not available. Request Arguments: chain: ... data: 0x4c013f4f0000..." —
/// a alguien que solo queria su plata. Peor: el error mas comun de todos (`-32002`) no lo tira la
/// cadena sino la EXTENSION, cuando ya hay un pedido pendiente en la ventanita, y el texto de viem
/// manda a mirar el RPC, que es exactamente el lugar equivocado. Verificado contra la cadena real:
/// eth_call, eth_estimateGas, eth_feeHistory y eth_gasPrice responden todos bien.
export function walletErrorHint(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("resource not available") || m.includes("-32002")) {
    return (
      "Your wallet already has a request waiting. Open the extension, clear the pending prompt " +
      "(approve or reject it), then try again. This is not a problem with the chain."
    );
  }
  if (m.includes("user rejected") || m.includes("user denied")) {
    return "You rejected the request in your wallet. Nothing was sent. Press claim again when ready.";
  }
  if (m.includes("insufficient funds")) {
    return (
      "That wallet has no ETH for gas on Robinhood Chain. Either add a little, or ask us to send " +
      "the claim for you if the relayer is on."
    );
  }
  if (m.includes("deadline") || m.includes("expired")) {
    return "The verification expired (it lasts 15 minutes). Verify with GitHub again.";
  }
  if (m.includes("bad attester") || m.includes("invalid signature")) {
    return "That proof was not accepted on-chain. Verify with GitHub again to get a fresh one.";
  }
  if (m.includes("chain") && m.includes("switch")) {
    return "Your wallet is on another network. Switch it to Robinhood Chain and try again.";
  }
  return null;
}

/// Que decirle a alguien cuyo "Connect wallet" no hizo nada.
///
/// POR QUE EXISTE: `useConnect()` devuelve `connect` (un mutate, no async) y `error`. La app solo
/// desestructuraba `connect`, asi que cuando `injected()` no encuentra `window.ethereum` tira
/// ConnectorNotFoundError, el error se queda dentro del estado de la mutacion, y NO LLEGA A LA
/// PANTALLA: el boton se queda ahi, identico, para siempre.
///
/// A quien le pasa: al builder que abre el link desde el telefono —que es el camino por defecto de
/// como esto se comparte— y al que todavia no tiene wallet, que es EL usuario que el producto dice
/// atender. Llegaba al ultimo paso y no habia mensaje, ni error, ni instruccion.
export function connectErrorHint(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("connector not found") || m.includes("provider not found") || m.includes("no injected")) {
    return (
      "We could not find a wallet in this browser. On a phone, open this page from inside your " +
      "wallet app's browser; on a desktop, install one (MetaMask, Rabby) and reload."
    );
  }
  if (m.includes("user rejected") || m.includes("user denied")) {
    return "You dismissed the wallet prompt. Press connect again when you are ready.";
  }
  return message;
}
