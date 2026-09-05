"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { publicClient, factoryAddress, robinhoodChain } from "@/lib/chain";
import { PONS_LAUNCH_FACTORY, ponsAbi } from "@/lib/pons";
import { CUSTODY_LINE_PARTS } from "@/lib/claims";
import { RSShell, RS } from "@/components/RSShell";

/*
 * DOCS — la pagina que faltaba.
 *
 * POR QUE EXISTE. La landing tiene que caber en una pantalla y por lo tanto dice lo justo: el
 * mecanismo, las tres promesas y la letra chica de custodia. Todo lo demas —la aritmetica exacta
 * del fee, que hace la ventana de recovery, que pasa si la moneda gradua, por que no hay una
 * no hay una tercera ruta de identidad, que se puede y que no con las dos llaves— vivia en el
 * README del repo, o sea en el unico lugar al que no llega la persona a la que este producto le
 * habla: alguien a quien le apartaron plata y no sabe que es un vault.
 *
 * REGLA DE ESTA PAGINA: cada afirmacion es comprobable por el lector, y las que salen de la cadena
 * se LEEN de la cadena en vivo (el tope de tax, el fee del launch, la altura de bloque) en vez de
 * quedar escritas a mano y envejecer en silencio. Donde el dato no llego todavia, se muestra el
 * hueco; nunca un numero inventado de relleno.
 *
 * OJO CON LOS ESPACIOS: cuando un texto arranca justo despues de un tag de cierre Y ademas
 * envuelve al renglon siguiente, el compilador de JSX se come el espacio inicial y sale
 * "70%of that". Ya habia pasado en /create ("1% taxon the coin's pons page") y volvio a pasar
 * cinco veces al escribir esta pagina. Por eso van `{" "}` explicitos, y por eso
 * `scripts/_gluecheck.mjs` recorre las cuatro rutas buscando el patron en el HTML ya renderizado.
 *
 * La promesa de custodia NO se reescribe aca: se renderiza `CUSTODY_LINE_PARTS`, la misma
 * constante que la home y el shell, y `test/copy.test.ts` audita esta pagina como una superficie
 * mas — asi una futura edicion "para que lea mejor" no puede desincronizarla.
 */

const EXPLORER = robinhoodChain.blockExplorers.default.url;
const REPO = "https://github.com/robinshareapp/robinshare";
const labelStyle = { fontFamily: "var(--f-mono)", color: RS.FAINT, letterSpacing: "0.16em" } as const;

const SECTIONS = [
  ["what", "What it does"],
  ["money", "The money"],
  ["claiming", "Claiming"],
  ["vault", "The vault"],
  ["not-ours", "Powers that are not ours"],
  ["limits", "Limits"],
  ["audit", "No audit"],
  ["addresses", "Addresses"],
] as const;

