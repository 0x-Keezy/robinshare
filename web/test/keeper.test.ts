import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_MIN_HARVEST_WEI,
  DEFAULT_MIN_KEEPER_BALANCE_WEI,
  DEFAULT_RPC_GAP_MS,
} from "@/lib/keeper";

/// El keeper corre solo, sin nadie mirando. Estos tests fijan lo que no se puede aflojar sin darse
/// cuenta, y sobre todo la propiedad estructural: que el cron y la CLI sean EL MISMO codigo.
describe("keeper", () => {
  it("una sola implementacion: la CLI importa la libreria, no la copia", () => {
    // Antes toda la logica vivia en scripts/keeper.mjs. Cuando aparecio el cron, la alternativa
    // era duplicarla — y la copia que corre en produccion habria sido justo la que nadie prueba a
    // mano. Este test hace visible el acuerdo.
    const cli = readFileSync(join(process.cwd(), "scripts", "keeper.mts"), "utf8");
    expect(cli).toMatch(/from "\.\.\/lib\/keeper"/);
    expect(existsSync(join(process.cwd(), "scripts", "keeper.mjs")), "el .mjs viejo sigue ahi: son dos implementaciones otra vez").toBe(false);

    const route = readFileSync(join(process.cwd(), "app", "api", "cron", "keeper", "route.ts"), "utf8");
    expect(route).toMatch(/from "@\/lib\/keeper"/);
  });

  it("el cron exige el secreto, y no corre si no esta configurado", () => {
    // `harvest()` es permissionless, asi que esto no protege fondos — protege el GAS del keeper:
    // sin el chequeo, cualquiera le hace quemar su saldo invocando la ruta en loop.
    const route = readFileSync(join(process.cwd(), "app", "api", "cron", "keeper", "route.ts"), "utf8");
    expect(route).toMatch(/CRON_SECRET/);
    expect(route).toMatch(/Bearer \$\{secret\}/);
    expect(route).toMatch(/status: 401/);
    expect(route).toMatch(/status: 503/); // sin CRON_SECRET la ruta esta apagada
  });

  it("hay un cron declarado y no corre mas seguido de lo razonable", () => {
    const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons?: { path: string; schedule: string }[];
    };
    const cron = (vercel.crons ?? []).find((c) => c.path === "/api/cron/keeper");
    expect(cron, "no hay cron declarado para el keeper").toBeTruthy();
    // Cada 15 min: mas seguido gasta gas en pasadas vacias, menos seguido deja crecer la ventana
    // de exposicion al redirect de pons.
    expect(cron!.schedule).toBe("*/15 * * * *");
  });

  it("el piso por vault cubre el costo del harvest", () => {
    // Medido contra la cadena real: un harvest cuesta ~0,000137 ETH de gas. Barrer por debajo de
    // eso es pagar por mover polvo.
    const GAS_MEDIDO = 137_000_000_000_000n;
    expect(DEFAULT_MIN_HARVEST_WEI).toBeGreaterThan(GAS_MEDIDO);
  });

  it("el piso del keeper alcanza para varias pasadas", () => {
    expect(DEFAULT_MIN_KEEPER_BALANCE_WEI).toBeGreaterThan(DEFAULT_MIN_HARVEST_WEI * 5n);
  });

  it("espacia las llamadas al RPC", () => {
    // El RPC publico esta detras de Cloudflare y corta las rafagas devolviendo HTML.
    expect(DEFAULT_RPC_GAP_MS).toBeGreaterThanOrEqual(200);
  });
});
