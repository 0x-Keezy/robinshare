# RobinShare — banco de contenido para X

Material **suelto**, para no quedarse mudo después del hilo. Cada pieza se entiende sola, sin
contexto previo. El fijado y el hilo de 9 están en `X-LANZAMIENTO.md`.

> Se escribieron 25 piezas en cinco carriles y cinco jueces frescos las puntuaron entre 4 y 6 sobre
> 10. **Sobreviven 13.** Lo que se cayó, se cayó por tres motivos que conviene tener presentes al
> escribir más: repetía el hilo con otras palabras, afirmaba algo que no está verificado, o decía
> "nada se interpone entre el vault y el builder" — que es falso, porque están la llave del
> attester, el multisig de pons y la ventana de recovery.

---

## 1 · Respuestas listas (el carril más útil)

Escritas de antemano para no improvisar a las 3am. Van como reply, no como post.

### « ¿O sea que cualquiera lanza una moneda con mi nombre y no puedo bajarla? »

```
True, and I can't delete it either. The thing worth checking is the recovery window on that vault: the claim page reads it off chain. Zero means the fees wait for you indefinitely. Non-zero means whoever launched it can pull the unclaimed balance after 30+ days.
```

**No contestes** que "nadie puede tocar la plata". Pueden: la llave del attester ata cualquier vault
de GitHub a cualquier wallet.

### « 0,000214 ETH es nada, esto no lo usa nadie »

```
It is nothing. One vault, one trader, and the trader was me. I posted the wei instead of a dashboard because there is nothing else to post. Gas took 36% of it. That is the state of day one, not an argument that anything is working yet.
```

**No contestes** con proyecciones ni con "es temprano". La pieza gana porque concede.

### « No auditado y custodia plata de terceros. Paso. »

```
Fair pass. Nobody deposits into a vault — it holds fees the coin itself generated, and it pays its whole balance to whoever proves the name. That's a smaller surface than custody, not zero. No audit is booked, so it won't read differently next month.
```

**No contestes** listando los tests: eso ya está en el 7/ del hilo y repetirlo se lee a copy-paste.

### « Tenés una llave que puede tocar la plata, no es trustless »

```
Right, it isn't. On a GitHub vault my signature is what proves identity, so that key can point a claim at any wallet. A second key on cold storage can swap the attester and sign in its place. Both addresses are public. A wallet vault uses no key of mine.
```

**No contestes** "pero está en frío". La mitigación cubre perderla, no abusarla.

### « Trabajás en un competidor y lanzás en su launchpad »

```
Yes. I build PonsVault, and RobinShare launches on pons. It's on the site and in the thread because nobody was going to make me say it.
```

**No agregues** lo del multisig acá: ya está en el 8/ del hilo y junto suena a cortina de humo.

---

## 2 · Tweets sueltos · la mecánica

### De dónde sale el 0,70% — día 2

```
pons takes 1% of every trade and hands 70% of that to whoever is registered as the coin's creator.

RobinShare registers a contract there instead of a person. Nothing else gets configured, and 0.70% of every trade starts collecting under someone's name.
```
Media: `06-docs-desktop.png`

### Por qué sólo ETH — día 3

```
RobinShare refuses any launch not paired against ETH, which rules out roughly half of pons.

With an ERC-20 pair, pons credits creator fees into a per-token ledger the vault cannot pay from. attachToken() rejects the launch rather than trap the money.
```
Media: sin media. *La pieza mejor puntuada del banco: dice el rechazo, la razón y el costo, sin una
sola afirmación fuera de los hechos.*

### Qué mirar antes de confiar en una moneda con tu nombre — día 3, o apenas alguien desconfíe

```
If a coin turns up with your handle on it, read recoveryAfter on the vault. Zero is the default and means never.

Any other number is a tap, not a date: from then on the launcher can pull whatever is unclaimed, again and again as more fees arrive.
```
Media: sin media

---

## 3 · Tweets sueltos · la cosa incómoda

### La ventana de recovery, dicha por su nombre — día 2 o 3

```
"Recovery window" is a generous name for it. If the launcher armed one, 30+ days in they can take whatever you haven't claimed, and keep taking as more arrives. The vault publishes the date. Read recoveryAfter before you care about a coin with your handle on it.
```

### El hueco del caso bueno — día 4

```
The case this rail covers worst is the good one. If a coin graduates off the bonding curve, and about 1 in 100 do, the vault has no route of its own to the pool fees and it's on the pons operator from there. I'd rather you know that now than at graduation.
```

---

## 4 · Tweets sueltos · para el que RECIBE

Todo el material existente le habla al que lanza. Estos le hablan al dev nombrado.

### Verificar sin creernos nada — día 2

```
If a vault turns up with your handle, you don't have to trust the site that shows it. Check that it came from the factory: 0xBf25E1d9082B5Ad0b8C68f072E94C797028c6855, verified on the explorer with an exact bytecode match. Anything else is someone else's contract.
```

### Qué cuesta cobrar, de verdad — día 3

```
Claiming is two steps. Prove the name first: a GitHub login, or a signature from the wallet it was made for. Then one transaction, which empties the vault in full.

You cover that gas, and it's the same gas at any balance — which is why on a 0.000214 ETH pilot it ate 36%.
```

### Ignorarlo — día 4, cierra la semana

```
You can ignore it, and nothing bad happens to you. What you can't do is make it disappear: there's no takedown, here or on any launchpad.

And if the launcher armed a recovery window, what you never claim goes back to them after 30 days.
```

---

## 5 · Video corto

El guion que salió del banco **no se usa**: dos de sus seis tomas afirmaban cosas falsas — que "la
cadena contesta con la address de esa persona" (no la tiene, ése es el punto del producto) y que el
vault queda *"sealed"* (el multisig de pons puede reapuntar las fees con 3 días de aviso).

En su lugar, el corte de 15s sale del demo de 38s que ya está filmado, que muestra sólo cosas
reales. Archivos: `robinshare-15s-9x16.mp4` y `robinshare-15s-16x9.mp4`.

---

## Reglas para escribir más

1. **Si una pieza necesita el hilo al lado para no mentir, no es una pieza suelta.** Es la trampa en
   la que cayeron 4 de las 12 descartadas.
2. **Cada vez que aparezca el recibo (0,000214 ETH), va con su denominador**: un solo trader, y el
   piloto corrió con el tax al máximo, así que capturaba 10,70% por trade y no 0,70%. Sin eso, el
   lector infiere volumen equivocado por 15×.
3. **Nunca "nada se interpone entre el vault y la persona".** Se interponen tres cosas: la llave del
   attester, el multisig 2-de-3 de pons y un `recoveryAfter` armado.
4. **Nada sobre cómo funciona el frontend** si no está verificado. "Todos los números se leen de la
   cadena" suena bien y no está comprobado.
5. **Dos rutas de identidad, no tres.** La tercera no se nombra: la factory salió con ese
   verificador en cero y esa creación revierte.
