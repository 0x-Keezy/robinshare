import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CUSTODY_LINE,
  CUSTODY_LINE_PARTS,
  CUSTODY_LINE_SHORT,
  CLAIM_REQUIREMENTS,
  AUDIT_LINE,
  CONFLICT_LINE,
} from "@/lib/claims";

/// Gate de honestidad del copy, ejecutable.
///
/// Por que existe: la landing venia del rail de Flap y afirmaba cosas que en pons son FALSAS —
/// "la moneda sale en Flap", "la unica llave privilegiada es el Guardian de Flap", "cero llaves".
///
/// Por que se REESCRIBIO: la primera version de este gate tenia el agujero exactamente donde
/// estaban las mentiras. Buscaba `/no owner|owner keys|keys held|no custody|admin key|no keys/`,
/// y cuatro de las nueve direcciones decian **"non-custodial"** — que no matchea "no custody" —
/// asi que se saltaban el requisito entero y el suite quedaba verde. Y no miraba `RSShell`, que
/// es el chrome de `/create` y `/claim`, las dos unicas paginas donde se firma algo. Lo cazo un
/// revisor externo. Moraleja incorporada abajo: las reglas se escriben sobre la PROMESA, no
/// sobre una redaccion puntual de esa promesa.

const WEB = process.cwd();
const DIRECTIONS_DIR = join(WEB, "app", "directions");

/// El texto de una pagina JSX viene cortado en varias lineas, asi que se colapsa el espacio
/// antes de buscar frases: un "3-day timelock" partido por un salto de linea es la misma promesa.
const flat = (s: string) => s.replace(/\s+/g, " ");

function pageFiles(): { name: string; src: string }[] {
  const dirs = readdirSync(DIRECTIONS_DIR).filter((d) =>
    statSync(join(DIRECTIONS_DIR, d)).isDirectory(),
  );
  return dirs.flatMap((d) =>
    readdirSync(join(DIRECTIONS_DIR, d))
      .filter((f) => f.endsWith("Home.tsx"))
      .map((f) => ({
        name: `${d}/${f}`,
        src: flat(readFileSync(join(DIRECTIONS_DIR, d, f), "utf8")),
      })),
  );
}

const pages = pageFiles();
const shell = flat(readFileSync(join(WEB, "components", "RSShell.tsx"), "utf8"));
const createPage = flat(readFileSync(join(WEB, "app", "create", "page.tsx"), "utf8"));
const claimPage = flat(readFileSync(join(WEB, "app", "claim", "[vault]", "ClaimClient.tsx"), "utf8"));

/// Toda superficie publica que hable de custodia. Incluye el shell A PROPOSITO: es lo que se
/// ve en las dos paginas donde el usuario compromete dinero.
const surfaces: [string, string][] = [
  ...pages.map((p) => [p.name, p.src] as [string, string]),
  ["components/RSShell.tsx", shell],
];

describe("la promesa vive en UN solo lugar", () => {
  it("hay nueve direcciones de arte para revisar", () => {
    // Sin esto, agregar una decima direccion la dejaria fuera del gate en silencio: un `it.each`
    // sobre un glob pasa perfecto cuando el glob no matchea nada.
    expect(pages.length).toBe(9);
  });

  it.each(surfaces)("%s usa la constante compartida, no su propia redaccion", (_n, src) => {
    expect(src).toMatch(/CUSTODY_LINE(_SHORT)?/);
    expect(src).toMatch(/from "@\/lib\/claims"/);
  });

  it.each(surfaces)("%s no reescribe la promesa a mano", (_n, src) => {
    // Las redacciones sueltas son justo lo que se desincronizo cuando cambio el rail.
    expect(src).not.toMatch(/non-custodial\. Funds/i);
    expect(src).not.toMatch(/Zero keys held/i);
  });
});

