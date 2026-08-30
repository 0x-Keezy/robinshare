import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/// Gate de honestidad del copy, ejecutable.
///
/// Por que existe: la landing venia del rail de Flap y afirmaba cosas que en pons son FALSAS —
/// "la moneda sale en Flap", "la unica llave privilegiada es el Guardian de Flap", "cero llaves".
/// Nada de eso se puede sostener aca:
///
///   - el launchpad ya no es Flap, es pons;
///   - el Guardian de Flap NO EXISTE en este rail (se elimino entero del contrato);
///   - "cero llaves" es cierto de NUESTRO contrato y falso del rail: el owner de pons (un Safe
///     2-de-3) puede redirigir el `creatorFeeRecipient` de cualquier token con un timelock de 3
///     dias, es retroactivo sobre todo lo no barrido, y `renounceOwnership` esta deshabilitado
///     de forma permanente;
///   - RobinShare solo puede cobrar de launches pareados contra ETH nativo — la mitad de pons.
///
/// Un reviewer humano no vuelve a leer nueve direcciones de arte cada vez que se toca una frase.
/// Esto si.

const DIRECTIONS_DIR = join(process.cwd(), "app", "directions");

function homeFiles(): { name: string; path: string; src: string }[] {
  return readdirSync(DIRECTIONS_DIR)
    .filter((d) => statSync(join(DIRECTIONS_DIR, d)).isDirectory())
    .flatMap((d) =>
      readdirSync(join(DIRECTIONS_DIR, d))
        .filter((f) => f.endsWith("Home.tsx"))
        .map((f) => ({
          name: `${d}/${f}`,
          path: join(DIRECTIONS_DIR, d, f),
          // El texto de una pagina JSX viene cortado en varias lineas, asi que se colapsa el
          // espacio antes de buscar frases: un "3-day timelock" partido por un salto de linea
          // sigue siendo la misma promesa.
          src: readFileSync(join(DIRECTIONS_DIR, d, f), "utf8").replace(/\s+/g, " "),
        })),
    );
}

const pages = homeFiles();
const shell = readFileSync(join(process.cwd(), "components", "RSShell.tsx"), "utf8").replace(
  /\s+/g,
  " ",
);

describe("el copy no puede prometer lo que el rail no cumple", () => {
  it("hay nueve direcciones de arte para revisar", () => {
    expect(pages.length).toBe(9);
  });

  it.each(pages.map((p) => [p.name, p.src] as const))(
    "%s no menciona al Guardian, que en este rail no existe",
    (_name, src) => {
      expect(src).not.toMatch(/guardian/i);
    },
  );

  it.each(pages.map((p) => [p.name, p.src] as const))(
    "%s no dice que la moneda sale en Flap — sale en pons",
    (_name, src) => {
      expect(src).not.toMatch(/\bon flap\b/i);
    },
  );

  it.each(pages.map((p) => [p.name, p.src] as const))(
    "%s nombra el launchpad real (pons)",
    (_name, src) => {
      expect(src).toMatch(/pons/);
    },
  );

  it.each(pages.map((p) => [p.name, p.src] as const))(
    "%s declara que solo sirve para launches pareados contra ETH nativo",
    (_name, src) => {
      expect(src).toMatch(/native ETH/);
    },
  );

  it.each(pages.map((p) => [p.name, p.src] as const))(
    "%s: si presume de no tener llaves, tiene que decir que pons SI tiene una",
    (_name, src) => {
      const claimsNoKeys = /no owner|owner keys|keys held|no custody|admin key|no keys/i.test(src);
      if (!claimsNoKeys) return;
      // El caveat completo: quien es (pons), que puede hacer (redirigir las fees) y con cuanto
      // aviso (3 dias). Sin los tres, la frase sigue siendo una promesa que no es nuestra.
      expect(src, "falta el caveat del timelock de pons").toMatch(/3-day timelock/i);
      expect(src, "falta decir que pons puede redirigir las fees").toMatch(/pons/i);
    },
  );

  it("el disclaimer del shell no se queda en Flap", () => {
    expect(shell).toMatch(/pons/);
    expect(shell).not.toMatch(/guardian/i);
  });
});
