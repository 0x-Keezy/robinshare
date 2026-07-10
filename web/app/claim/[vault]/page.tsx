import type { Address } from "viem";
import { ClaimClient } from "./ClaimClient";

export default async function ClaimPage({ params }: { params: Promise<{ vault: string }> }) {
  const { vault } = await params;
  return <ClaimClient vault={vault as Address} />;
}