describe("la constante canonica dice la verdad completa", () => {
  it("nombra a pons y su timelock de 3 dias", () => {
    expect(CUSTODY_LINE).toMatch(/pons/);
    expect(CUSTODY_LINE).toMatch(/3-day timelock/i);
    expect(CUSTODY_LINE_SHORT).toMatch(/3-day timelock/i);
  });

  it("NO esconde que la llave del attester es de confianza en la ruta GitHub", () => {
    // Cuatro paginas afirmaban "0 admin keys" a secas. Es cierto del contrato y falso del
    // producto: en la ruta GitHub la firma del attester ES la prueba de identidad, asi que esa
    // llave puede bindear cualquier vault de GitHub. Probado en
    // contracts/test/ReviewRound2.t.sol::test_attesterAdmin_SI_alcanzaLosFondosDeUnVaultGithub.
    expect(CUSTODY_LINE).toMatch(/attester/i);
    expect(CUSTODY_LINE_SHORT).toMatch(/attester/i);
  });

  it("no promete que el launcher nunca pueda recuperar: depende de recoveryDays", () => {
    expect(CUSTODY_LINE).toMatch(/recovery window/i);
  });

  it("declara el limite a launches pareados contra ETH", () => {
    expect(CUSTODY_LINE).toMatch(/ETH-paired/i);
    expect(CUSTODY_LINE_SHORT).toMatch(/ETH-paired/i);
  });

  it("sigue diciendo que no estamos afiliados a ninguno de los tres", () => {
    expect(CUSTODY_LINE).toMatch(/Robinhood, pons or Flap/);
  });

  /// El footer dejo de renderizar la constante como un solo bloque de mono gris y ahora renderiza
  /// `CUSTODY_LINE_PARTS`, que la parte por tema y le pone etiqueta a cada parte. Ese es
  /// exactamente el movimiento que puede perder texto sin que nadie lo note: alguien reescribe un
  /// `body` "para que lea mejor" y la promesa queda distinta de la constante que el resto del
  /// gate audita. Por eso la particion se verifica contra el TODO: si los bloques dejan de
  /// componer la constante, esto se pone rojo.
  it("los bloques etiquetados componen exactamente la constante", () => {
    expect(CUSTODY_LINE_PARTS.map((p) => p.body).join("")).toBe(CUSTODY_LINE);
  });

  it("cada bloque tiene etiqueta y cuerpo, y las dos declaraciones van en bloque propio", () => {
    for (const p of CUSTODY_LINE_PARTS) {
      expect(p.label.length, `un bloque quedo sin etiqueta`).toBeGreaterThan(0);
      expect(p.body.trim().length, `el bloque "${p.label}" quedo vacio`).toBeGreaterThan(0);
    }
    // Enterrar de nuevo el no-auditado o el conflicto adentro de otro bloque los devolveria a la
    // letra chica de la que se los saco.
    const cuerpos = CUSTODY_LINE_PARTS.map((p) => p.body);
    expect(cuerpos).toContain(AUDIT_LINE);
    expect(cuerpos).toContain(CONFLICT_LINE);
  });
});

describe("las dos declaraciones que Jose decidio hacer (PENDIENTES 5 y 8)", () => {
  /// Estas dos frases cuestan conversiones, y por eso son exactamente las que un dia alguien va a
  /// querer sacar "solo del hero" o "solo de esta direccion". El gate las trata como parte de la
  /// promesa, igual que el caveat de custodia.

  it("la declaracion de no-auditado viaja DENTRO de la constante compartida", () => {
    // Se verifica sobre la constante COMPUESTA y no sobre el archivo fuente: asi da igual como
    // este escrita la composicion, lo que se exige es que el texto que se renderiza la traiga.
    // Si alguien saca `+ DISCLOSURES` de CUSTODY_LINE, esto se pone rojo aunque el archivo siga
    // exportando AUDIT_LINE.
    expect(CUSTODY_LINE).toContain(AUDIT_LINE.trim());
    expect(CUSTODY_LINE_SHORT).toContain(AUDIT_LINE.trim());
  });

  it("la declaracion del conflicto de interes tambien", () => {
    expect(CUSTODY_LINE).toContain(CONFLICT_LINE.trim());
    expect(CUSTODY_LINE_SHORT).toContain(CONFLICT_LINE.trim());
  });

  it("dicen lo que tienen que decir, no una version aguada", () => {
    expect(AUDIT_LINE).toMatch(/not been audited/i);
    expect(CONFLICT_LINE).toMatch(/PonsVault/);
  });

  it.each(surfaces)("%s no afirma que el contrato SI esta auditado", (_n, src) => {
    // El riesgo no es solo omitir: es que una pagina de marketing gane la palabra "audited" en un
    // badge o un bullet. `audited` a secas queda prohibido; la constante dice "not been audited",
    // que matchearia, asi que se descuenta esa forma antes de mirar.
    const sinLaNegacion = src.replace(/not been audited/gi, "");
    expect(sinLaNegacion).not.toMatch(/\baudited\b/i);
    expect(sinLaNegacion).not.toMatch(/security audit/i);
  });

  it("el README declara el conflicto de interes", () => {
    // Decision de Jose: landing Y README. El README es donde mira quien evalua el codigo.
    const readme = readFileSync(join(WEB, "..", "README.md"), "utf8");
    expect(readme).toMatch(/PonsVault/);
  });
});

