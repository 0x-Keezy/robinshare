import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/// EL TEST QUE VIGILA A LOS TESTS.
///
/// Cinco chequeos de `copy.test.ts` pasaban EN VACIO durante semanas. La causa: un `\b` de regex
/// (word boundary, dos caracteres: barra invertida + b) se escribio en el archivo como el
/// caracter de control BACKSPACE (0x08). El regex quedaba en `/<BS>we sweep<BS>/i`, que no matchea
/// nunca — asi que el suite reportaba verde mientras la landing decia lo que el test prohibia.
///
/// Los cinco no eran menores: "ninguna superficie afirma estar auditada", "no se ofrece la ruta de
/// X", "no se atribuye un barrido que nadie hace", "no se publican conteos de tests". Al
/// restaurarlos, DOS fallaron de inmediato con problemas reales que estaban vivos en produccion.
///
/// Un test que no puede fallar es peor que no tener test: ocupa el lugar de uno que si funcionaria
/// y ademas da confianza falsa. Este archivo hace imposible que vuelva a pasar en silencio.
const TEST_DIR = join(process.cwd(), "test");

/// Caracteres de control que NUNCA deberian aparecer en un archivo fuente, y que son exactamente
/// los que produce escribir "\b", "\a", "\v" o "\f" a traves de una capa que interpreta escapes.
const PROHIBIDOS: [number, string][] = [
  [8, "\b (word boundary) escrito como BACKSPACE"],
  [7, "\a escrito como BELL"],
  [11, "\v escrito como VTAB"],
  [12, "\f escrito como FORMFEED"],
  [0, "NUL"],
];

const archivos = readdirSync(TEST_DIR).filter((f) => f.endsWith(".ts"));

describe("los tests no pueden estar corrompidos", () => {
  it("hay archivos de test que revisar", () => {
    expect(archivos.length).toBeGreaterThan(5);
  });

  it.each(archivos)("%s no tiene caracteres de control inyectados", (f) => {
    const src = readFileSync(join(TEST_DIR, f), "utf8");
    for (const [code, desc] of PROHIBIDOS) {
      const i = src.indexOf(String.fromCharCode(code));
      if (i >= 0) {
        const linea = src.slice(0, i).split("\n").length;
        expect.fail(`${f}:${linea} contiene ${desc}. Un regex con eso adentro no matchea NUNCA y el test pasa en vacio.`);
      }
    }
  });

  it("un regex con backspace efectivamente no matchea nada — la prueba de por que esto importa", () => {
    const roto = new RegExp(String.fromCharCode(8) + "we sweep" + String.fromCharCode(8), "i");
    const sano = /\bwe sweep\b/i;
    const texto = "That is why we sweep early and often.";
    expect(roto.test(texto)).toBe(false); // el bug
    expect(sano.test(texto)).toBe(true); // lo que se queria
  });
});
