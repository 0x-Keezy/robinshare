import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CUSTODY_LINE, CUSTODY_LINE_SHORT, CLAIM_REQUIREMENTS } from "@/lib/claims";

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

  it("la frase honesta sobre lo que hace falta para cobrar existe y dice 'gas'", () => {
    expect(CLAIM_REQUIREMENTS).toMatch(/gas/i);
    expect(CLAIM_REQUIREMENTS).not.toMatch(/any ETH/i);
  });

  it("ninguna superficie publica un conteo de tests", () => {
    // Se pudren en cuanto alguien agrega un test, y ya habian llegado a TRES numeros distintos
    // y contradictorios entre paginas (95, 71, 51) con el suite real en otro valor.
    for (const [name, src] of [...surfaces, ["create", createPage], ["claim", claimPage]] as [
      string,
      string,
    ][]) {
      expect(src, `${name} publica un conteo de tests`).not.toMatch(/\d{2,4}\s*tests?/i);
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
