# DEPLOY del attester + dApp a Vercel (flujo github/X automático)

Con esto, la gente crea tokens en `/create` y reclama en `/claim/<escrow>` **sin que vos firmes a mano** (el `attest-manual.mjs` deja de hacer falta). El server verifica GitHub/X solo y firma el voucher.

## Orden

1. **Factory ya desplegada** en 4663 (ver `docs/TEST-MAINNET.md` paso 1) — necesitás su address y saber qué **attester** (address inmutable) le pusiste.
2. Wallet **attester**: su **PK** va al env de Vercel; su **address** DEBE ser la que le pasaste a la factory. (Si no coinciden, todos los claims github/X revierten — `GET /api/health` lo detecta.)

## GitHub OAuth App (~2 min)

1. github.com → Settings → Developer settings → **OAuth Apps** → New OAuth App.
2. **Authorization callback URL**: `https://<tu-dominio>/api/attest/github/callback` (podés poner primero el de Vercel, luego el dominio propio).
3. Guardá **Client ID** y generá un **Client Secret**.

## Reclaim App (para X, ~10 min)

1. dev.reclaimprotocol.org → creá una app → **APP_ID** + **APP_SECRET**.
2. Agregá el provider **"Twitter/X username"** (o el de X que exponga tu identidad) → copiá su **PROVIDER_ID**.

## Deploy a Vercel

Repo local sin remoto → deploy con el CLI desde `web/`:

```bash
cd C:\Users\PC\Flap\web
npx vercel            # login + link; Root Directory = este dir (web/)
npx vercel --prod     # deploy de produccion
```
(o subí `web/` como proyecto en el dashboard de Vercel, cuenta `0xkeezy-3892`, Root Directory `web`.)

### Env vars en Vercel (Project → Settings → Environment Variables)

Copiá de `web/.env.example`. **Secretos** (Production, NO exponer): `ATTESTER_PK`, `ATTESTER_STATE_SECRET`, `GITHUB_CLIENT_SECRET`, `RECLAIM_APP_SECRET`. **Públicas**: `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_RPC_URL`. Y: `GITHUB_CLIENT_ID`, `RECLAIM_APP_ID`, `RECLAIM_PROVIDER_ID_TWITTER`, `APP_BASE_URL=https://<tu-dominio>`.

`ATTESTER_STATE_SECRET`: generá uno con `openssl rand -hex 32`.

## Verificación post-deploy (obligatoria)

```bash
curl https://<tu-dominio>/api/health
```
Debe devolver `{"ok": true, ...}` con **`attesterMatches: true`**. Si da `false`, el `ATTESTER_PK` no corresponde al attester de la factory → arreglá la key (o redesplegá factory). Chequeá también que `env.githubOAuth` y `env.reclaim` sean `true`.

Después: `https://<tu-dominio>/create` (lanzá un token de prueba a tu github) → `https://<tu-dominio>/claim/<escrow>` → **Verify with GitHub** → claim sin firmar a mano.

## Notas

- El `APP_BASE_URL` tiene que ser el dominio real (el redirect del OAuth de GitHub vuelve ahí).
- Si cambiás de dominio, actualizá el callback en la GitHub OAuth App y `APP_BASE_URL`.
- El attester del server y el de la factory son lo mismo por diseño: una sola wallet oráculo. Guardá su PK bien; perderla = redesplegar factory.