describe("el lanzamiento va SIN la ruta de X (PENDIENTES 4)", () => {
  /// La factory se deploya con `xVerifier = 0`, asi que `createVault` con identityType=2 revierte
  /// en cadena (clavado en contracts/test/DeployPons.t.sol). Esto cubre la otra mitad: que la UI
  /// no ofrezca un boton que no puede funcionar.

  it("/create no ofrece X como identidad", () => {
    // Se mira el ARRAY de opciones, no el archivo entero: la palabra "twitter" puede aparecer
    // legitimamente en otros lugares (el campo social del token, por ejemplo).
    const opciones = createPage.match(/\(\[[^\]]*\] as IdentityType\[\]\)/);
    expect(opciones, "no encontre el selector de identidad en /create").not.toBeNull();
    expect(opciones![0]).not.toMatch(/twitter/);
    expect(opciones![0]).toMatch(/github/);
    expect(opciones![0]).toMatch(/wallet/);
  });

  /// LA REGLA ANTERIOR ERA DEMASIADO ESTRECHA Y NO CAZO NADA.
  ///
  /// Buscaba `(launch|fees|vault|coin|builder) ... (on X|X handle|X account)`, y las nueve
  /// paginas siguieron vendiendo la ruta de X de CUATRO formas que ese regex no ve:
  /// `<option value="twitter">X (Twitter)</option>` en el selector de identidad de cuatro
  /// direcciones, "a tweet", "the X oracle", y "x oracle proof" en una lista de metodos. Lo
  /// encontro una auditoria adversarial, no este test.
  ///
  /// Moraleja, la misma que ya esta escrita arriba para el caveat de custodia: la regla se escribe
  /// sobre la PROMESA (aca: "existe una ruta por X"), no sobre una redaccion puntual de ella. Por
  /// eso ahora se prohiben los TERMINOS, que es lo que no se puede parafrasear.
  /// LA REGLA VA SOBRE LA PROMESA, Y ESTA VEZ EN SERIO.
  ///
  /// Version 1: buscaba `(launch|fees|vault|coin) ... (on X|X handle)`. No cazo nada.
  /// Version 2: prohibia cuatro TERMINOS — twitter, tweet, x oracle, x handle. Tampoco cazo la
  /// frase mas comun del sitio entero: **"their GitHub, X, or wallet"**, que estaba VIVA en
  /// produccion en 9 direcciones mientras la suite daba 100/100 verde y la cadena revertia
  /// ZeroAddress(). Dos veces el mismo error, y la segunda escribiendo arriba la leccion que
  /// estaba violando.
  ///
  /// Version 3: se prohibe **la X como palabra suelta**. Eso es la promesa, no una redaccion:
  /// "X" en estas paginas es el nombre de la red, y nombrarla es ofrecerla. No hay forma de
  /// parafrasear "ofrecemos X" sin escribir X. Medido: con las 9 superficies limpias no hay un
  /// solo falso positivo — ninguna usa la letra X para otra cosa.
  const TERMINOS_DE_X = [
    [/\bX\b/, "la X suelta: nombrarla es ofrecerla"],
    [/twitter/i, "twitter"],
    [/\btweets?\b/i, "tweet"],
    [/x oracle/i, "x oracle"],
    [/\bx handle\b/i, "x handle"],
  ] as const;

  it.each(surfaces)("%s no ofrece la ruta de X, que la factory rechaza en cadena", (name, src) => {
    for (const [re, termino] of TERMINOS_DE_X) {
      expect(re.test(src), `${name} menciona "${termino}": la factory va con xVerifier=0 y createVault con identityType=2 revierte`).toBe(false);
    }
  });

  it("la meta description del sitio tampoco la ofrece", () => {
    // Es la que se ve en Google y en cada preview de link compartido — la superficie mas leida
    // del producto, y estaba fuera del gate.
    const layout = flat(readFileSync(join(WEB, "app", "layout.tsx"), "utf8"));
    for (const [re, termino] of TERMINOS_DE_X) {
      expect(re.test(layout), `layout.tsx menciona "${termino}"`).toBe(false);
    }
  });

  it("ninguna superficie se atribuye un barrido que nadie hace", () => {
    // "That is why we sweep early and often" era falso: no hay keeper corriendo. El lector cerraba
    // el parrafo creyendo que el operador cierra la ventana de exposicion al redirect de pons.
    // La verdad —que el barrido es permissionless y lo puede pagar cualquiera, incluido el propio
    // builder— es igual de tranquilizadora y ademas es cierta.
    for (const [name, src] of surfaces) {
      expect(/\bwe sweep\b/i.test(src), `${name} dice "we sweep" y no hay keeper corriendo`).toBe(false);
    }
  });
});

