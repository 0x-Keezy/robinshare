# RobinShare — kit de lanzamiento v2 (revisado)

> Todos los numeros de este kit se verificaron **contra la cadena en esta sesion** (RPC de Robinhood Chain 4663 + el explorer publico), no contra la memoria ni contra los docs del repo.

## A. Tweet fijado (pinned)

**EN** — 272/280

```
You import someone's library every week and can't pay them. No address on the profile, and asking for one means asking them to work for it.

RobinShare launches a coin in their GitHub name. 0.70% of every trade waits in a vault only they can open.

robinshareapp.com
```

**ES** — 275/280

```
Usas la librería de alguien todas las semanas y no tienes cómo pagarle. No hay address en su perfil, y pedírsela es hacerlo trabajar para darte el gusto.

RobinShare lanza una moneda con su handle de GitHub. El 0,70% de cada trade queda en un vault que solo abre esa persona.
```

Media del fijado: `01-hero-desktop.png` **o** `robinshare-demo-4x5.mp4`.

> El demo busca **@ponsdotfamily**, no un handle propio: la página contesta honestamente
> *"Nothing set aside under this name yet"* y el acta ofrece *"No vault yet · launch one"*.
> Es el primer uso real del producto, no alguien mirándose a sí mismo.


## B. Hilo (9 tweets) — ingles

