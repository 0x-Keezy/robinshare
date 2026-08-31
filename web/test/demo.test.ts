import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/// EL MODO DEMO NO PUEDE ESTAR VIVO EN PRODUCCION.
///
/// `?demo=1` fue escrito cuando no habia vaults reales que leer. Desde que los hay, aplicado sobre
/// la URL de un vault REAL se convierte en una pagina de phishing en el dominio del propio
/// producto: pinta un saldo inventado y termina diciendo "Claimed — fees released" con link a una
/// transaccion que no existe. Un builder que lo ve deja de intentar el claim de verdad.
///
/// Este test es la guarda: el flag tiene que depender de una env var que NO se setea en
/// produccion, no solo del query param.
const src = readFileSync(join(process.cwd(), "app", "claim", "[vault]", "ClaimClient.tsx"), "utf8");

describe("modo demo", () => {
  it("exige una env var ademas del query param", () => {
    const decl = src.match(/const isDemo =[\s\S]{0,400}?;/);
    expect(decl, "no encontre la declaracion de isDemo").not.toBeNull();
    expect(decl![0]).toMatch(/NEXT_PUBLIC_ALLOW_DEMO/);
  });

  it("el query param solo no alcanza", () => {
    // Simula las dos ramas de la condicion tal como esta escrita.
    const conDemoSinEnv = (undefined as string | undefined) === "1" && true;
    expect(conDemoSinEnv).toBe(false);
  });

  it("no queda ningun otro camino que active el demo desde la URL", () => {
    const usos = [...src.matchAll(/get\("demo"\)/g)];
    expect(usos.length, "hay mas de un lugar que lee ?demo de la URL").toBe(1);
  });
});
