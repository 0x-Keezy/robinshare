import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RSShell, RS } from "@/components/RSShell";
import { OFFICIAL_X_HANDLE, OFFICIAL_X_URL } from "@/lib/social";

export const metadata: Metadata = {
  title: "The work comes before the wallet — RobinShare",
  description:
    "RobinShare lets anyone launch a coin for a builder and route its configured trading fees to a vault that builder can claim.",
};

const eyebrow = { fontFamily: "var(--f-mono)", color: RS.FAINT, letterSpacing: "0.16em" } as const;
const prose = "text-[1.05rem] leading-[1.78] sm:text-[1.1rem]";

function P({ children }: { children: React.ReactNode }) {
  return <p className={prose} style={{ color: RS.DIM }}>{children}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t pt-8 sm:mt-18" style={{ borderColor: RS.HAIR }}>
      <h2 className="text-[clamp(1.7rem,4vw,2.3rem)]" style={{ fontFamily: "var(--f-display)", letterSpacing: "-0.025em" }}>
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export default function ArticlePage() {
  return (
    <RSShell>
      <main className="rs-shell py-10 sm:py-14">
        <article className="mx-auto max-w-3xl">
          <div className="text-[10px] uppercase" style={eyebrow}>RobinShare · Article</div>
          <h1 className="mt-4 max-w-2xl text-[clamp(2.6rem,8vw,5.1rem)] leading-[0.94]" style={{ fontFamily: "var(--f-display)", letterSpacing: "-0.045em" }}>
            The work comes before the wallet.
          </h1>
          <p className="mt-6 max-w-2xl text-[clamp(1.2rem,2.5vw,1.45rem)] leading-relaxed" style={{ color: RS.DIM }}>
            RobinShare is a way to launch a coin for someone who is already building — and leave a claimable share of its trading fees in their name.
          </p>
          <div className="mt-9 overflow-hidden rounded-[14px]" style={{ border: `1px solid ${RS.HAIR}`, boxShadow: "var(--rs-sheet)" }}>
            <Image src="/article/robinshare-live.png" alt="RobinShare is live" width={1080} height={1350} priority className="h-auto w-full" />
          </div>

          <div className="mt-10 flex flex-col gap-5">
            <P>There is a familiar pattern in crypto.</P>
            <P>Someone makes a useful tool. They publish research. They keep a repo alive. They organize a community, write the docs, answer the messages, and fix the things nobody notices until they break.</P>
            <P>People see the work. They reply with a like, a quote tweet, or a message that says: <i>this deserves more attention.</i></P>
            <P>Then the moment passes.</P>
            <P>The person who created the value is still there. But there is no durable way for the support around their work to become something they can actually receive.</P>
            <P>RobinShare begins with a simple idea: <strong style={{ color: RS.INK }}>the work should not have to wait for the wallet.</strong></P>
            <P>A builder does not need to launch their own coin, run a token sale, or even know that someone wants to support them. A supporter can create a coin in that builder&apos;s name, direct a share of its trading fees to a vault tied to their identity, and let the builder claim it when they are ready.</P>
            <p className="pt-2 text-[clamp(1.45rem,3vw,1.85rem)] leading-snug" style={{ fontFamily: "var(--f-display)", color: RS.INK }}>Not a promise to pay later.<br />A rail that is created at launch.</p>
          </div>

          <Section title="Name the person, not just the idea">
            <P>When a RobinShare coin is created, the launcher chooses who it is for.</P>
            <P>That person can be identified through a GitHub handle or a wallet address. The identity is not a label added after the fact; it is the reference used to connect the coin&apos;s fee flow to a vault.</P>
            <P>Instead of saying, “we will share something with this builder if the coin does well,” the launcher establishes the recipient path when the coin is born. The builder does not need to trust a future dashboard, a treasury committee, or the goodwill of the person who launched it.</P>
            <blockquote className="border-l-2 py-1 pl-5 text-[clamp(1.35rem,3vw,1.75rem)] leading-snug" style={{ borderColor: RS.INK, fontFamily: "var(--f-display)", color: RS.INK }}>Can this identity find a vault in its name and claim what accrued there?</blockquote>
            <P>That is the product.</P>
          </Section>

          <Section title="Every trade can set something aside">
            <P>RobinShare is built around fees configured when a coin launches on pons v2.</P>
            <P>As the coin trades, the relevant share accrues to the vault associated with the named identity. The payout is not a manual gesture that must be renegotiated trade by trade. The economic relationship is established before the trading activity starts.</P>
            <P>That does not make a coin automatically valuable. It does not guarantee demand. And it does not turn attention into a moral debt.</P>
            <P>It does make one thing explicit: if a community decides to trade around someone&apos;s work, there can be a defined place for that person to receive part of the value created around it.</P>
            <P>The point is not to force every contribution into a market. The point is to make the recipient real when a market already exists.</P>
          </Section>

          <Section title="Claim when you are ready">
            <P>The builder can later search using the identity that was named at launch.</P>
            <P>If a vault exists, the claim path is designed to prove that the person claiming is the person the launcher named. For a wallet identity, that means signing with the named wallet. For a GitHub identity, the relevant route uses GitHub sign-in as part of the identity-proof flow.</P>
            <P>After that proof, the recipient can claim the ETH that accrued to their vault.</P>
            <p className="text-[clamp(1.35rem,3vw,1.75rem)] leading-snug" style={{ fontFamily: "var(--f-display)", color: RS.INK }}>Name someone → fees accrue → that identity claims.</p>
            <P>No one needs to discover a private arrangement. No launcher needs to remember a promise. No recipient needs to have been present on day one.</P>
          </Section>

          <Section title="What RobinShare does not claim">
            <P>Transparency matters more than a perfect launch narrative.</P>
            <div className="rounded-[12px] p-6" style={{ background: "var(--rs-surface), var(--rs-paper)", borderTop: "1px solid var(--rs-edge-top)", borderBottom: "1px solid var(--rs-edge-bot)" }}>
              <p className="text-sm leading-relaxed" style={{ color: RS.INK }}><strong>RobinShare is live on Robinhood Chain, but the contract has not been audited.</strong> The GitHub claim route uses a disclosed attester as part of the identity flow. The pons owner can redirect creator fees that have not yet been swept, behind a public three-day timelock. These are material constraints, not fine print.</p>
            </div>
            <P>A live contract is not the same thing as a fully de-risked system. A transparent mechanism is not the same thing as a guarantee. And a vault is not a claim that any particular coin will trade, accrue fees, or create value.</P>
            <P>The honest promise is narrower: a recipient identity is selected when the coin launches; a vault can receive the configured share of fees; the named identity has a path to prove itself and claim; and the relevant constraints are stated in public.</P>
          </Section>

          <Section title="The work came first">
            <P>Crypto has many ways to create assets around narratives.</P>
            <P>RobinShare is interested in a more specific question: what if the person behind the work does not have to be the one who launches the asset, markets it, or even arrives with a wallet before the moment begins?</P>
            <P>The work can come first. The recognition can come later. And if people decide to create economic activity around that work, there can be a place where part of that activity is set aside for the person who made it possible.</P>
            <p className="text-[clamp(1.55rem,3.5vw,2.15rem)] leading-snug" style={{ fontFamily: "var(--f-display)", color: RS.INK }}>Name a builder. Set a share aside. Let them claim it.</p>
          </Section>

          <div className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-8 text-sm font-medium" style={{ borderColor: RS.HAIR, color: RS.INK }}>
            <Link href="/create" className="rs-focus underline underline-offset-4">Launch a coin →</Link>
            <a href={OFFICIAL_X_URL} target="_blank" rel="noreferrer" className="rs-focus underline underline-offset-4">{OFFICIAL_X_HANDLE} →</a>
          </div>
        </article>
      </main>
    </RSShell>
  );
}