describe("nada puede afirmar lo que el rail no cumple", () => {
  it.each(surfaces)("%s no menciona al Guardian, que en este rail no existe", (_n, src) => {
    expect(src).not.toMatch(/guardian/i);
  });

  it.each(surfaces)("%s no dice que la moneda sale en Flap — sale en pons", (_n, src) => {
    expect(src).not.toMatch(/\bon flap\b/i);
  });

  it.each(pages.map((p) => [p.name, p.src] as [string, string]))(
    "%s nombra el launchpad real y el limite de ETH nativo",
    (_n, src) => {
      expect(src).toMatch(/pons/);
      expect(src).toMatch(/native ETH/);
    },
  );

  it.each(surfaces)("%s no presume de cero llaves sin el caveat", (_n, src) => {
    // La regla ahora cubre TODAS las formas de decirlo, incluida "non-custodial" —
    // que es la que se escapaba.
    const claimsNoKeys =
      /no owner|owner keys|keys held|no custody|custody: none|non-custodial|admin key|no keys|no admin/i.test(
        src,
      );
    if (!claimsNoKeys) return;
    // El caveat puede venir por la constante compartida (que ya lo trae, y eso lo garantizan
    // los tests de arriba) o escrito en la pagina.
    const hasCaveat = /CUSTODY_LINE(_SHORT)?/.test(src) || /3-day timelock/i.test(src);
    expect(hasCaveat, "una pagina que dice 'sin llaves' tiene que traer el caveat").toBe(true);
  });
});