export default function DocsPage() {
  // Los tres numeros que el owner de pons puede mover. Se leen en vivo por la misma razon que en
  // /create: escritos a mano, el dia que pons los cambie esta pagina pasa a mentir sin que nadie
  // toque una linea.
  const [maxTaxBps, setMaxTaxBps] = useState<number | null>(null);
  const [launchFee, setLaunchFee] = useState<bigint | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      publicClient.readContract({ address: PONS_LAUNCH_FACTORY, abi: ponsAbi, functionName: "maxCreatorTaxBps" }),
      publicClient.readContract({ address: PONS_LAUNCH_FACTORY, abi: ponsAbi, functionName: "launchFee" }),
      publicClient.getBlockNumber(),
    ])
      .then(([tax, fee, b]) => {
        if (!alive) return;
        setMaxTaxBps(Number(tax as bigint));
        setLaunchFee(fee as bigint);
        setBlock(b);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const maxPct = maxTaxBps === null ? null : maxTaxBps / 100;
  const factory = factoryAddress();

  return (
    <RSShell>
      <div className="rs-shell py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[190px_minmax(0,42rem)] lg:gap-16">
          {/* EL INDICE. En pantalla ancha se queda fijo al costado — es lo unico de este producto
              que tiene lugar para usar el ancho sin estirar una medida de lectura. Debajo de lg no
              existe: en telefono un indice de ocho anclas es una pantalla entera de links antes de
              llegar al texto. */}
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <div className="text-[10px] uppercase" style={labelStyle}>
                On this page
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {SECTIONS.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="rs-focus text-sm transition-opacity hover:opacity-100"
                      style={{ color: RS.DIM }}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <main>
            <div className="text-xs font-medium uppercase" style={{ ...labelStyle, letterSpacing: "0.24em", color: RS.GREEN_TEXT }}>
              Docs · Robinhood Chain
            </div>
            <h1
              style={{ fontFamily: "var(--f-display)", lineHeight: 1.02, letterSpacing: "-0.02em" }}
              className="mt-3 text-[clamp(1.9rem,6vw,2.8rem)]"
            >
              How RobinShare works, in full.
            </h1>
            <p className="mt-4 text-lg leading-relaxed" style={{ color: RS.DIM }}>
              Everything the landing page does not have room for. Every number here is either read
              off the chain while you load this page, or something you can check yourself with the
              addresses at the bottom.
            </p>

            <Section id="what" title="What it does">
              <P>
                You name a builder — a GitHub handle, or a wallet address — and a coin launches for
                them on pons, the launchpad on this chain. From that moment a cut of every trade
                collects in a contract addressed to that identity. They need no wallet for you to
                launch it, and no idea that it happened. Later they prove the identity is theirs and
                withdraw.
              </P>
              <P>
                Three steps, and only the first one is yours: name them, fees accrue, they claim.
              </P>
            </Section>

            <Section id="money" title="The money">
              <P>
                pons charges <B>1%</B> on every trade and forwards <B>70%</B>{" "}
                of that to whoever is
                registered as the coin&apos;s creator. RobinShare registers the vault instead of a
                person, so <B>0.70% of every trade</B> reaches the builder with nothing else
                configured.
              </P>
              <P>
                You can add a creator tax on top at launch, up to the cap pons enforces
                {maxPct === null ? (
                  <Pending what="the cap" />
                ) : (
                  <>
                    , which right now is <B>{maxPct}%</B>
                  </>
                )}
                . Traders then see <B>1 + tax</B> on the coin&apos;s pons page and the vault takes{" "}
                <B>0.70 + tax</B>. The default is zero extra, so the coin looks like any other coin
                on the launchpad and the builder still earns 0.70%.
              </P>
              <P>
                In the first seconds after a launch the vault takes more than that, because pons&apos;
                snipe tax lands in the same bucket.
              </P>
              <P>
                Launching costs the pons launch fee
                {launchFee === null ? <Pending what="the fee" /> : <> of <B>{fmtEth(launchFee)} ETH</B></>} plus
                gas. RobinShare charges nothing on top, and takes nothing out of the vault:{" "}
                <Code>withdraw()</Code>{" "}
                transfers the contract&apos;s entire balance to the wallet
                that proved the identity.
              </P>
            </Section>

            <Section id="claiming" title="Claiming">
              <P>
                <B>GitHub.</B> The builder logs in through the real GitHub OAuth flow. Our service
                signs a voucher for the wallet they connect, and the contract verifies that
                signature on chain.
              </P>
              <P>
                <B>Wallet.</B> If the vault was made for an address, that address signs a message.
                Nothing else is involved.
              </P>
              <P>
                There is no third route, and that is enforced on chain rather than by policy: this
                factory was deployed with its third verifier set to the zero address, so creating a
                vault of that kind reverts. You can read the argument yourself in the
                factory&apos;s constructor data on the explorer.
              </P>
              <P>
                Claiming costs the claimer one transaction in gas today. There is a relayer that pays
                that gas for them; it is written and tested, and it is currently switched off. On the
                first real claim, gas came to 36% of what was collected — which is small only because
                the amount was.
              </P>
            </Section>

            <Section id="vault" title="The vault">
              <P>
                One vault, one identity, fixed at launch. No owner, no upgrade path, no pause and no
                emergency hatch. Nobody can drain it, and nobody can fix it either if it turns out to
                be wrong.
              </P>
              <P>
                <B>The recovery window is the exception, and it is the thing to check.</B> Whoever
                launches can arm one: a number of days, minimum thirty, off unless they turn it on.
                Once that window passes, they can pull out whatever nobody has claimed — and keep
                pulling as more fees arrive — for as long as the identity stays unproven. Aimed at a
                handle nobody can claim, that is not a safety valve, it is a guaranteed clawback.
              </P>
              <P>
                The number is written into the vault when it is created and cannot be changed
                afterwards. Every claim page reads it back off the chain and shows it as a badge, so
                you can always tell an irrevocable vault from one with a window on it before you
                trust the coin.
              </P>
            </Section>

            <Section id="not-ours" title="Powers that are not ours to disclaim">
              <P>
                Two of these are on every page of this site. The third is a gap rather than a key.
              </P>
              <P>
                <B>pons.</B>{" "}
                The launchpad&apos;s owner is a 2-of-3 multisig that can point any
                coin&apos;s creator fees somewhere other than the vault, behind a public three-day
                timelock. It applies backwards to anything still sitting in the launchpad rather than
                swept into the vault, so sweeping early is the whole mitigation.
              </P>
              <P>
                <B>Our attester key.</B> On a GitHub vault, our signature <i>is</i> the proof of
                identity, so that key can bind any GitHub vault to any wallet. That is inherent to
                attesting an OAuth login on a blockchain. A second key on a cold wallet exists to
                replace the attester if it is ever lost, and it can also rotate the attester to
                itself and then sign — so it is two keys, not one. Vaults made for a wallet address
                depend on neither.
              </P>
              <P>
                <B>Graduation.</B>{" "}
                If a coin crosses the bonding curve and graduates, the vault has
                no route of its own to the pool&apos;s fees; from there it depends on the pons
                operator. Roughly one launch in a hundred gets that far. It is the success case, and
                it is the case this rail covers worst.
              </P>
            </Section>

            <Section id="limits" title="Limits">
              <P>
                <B>ETH-paired launches only.</B> With an ERC-20 pair, pons credits the fees into a
                per-token ledger the vault cannot pay out from, so <Code>attachToken()</Code> refuses
                those launches outright instead of trapping the money. That rules out roughly half of
                pons.
              </P>
              <P>
                <B>No takedown.</B>{" "}
                Anyone can already put anyone&apos;s name on a coin, on any
                launchpad, and nothing here changes that. What changes is where the money goes. If a
                coin exists with your handle on it and you would rather it did not, RobinShare cannot
                delete it. The vault is addressed to you, you can ignore it forever, nothing binds
                you to the coin and the coin does not speak for you.
              </P>
              <P>
                <B>These are memecoins on a bonding curve.</B> They can go to zero, and most do.
                Nothing on this site is investment advice.
              </P>
            </Section>

            <Section id="audit" title="No audit">
              <P>
                <B>This contract has not been audited.</B> That is a decision, not a pending task,
                and there is no audit booked.
              </P>
              <P>
                What it has instead: 56 unit tests on this rail, 10 fork tests that run the whole
                money cycle against pons&apos; deployed contracts, and two rounds of adversarial
                review. The factory is verified on the explorer with an exact bytecode match, which
                proves the code you can read is the code that is running — and nothing about whether
                that code is right.
              </P>
              <P>
                An external audit does exist, and it is not of this. It covers the earlier version of
                the product, on a different launchpad — a tree whose entrypoint, harvest path and
                payout were all rewritten to get here. None of it carries over.
              </P>
            </Section>

            <Section id="addresses" title="Addresses, and how to check any of this">
              <dl className="mt-5 flex flex-col">
                <Row label="Chain">
                  {robinhoodChain.name} · {robinhoodChain.id}
                  {block !== null && (
                    <span style={{ color: RS.FAINT }}> · block {block.toLocaleString("en-US")}</span>
                  )}
                </Row>
                <Row label="Factory">
                  {factory ? <Addr value={factory} /> : <span style={{ color: RS.FAINT }}>not configured</span>}
                </Row>
                <Row label="pons launch factory">
                  <Addr value={PONS_LAUNCH_FACTORY} />
                </Row>
                <Row label="Source">
                  <a
                    href={REPO}
                    target="_blank"
                    rel="noreferrer"
                    className="rs-focus underline decoration-1 underline-offset-4"
                    style={{ color: RS.INK }}
                  >
                    github.com/robinshareapp/robinshare
                  </a>
                </Row>
              </dl>
              <P>
                Any vault publishes what it owes and what it already paid. Open one on the explorer
                and call <Code>pendingAmount()</Code> and <Code>totalPaid()</Code>: those two numbers
                are the whole product, and they do not come from this page.
              </P>
            </Section>

            {/* La promesa de custodia, palabra por palabra la misma que el resto del sitio. Esta
                pagina explica y matiza, pero no puede tener su propia version del compromiso. */}
            <Section id="promise" title="The promise, verbatim">
              <div className="mt-5 flex flex-col gap-5">
                {CUSTODY_LINE_PARTS.map((part) => (
                  <div key={part.label} className="flex flex-col gap-1.5">
                    <span
                      className="text-[11px] font-semibold uppercase"
                      style={{ letterSpacing: "0.07em", color: RS.INK }}
                    >
                      {part.label}
                    </span>
                    <p className="text-[15px] leading-relaxed" style={{ color: RS.DIM }}>
                      {part.body.trim()}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <div className="mt-14 flex flex-wrap gap-3 border-t pt-8" style={{ borderColor: RS.HAIR }}>
              <Link
                href="/create"
                className="rs-focus rs-press rounded-[11px] px-5 py-3 text-sm font-bold"
                style={{ background: RS.GREEN_CTA, color: RS.GREEN_CTA_TEXT }}
              >
                Launch a coin
              </Link>
              <Link
                href="/"
                className="rs-focus rs-press rounded-[11px] px-5 py-3 text-sm font-semibold"
                style={{ background: "var(--rs-surface)", border: `1px solid var(--rs-edge-strong)`, color: RS.INK }}
              >
                Check a balance
              </Link>
            </div>
          </main>
        </div>
      </div>
    </RSShell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24 border-t pt-8 sm:mt-14" style={{ borderColor: RS.HAIR }}>
      <h2
        style={{ fontFamily: "var(--f-display)", lineHeight: 1.1, letterSpacing: "-0.015em" }}
        className="text-[clamp(1.35rem,3.6vw,1.75rem)]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[16px] leading-relaxed" style={{ color: RS.DIM }}>
      {children}
    </p>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: RS.INK, fontWeight: 600 }}>{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[0.92em]" style={{ fontFamily: "var(--f-mono)", color: RS.INK }}>
      {children}
    </code>
  );
}

/// El hueco honesto: si la cadena todavia no contesto, se dice, en vez de escribir el ultimo valor
/// conocido como si fuera de ahora.
function Pending({ what }: { what: string }) {
  return <span style={{ color: RS.FAINT }}> (reading {what} off the chain…)</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t py-3.5 sm:flex-row sm:items-baseline sm:gap-6" style={{ borderColor: RS.HAIR }}>
      <dt className="text-[10px] uppercase sm:w-48 sm:shrink-0" style={labelStyle}>
        {label}
      </dt>
      <dd className="break-all text-[13px]" style={{ fontFamily: "var(--f-mono)", color: RS.DIM }}>
        {children}
      </dd>
    </div>
  );
}

function Addr({ value }: { value: string }) {
  return (
    <a
      href={`${EXPLORER}/address/${value}`}
      target="_blank"
      rel="noreferrer"
      className="rs-focus underline decoration-1 underline-offset-4"
      style={{ color: RS.INK }}
    >
      {value}
    </a>
  );
}

/// Formatea wei a ETH con la precision justa para un fee de launch (que hoy son 5 decimales),
/// sin arrastrar los 18 ceros de `formatEther`.
function fmtEth(wei: bigint): string {
  const n = Number(wei) / 1e18;
  if (n === 0) return "0";
  return n < 0.001 ? n.toFixed(6).replace(/0+$/, "") : n.toFixed(4).replace(/0+$/, "");
}