**1/** — 269/280 · media: 03-deed-sealed.png — el acta con @ponsdotfamily y el sello al bloque real

```
The maintainer whose library unblocked your build has no way to take your money. No address on the profile, and asking for one means asking them to do work first.

RobinShare launches a coin in their GitHub name. 0.70% of every trade waits in a vault addressed to them.
```

**2/** — 243/280 · media: 09-explorer-vault-recibo.png — las 4 tx del vault del piloto en el explorer, con sus fees

```
That loop already ran on mainnet, Aug 31: launch, trade, harvest, GitHub login, claim.

Don't take my word for it. Call totalPaid() on 0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3 and you get 214000000000000 wei. 0.000214 ETH. About fifty cents.
```

**3/** — 233/280 · media: (sin media, o 06-docs-desktop.png si el hilo va con imagen en todos)

```
Two caveats before that number means anything. The only trader was me. And I ran the pilot with the creator tax maxed at 10%, so it captured 10.70% per trade, not the 0.70% a default launch gets.

Gas ate 0.000077 of the payout. 36%.
```

**4/** — 261/280 · media: (sin media)

```
That's the case for the relayer, which pays the gas instead of the builder. Built, tested, currently switched off, so today they connect a wallet and pay for one transaction.

The site used to say no wallet and no ETH needed. Half of that was false, so it went.
```

**5/** — 270/280 · media: 05-bloque-de-confianza.png — el bloque etiquetado del footer, con Audit y Conflict of interest

```
The vault has no owner and no upgrade path. Nobody pauses it or drains it, me included, which also means nobody fixes it if it's wrong.

The launcher can arm a recovery window instead: after 30+ days they can pull the unclaimed balance. Off by default, written on chain.
```

**6/** — 257/280 · media: 04-create-nombrando.png — el formulario nombrando a @ponsdotfamily

```
Two ways to prove you're the name on it. Log in with GitHub and we sign a voucher the contract checks, or sign a message from the wallet it was made for.

There's no third. This factory shipped with the X verifier at the zero address, so that route reverts.
```

**7/** — 265/280 · media: 08-explorer-factory-verificada.png — 'verified (exact match)' en Blockscout

```
The contract has not been audited. My call, and no audit is booked. What it has: 56 unit tests, 10 fork tests against pons' live contracts, two adversarial review rounds.

Exact-match verified on the explorer, which proves the code is the code. Not that it's right.
```

**8/** — 267/280 · media: (sin media)

```
Two keys reach a GitHub vault: the attester that signs identity, and the cold key that can replace it and then sign for itself. Both published. Wallet vaults use neither.

pons' 2-of-3 multisig can also repoint fees, behind a 3-day timelock.

Also: I build PonsVault.
```

**9/** — 256/280 · media: robinshare-demo-16x9.mp4 — el demo de 23s, o 07-docs-mobile.png

```
No takedown either. Anyone can already put your name on a coin anywhere. All that changes here is where the money goes, and you can ignore it forever.

Coins on a curve. They can go to zero, and this isn't advice.

One pilot so far: robinshareapp.com
```


## C. Hilo — espanol

**1/** — 256/280

```
El que mantiene la librería que te desbloqueó el build no tiene cómo cobrarte. No hay address en su perfil, y pedírsela es hacerlo trabajar primero.

RobinShare lanza una moneda con su handle de GitHub. El 0,70% de cada trade queda en un vault a su nombre.
```

**2/** — 250/280

```
Ese ciclo ya corrió en mainnet el 31 de agosto: lanzar, tradear, cosechar, login de GitHub, cobrar.

No me creas. Llama a totalPaid() en 0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3 y devuelve 214000000000000 wei. 0,000214 ETH. Unos cincuenta centavos.
```

**3/** — 254/280

```
Dos aclaraciones antes de que ese número signifique algo. El único que tradeó fui yo. Y el piloto lo lancé con el tax de creador al máximo, 10%, así que capturaba 10,70% por trade y no el 0,70% de un lanzamiento normal.

El gas se comió 0,000077. Un 36%.
```

**4/** — 260/280

```
Ese es el argumento del relayer, que paga el gas en lugar del builder. Construido, probado y hoy apagado, así que por ahora la persona conecta wallet y paga una transacción.

El sitio prometía que no hacía falta ni wallet ni ETH. La mitad era falsa y se cortó.
```

**5/** — 266/280

```
El vault no tiene owner ni camino de upgrade. Nadie lo pausa ni lo vacía, yo incluido, lo que también significa que nadie lo arregla si está mal.

Quien lanza sí puede armar una ventana de recuperación: pasados 30 días o más, se lleva lo no reclamado. Viene apagada.
```

**6/** — 267/280

```
Dos formas de probar que eres el nombre que figura. Entras con GitHub y firmamos un voucher que el contrato verifica, o firmas un mensaje desde la wallet para la que se creó.

No hay una tercera: esta factory salió con el verificador de X en cero y esa ruta revierte.
```

**7/** — 266/280

```
El contrato no está auditado. Decisión mía, y no hay auditoría contratada. Lo que sí tiene: 56 tests unitarios, 10 de fork contra los contratos vivos de pons y dos rondas de review adversarial.

Verificado con match exacto: prueba qué código corre, no que esté bien.
```

**8/** — 277/280

```
Dos llaves alcanzan un vault de GitHub: la que firma la identidad y la llave fría que puede reemplazarla y firmar por sí misma. Las dos publicadas. Los vaults de wallet no usan ninguna.

El multisig de pons también puede desviar fees, con 3 días de aviso.

Y yo hago PonsVault.
```

**9/** — 277/280

```
Tampoco hay forma de bajar una moneda. Cualquiera ya puede poner tu nombre en una, donde sea. Lo único que cambia acá es a dónde va la plata, y puedes ignorarla siempre.

Van en curva y pueden ir a cero. No es consejo financiero.

Un piloto hasta ahora: robinshareapp.com
```


## D. Articulo (1396 palabras)

# How to pay a dev who has never heard of you

Pick a maintainer whose library you've imported every week for two years and try to send them fifty dollars.

There's no address on their profile. Sponsors needs them enrolled. You could open a pull request adding a funding file, which means asking them to do work so that you can give them money. Most people give up around there.

RobinShare is one narrow way around it. You name a builder — a GitHub handle, or a wallet address — and a coin launches for them on pons, the launchpad on Robinhood Chain. From that moment 0.70% of every trade collects in a small contract addressed to them. They need no wallet for you to launch it, and no idea that it happened. A stranger can decide a developer deserves a cut of a market that developer never opened, and the developer collects it with a GitHub login.

## Where the 0.70% comes from

pons charges 1% on every trade and forwards 70% of that to whoever is registered as the coin's creator. RobinShare registers a contract instead of a person, and nothing else has to be configured.

If you want them to earn more, you can set a creator tax at launch, up to the cap pons enforces. I read that cap off the chain while writing this and it's 1000 basis points, so 10%. Traders then see 1 + tax on the pons page and the vault takes 0.70 + tax. RobinShare defaults to zero extra, so the coin looks like any other coin on the launchpad and the builder still earns 0.70%. In the first seconds it takes more, because pons' snipe tax falls into the same bucket.

## The vault

It's 9,034 bytes of deployed bytecode that knows one identity. Claiming calls `withdraw()`, which sends the entire balance in one transaction.

There's no owner and no upgrade path. Nobody can pause it or drain it, me included, which also means nobody can fix it if it turns out to be wrong.

The launcher can't redirect the fees afterward either, with one exception, and it's the exception you should ask about: a recovery window. If they switch it on at launch — minimum thirty days, off by default — then once that window passes they can pull out whatever nobody has claimed, and keep pulling as more fees arrive, for as long as the identity stays unproven. Aimed at a handle that doesn't exist, that isn't a safety valve, it's a guaranteed clawback wearing one as a costume. The number gets written into the vault at launch and the claim page reads it back off the chain, so you can check it before trusting a coin somebody launched in your name. The pilot vault I ran reads zero.

Two ways to prove you're the person named. GitHub: you log in through the real OAuth flow, our service signs a voucher, and the contract checks the signature. Wallet: you sign a message from the address the vault was made for. There's no third route, because this factory went out with the X verifier set to the zero address and that path reverts on chain rather than half-working.

## What the first claim cost

On August 31 the loop ran end to end on mainnet. Launch, trade, harvest the fees out of pons, log in with GitHub, claim.

The vault is `0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3`, and you don't have to take my word for any of it: call `totalPaid()` on that address. It returns 214000000000000 wei. That's 0.000214 ETH, about fifty cents at the price the explorer was showing while I wrote this.

Gas took 0.000077 of it. That's 36%.

Two things you should know before that number means anything. I was the only trader; the volume was me. And I launched the pilot with the creator tax at the maximum, 10% — pons has it recorded as 1000 bps, which anyone can read back — so that vault was capturing 10.70% of each trade, not the 0.70% a default launch gets. Fifty cents came out the far end of a coin nobody else touched.

I could have pushed more through it and posted a rounder number. The gas would've hidden inside it, because gas doesn't shrink when the payout does. Which is the argument for the relayer: it pays the gas so the builder doesn't. It's written and tested, and it's off, so today whoever claims connects a wallet and pays for one transaction. The site used to promise they'd need neither a wallet nor ETH. The second half was false, so it got cut.

## What I can't promise

Three things can move this money without the builder. The first two are printed on every page of the site.

The first is pons. Its owner is a 2-of-3 multisig that can point any coin's creator fees somewhere other than the vault. There's a public three-day timelock, so you'd see it coming, but it applies backwards to anything still sitting in the launchpad rather than swept into the vault. Sweeping early is the whole mitigation, and the keeper that does the sweeping is mine to keep running.

The second one is mine. On a GitHub vault my signature is the proof of identity, so that key could bind any GitHub vault to any wallet. Attesting an OAuth login on a blockchain means somebody signs, and here that somebody is me. The key is `0x1E047B17BF45aE7D29287bd6389De4982C343f0A`, published on purpose. There's a second key on a cold wallet whose job is to replace the attester if it's ever lost, and a reviewer showed, with a test that's still in the repo, that the replacement key can rotate the attester to itself and then sign its own voucher. So it's two keys over a GitHub vault, not one. Wallet vaults depend on neither.

The third isn't a key, it's a hole. If a coin graduates off the bonding curve — roughly one in a hundred do — the vault has no route of its own to the pool's fees, and from there it depends on the pons operator. The success case is the case this rail covers worst, and you should hear that from me rather than find it out later.

## No audit, half a launchpad, and no takedown

The contract hasn't been audited. That was a call I made, and there's no audit booked. What it has instead: 56 unit tests on the new rail, 10 fork tests that run the whole money cycle against pons' deployed contracts, and two rounds of adversarial review by fresh agents whose job was to break it. The factory is verified on the block explorer with an exact bytecode match, which tells you the code you're reading is the code that's running, and nothing at all about whether that code is right.

Only ETH-paired launches work. With an ERC-20 pair, pons credits the fees into a per-token ledger the vault can't pay from, so the launch is refused instead of trapping the money. That rules out roughly half of pons. Losing half a launchpad is the price of not having an inbox full of people whose ETH is stuck.

And the question people ask first: no, there's no takedown. Anyone can already put anyone's name on a coin, on any launchpad, and no permission system anywhere stops that. What changes here is only where the money goes. The vault is addressed to the person named, they can ignore the whole thing forever, nothing binds them to the coin and the coin doesn't speak for them. If one with your handle on it exists and you'd rather it didn't, RobinShare can't delete it, and neither can I.

I also build PonsVault, a competing product on this same chain, and RobinShare launches its coins on pons.

## Where it stands

Live on Robinhood Chain, chain id 4663. The factory is `0xBf25E1d9082B5Ad0b8C68f072E94C797028c6855`. Deploying it and running the pilot was budgeted at about 0.0065 ETH. No usage numbers here, because there are none: the only coin the factory has made so far is the pilot I ran myself.

Site robinshareapp.com. The full mechanics, including the parts this piece had to compress, are at robinshareapp.com/docs. Code at github.com/0x-Keezy/robinshare, and everything above is readable on robinhoodchain.blockscout.com.

These are memecoins on a bonding curve. They can go to zero and most do, none of this is investment advice, and RobinShare is not affiliated with Robinhood, pons or Flap.



---

## D-bis. La página de docs

El sitio ahora tiene **`/docs`**, linkeada desde el nav (de 640px para arriba) y desde el pie de la
home (que es la puerta en teléfono). Nueve secciones con todo lo que la landing no tiene lugar para
decir, incluidas las tres cosas que hasta hoy no estaban en ninguna superficie: **qué hace la
ventana de recovery** (es un clawback del saldo no reclamado), **qué pasa si la moneda gradúa** (el
vault se queda sin ruta propia a las fees del pool) y que **no hay takedown**. El tope de tax, el
fee del launch y la altura de bloque se leen de la cadena al cargar.

El hilo y el artículo pueden linkear ahí en vez de arrastrar el detalle: `robinshareapp.com/docs`.

## E. Qué falta que decidas vos (nadie más puede)

- [ ] **Voseo o tuteo.** El hilo en español quedó en **tuteo neutro** ("usas", "puedes", "no me creas"), no rioplatense. Si el target es cripto-Twitter argentino, hay que pasarlo a voseo; si es LatAm amplio o Perú, queda como está.
- [ ] **Quién postea qué.** ¿El hilo va por @RobinShareApp y el artículo lo comparte @0xKeezy, o todo por la cuenta de producto? El artículo está escrito en primera persona ("my call", "I build PonsVault"), así que si lo firma la cuenta de producto hay que revisar esa voz.
- [ ] **Dónde vive el artículo.** No tiene casa: puede ir a Mirror, a un `/blog` en robinshareapp.com, o al README. Si va al sitio, es media hora más de trabajo.
- [ ] **¿Va versión en español del artículo?** Hoy solo existe en inglés.
- [ ] **El precio del ETH.** El artículo dice "about fifty cents": medido con ETH a **$2.494** (leído del explorer el 2026-09-03). Si al publicar el precio se movió mucho, hay que reajustar esa frase.

## F. Orden de publicación

1. **Fijado** con `01-hero-desktop.png` o el video 4:5. Se fija al perfil.
2. **Hilo** (9 tweets) el mismo día, un rato después. El 2/ lleva la captura del explorer: es el tweet que sostiene todo lo demás.
3. **Artículo** al día siguiente, citado desde el 9/ o como quote del fijado.

## G. Las cinco objeciones que van a llegar, contestadas antes

1. **"¿Cualquiera puede lanzar una moneda con mi nombre y no puedo bajarla?"** — Correcto, y está escrito en el artículo: no hay takedown, ni acá ni en ningún launchpad. Lo único que cambia es a dónde va la plata. Contestar eso, no discutir.
2. **"0,000214 ETH es nada"** — Sí. El hilo lo dice antes que el crítico, con el detalle de que el único que tradeó fue Jose y que el piloto corrió con el tax al máximo.
3. **"¿No auditado y custodia plata de terceros?"** — Sí. Decisión tomada, sin auditoría contratada. Lo que hay son 56 tests + 10 de fork + dos rondas adversariales, y está dicho que eso no es una auditoría.
4. **"Tenés una llave que puede tocar la plata"** — Dos, y las dos están publicadas en el artículo con la dirección. En vaults de wallet no participa ninguna.
5. **"Trabajás en un competidor"** — Declarado en el 8/, en el artículo y en el footer del sitio.

## H. Los archivos

- Videos: `robinshare-demo-16x9.mp4` (X y artículo) · `robinshare-demo-4x5.mp4` (feed de X) · `robinshare-demo-9x16.mp4` (TikTok / Reels / Shorts). Los tres llenan su pantalla, ninguno tiene barras.
- Imágenes: `01-hero-desktop` · `02-hero-mobile` · `03-deed-sealed` · `04-create-nombrando` · `05-bloque-de-confianza` · `06-docs-desktop` · `07-docs-mobile` · `08-explorer-factory-verificada` · `09-explorer-vault-recibo`.
- Todo sale del producto corriendo contra la cadena real, con el vault del piloto de verdad. No hay una sola maqueta.