describe("las paginas donde se firma no pueden prometer de mas", () => {
  it("ninguna dice que el builder cobra sin wallet y sin ETH", () => {
    // HOY NO HAY RELAYER. El contrato SI soporta que un tercero pague el gas del claim (probado
    // en fork: un dev con 0 ETH cobro con un relayer), pero el producto no lo tiene construido,
    // asi que quien reclama paga su gas. La frase vieja —"they don't need a wallet or any ETH
    // to collect"— era falsa en las dos mitades. Ver PENDIENTES.md.
    for (const [, src] of [...surfaces, ["create", createPage], ["claim", claimPage]] as [
      string,
      string,
    ][]) {
      expect(src).not.toMatch(/without a wallet or any ETH/i);
      expect(src).not.toMatch(/don&apos;t need a wallet or any ETH/i);
      expect(src).not.toMatch(/don't need a wallet or any ETH/i);
    }
  });

  it("si dice que no hace falta ETH, tiene que ser CONDICIONAL al relayer", () => {
    // La version anterior de esta regla prohibia "any ETH" a secas, porque la frase original
    // ("they don't need a wallet or any ETH to collect") era falsa: no habia relayer. Ahora si
    // lo hay, y la frase honesta es la condicional. Prohibir la mencion sin mas convertiria el
    // gate en un impedimento para decir la verdad — asi que la regla pasa a exigir el SI:
    // cualquier promesa de "sin ETH" tiene que nombrar de que depende.
    expect(CLAIM_REQUIREMENTS).toMatch(/gas/i);
    if (/any ETH|no ETH|without ETH/i.test(CLAIM_REQUIREMENTS)) {
      expect(CLAIM_REQUIREMENTS, "la promesa de 'sin ETH' tiene que decir de que depende").toMatch(
        /relayer/i,
      );
    }
  });

  it("el boton sin gas solo aparece si el relayer contesta que esta prendido", () => {
    // Es el mecanismo que hace verdadera la frase de arriba: la UI pregunta por el estado del
    // relayer y, si no esta, ofrece el camino de siempre en vez de prometer algo que no puede
    // cumplir. Sin este gate, la frase y la realidad podrian divergir en silencio.
    expect(claimPage).toMatch(/relayerReady/);
    expect(claimPage).toMatch(/api\/relay\/claim/);
    expect(claimPage).toMatch(/no gas needed/);
  });

  it("ninguna superficie publica un conteo de tests", () => {
    // Se pudren en cuanto alguien agrega un test, y ya habian llegado a TRES numeros distintos
    // y contradictorios entre paginas (95, 71, 51) con el suite real en otro valor.
    for (const [name, src] of [...surfaces, ["create", createPage], ["claim", claimPage]] as [
      string,
      string,
    ][]) {
      expect(src, `${name} publica un conteo de tests`).not.toMatch(/\b\d{2,4}\s*tests?\b/i);
      expect(src, `${name} publica un conteo de tests`).not.toMatch(/TESTS\s*=\s*\d/i);
    }
  });

  it("nada afirma que las fees no las puede redirigir NADIE", () => {
    // El launcher no puede, y eso es cierto y vendible. Pero "ni nosotros" es falso en la ruta
    // GitHub (la firma del attester ES la prueba de identidad) y en el rail (pons puede, con
    // timelock). Estas dos frases estaban vivas en /create, que es donde se compromete plata, y
    // el gate anterior no miraba esa pagina.
    for (const [name, src] of [...surfaces, ["create", createPage], ["claim", claimPage]] as [
      string,
      string,
    ][]) {
      expect(src, `${name}: "neither can we"`).not.toMatch(/neither can we/i);
      expect(src, `${name}: "not you, not us"`).not.toMatch(/not you,? not us/i);
    }
  });

  it("/claim no ejecuta un voucher que le paga a otra wallet", () => {
    // La cookie de /start ata el flujo al navegador, pero el atacante puede hacer que la VICTIMA
    // arranque el flujo con el payout del atacante — el servidor no puede distinguirlo. La
    // defensa que si funciona es negarse a usar un voucher que no le paga a quien esta mirando.
    expect(claimPage).toMatch(/voucherPaysConnectedWallet/);
    expect(claimPage).toMatch(/voucherForSomeoneElse/);
  });

  it("/create no puede retomar un launch de OTRA identidad", () => {
    // Sin esto, retomar un launch a medias con otro handle en el formulario lanzaba la moneda
    // nueva apuntandole las fees al vault de la identidad anterior. Irreversible.
    expect(createPage).toMatch(/identityKey/);
  });

  it("/create y /claim guardan la cadena antes de firmar", () => {
    // Sin esto, una wallet parada en Ethereum manda la transaccion igual, a una direccion que
    // ahi no tiene codigo: no revierte, se come el gas, y la pagina espera un receipt en 4663
    // que nunca va a existir. Robinhood Chain no viene cargada en ninguna wallet por default.
    for (const src of [createPage, claimPage]) {
      expect(src).toMatch(/switchChainAsync/);
      expect(src).toMatch(/chainId: robinhoodChain\.id/);
    }
  });
});
