import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB = process.cwd();
const article = readFileSync(join(WEB, "app", "article", "page.tsx"), "utf8").replace(/\s+/g, " ");
const home = readFileSync(join(WEB, "app", "directions", "legend", "LegendHome.tsx"), "utf8");
const shell = readFileSync(join(WEB, "components", "RSShell.tsx"), "utf8");
const social = readFileSync(join(WEB, "lib", "social.ts"), "utf8");

describe("public RobinShare article", () => {
  it("publishes the final narrative as one article route", () => {
    expect(article).toMatch(/The work comes before the wallet/);
    expect(article).toMatch(/Name the person, not just the idea/);
    expect(article).toMatch(/Every trade can set something aside/);
    expect(article).toMatch(/Claim when you are ready/);
    expect(article).toMatch(/What RobinShare does not claim/);
    expect(article).toMatch(/The work came first/);
  });

  it("keeps material limitations visible in the article", () => {
    expect(article).toMatch(/not been audited/i);
    expect(article).toMatch(/disclosed attester/i);
    expect(article).toMatch(/three-day timelock/i);
    expect(article).not.toMatch(/\btrustless\b/i);
  });

  it("uses a local, deterministic cover instead of generated text in JSX", () => {
    expect(article).toMatch(/\/article\/robinshare-live\.png/);
  });

  it("links the public home and utility shell to the official social account", () => {
    expect(social).toContain("https://x.com/RobinShareApp");
    expect(social).toContain("@RobinShareApp");
    expect(home).toMatch(/OFFICIAL_X_URL/);
    expect(shell).toMatch(/OFFICIAL_X_URL/);
  });
});
