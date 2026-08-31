import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { GET } = await import("@/app/api/github-handle/route");

const call = (login: string) =>
  GET(new NextRequest(`http://localhost/api/github-handle?login=${encodeURIComponent(login)}`));

beforeEach(() => vi.unstubAllGlobals());

describe("chequeo de existencia del handle de GitHub", () => {
  // Cierra el hueco que el contrato no puede cerrar: el charset es verificable en Solidity, la
  // EXISTENCIA de la cuenta no. Con recoveryDays > 0, un handle que nadie puede reclamar
  // convierte el clawback opcional del launcher en uno garantizado.

  it("una cuenta que existe da exists:true", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200 })));
    expect(await (await call("torvalds")).json()).toEqual({ exists: true });
  });

  it("una cuenta que no existe da exists:false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 404 })));
    expect(await (await call("zzq-nonexistent-abc-9x")).json()).toEqual({ exists: false });
  });

  it("pregunta a la API de usuarios, NO al avatar", async () => {
    // El avatar (`github.com/<x>.png`) devuelve 301/302 para rutas RESERVADAS como `apps`,
    // `new` o `sponsors`, asi que afirmaba que esas cuentas EXISTEN — peor que no saber. Medido:
    // de 19 nombres reservados, 11 pasaban. La API de usuarios da 404 limpio para los 19.
    const spy = vi.fn(async (_url: string, _init?: unknown) => ({ status: 404 }));
    vi.stubGlobal("fetch", spy);
    await call("apps");
    expect(spy.mock.calls[0][0]).toBe("https://api.github.com/users/apps");
  });

  it("un rate limit de GitHub da null, no false (fail-open a proposito)", async () => {
    for (const status of [403, 429]) {
      vi.stubGlobal("fetch", vi.fn(async () => ({ status })));
      expect((await (await call(`h${status}`)).json()).exists).toBeNull();
    }
  });

  it("si GitHub no contesta da null, NO false", async () => {
    // Es la distincion que importa: bloquear un launch legitimo porque GitHub esta caido seria
    // peor que el riesgo que esto mitiga.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    const j = await (await call("handle-sin-red")).json();
    expect(j.exists).toBeNull();
  });

  it("rechaza handles que el CONTRATO tampoco aceptaria, sin salir a la red", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    for (const bad of ["-torvalds", "torvalds-", "tor--valds", "a".repeat(40), "tor valds", "tor.valds"]) {
      expect((await (await call(bad)).json()).exists).toBe(false);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("normaliza el @ y las mayusculas igual que el contrato", async () => {
    const spy = vi.fn(async (_url: string, _init?: unknown) => ({ status: 200 }));
    vi.stubGlobal("fetch", spy);
    await call("@NormalizaMe");
    expect(spy.mock.calls[0][0]).toBe("https://api.github.com/users/normalizame");
  });

  it("cachea, para no quemar el rate limit de GitHub (que desactivaria la mitigacion)", async () => {
    const spy = vi.fn(async () => ({ status: 200 }));
    vi.stubGlobal("fetch", spy);
    await call("cacheme");
    await call("cacheme");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
