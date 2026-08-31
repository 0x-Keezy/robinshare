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

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("login") ?? "";
  const login = raw.trim().replace(/^@/, "").toLowerCase();

  if (!GITHUB_HANDLE.test(login)) {
    // No es un "no existe": es un handle que el contrato tampoco aceptaría.
    return NextResponse.json({ exists: false, reason: "not a valid GitHub handle" });
  }

  try {
    // El avatar público: 302 si la cuenta existe, 404 si no. No necesita token y aguanta mucho
    // más rate limit que la API. La URL se construye acá con un handle ya validado — el cliente
    // nunca elige el destino.
    const res = await fetch(`https://github.com/${login}.png`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404) return NextResponse.json({ exists: false });
    if (res.status >= 200 && res.status < 400) return NextResponse.json({ exists: true });
    return NextResponse.json({ exists: null, reason: `github responded ${res.status}` });
  } catch {
    return NextResponse.json({ exists: null, reason: "could not reach github" });
  }
}
