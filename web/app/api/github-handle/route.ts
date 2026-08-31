import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/// GET /api/github-handle?login=torvalds → { exists: true | false | null }
///
/// POR QUE EXISTE. El contrato valida el CHARSET del handle (las reglas reales de GitHub), pero
/// no puede saber si la cuenta EXISTE — eso no es verificable desde Solidity. Y un vault para un
/// handle que nadie puede reclamar, combinado con `recoveryDays > 0`, convierte el clawback
/// OPCIONAL del launcher en uno GARANTIZADO: se lanza "para" un dev, la UI muestra su handle, el
/// claim nunca puede matchear, y a los N días el launcher se lleva todo. Es exactamente el ataque
/// que el producto existe para impedir.
///
/// Un revisor mostró en fork que la clase sigue abierta por dos puertas que el charset no ve:
/// los nombres RESERVADOS de GitHub (`settings`, `about`, `login`…) pasan la validación y no son
/// perfiles de nadie, y un handle válido pero NO REGISTRADO sirve igual.
///
/// `exists: null` significa "no pude averiguarlo" (GitHub caído, rate limit). El que llama tiene
/// que tratar `null` distinto de `false`: bloquear por un GitHub caído sería peor que el riesgo.

/// Mismo charset que `RobinShareVaultFactory._normalize` para GitHub: 1-39 de [a-z0-9-], sin
/// guión al principio, al final, ni dos seguidos. Se valida ACÁ antes de salir a la red — así
/// esto no se convierte en un proxy para pedirle cualquier URL a GitHub.
const GITHUB_HANDLE = /^(?!-)(?!.*--)[a-z0-9-]{1,39}(?<!-)$/;

/// Cache en memoria. La API de usuarios de GitHub limita a 60/h por IP sin auth, y esta ruta es
/// un amplificador gratis: cualquiera puede hacer que la funcion de Vercel golpee github.com en
/// loop. Y como la mitigacion es FAIL-OPEN, agotar ese limite la desactiva por completo — o sea
/// que el rate limit ajeno es el vector, no una molestia. El cache corta la mayoria de los
/// pedidos repetidos; en serverless muere con la instancia, que esta bien: es una defensa de
/// profundidad, no la unica.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { exists: boolean; at: number }>();

function json(login: string, exists: boolean) {
  cache.set(login, { exists, at: Date.now() });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return NextResponse.json({ exists });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("login") ?? "";
  const login = raw.trim().replace(/^@/, "").toLowerCase();

  if (!GITHUB_HANDLE.test(login)) {
    // No es un "no existe": es un handle que el contrato tampoco aceptaría.
    return NextResponse.json({ exists: false, reason: "not a valid GitHub handle" });
  }

  const cached = cache.get(login);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ exists: cached.exists, cached: true });
  }

  try {
    // ORÁCULO: la API de usuarios, NO `github.com/<login>.png`.
    //
    // El avatar parecía la opción barata (sin token, más rate limit), pero **no distingue un
    // usuario de cualquier otra ruta de github.com**. Medido contra GitHub en vivo: `apps`,
    // `new`, `sponsors`, `join` y `contact` devuelven 301/302 — o sea que la ruta afirmaba
    // `exists: true` para nombres RESERVADOS que no son la cuenta de nadie, que es peor que no
    // saber. Y `login`, `signup`, `explore`, `pricing` y `topics` daban 406, que caía en el
    // fail-open. De 19 reservados probados, 11 pasaban.
    //
    // `api.github.com/users/<login>` devuelve 404 limpio para los 19, sin auth. Su rate limit es
    // más bajo (60/h por IP), y por eso está el cache de abajo.
    const res = await fetch(`https://api.github.com/users/${login}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "robinshare-preflight" },
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 404) return json(login, false);
    if (res.status === 200) return json(login, true);
    // 403/429 = rate limit. `null`, nunca `false`: bloquear un launch legítimo porque GitHub nos
    // limitó sería peor que el riesgo que esto mitiga.
    return NextResponse.json({ exists: null, reason: `github responded ${res.status}` });
  } catch {
    return NextResponse.json({ exists: null, reason: "could not reach github" });
  }
}
