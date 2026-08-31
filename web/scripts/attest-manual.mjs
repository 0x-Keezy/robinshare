// web/scripts/attest-manual.mjs — USO EXCEPCIONAL: atestacion MANUAL.
//
// La verificacion de identidad la hace UN HUMANO fuera de banda (mira el GitHub del receptor y
// confirma que es quien dice). Es el escape hatch para cuando el flujo de OAuth esta caido y hay
// un builder esperando cobrar. Firma con la MISMA key del attester canonico.
//
// Uso:
//   ATTESTER_PK=0x.. NEXT_PUBLIC_FACTORY_ADDRESS=0x.. node scripts/attest-manual.mjs <vault> <payout>
//
// Salida (JSON): {vault, payout, deadline, signature} -> pegar en claimAndBind.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUE EL DIGEST SE CONSTRUYE ACA Y NO SE LE PIDE AL CONTRATO
//
// Este script hacia `readContract("bindDigest")` sobre la direccion que le pasaban por argv y
// firmaba lo que volviera. Eso es exactamente la firma en blanco que se elimino del resto del
// server (ver lib/attester.ts y docs/superpowers/plans/2026-08-29-attester-blind-signature-fix.md):
// un contrato hostil que reenvia `bindDigest()` al vault de OTRA persona devuelve un digest cuyo
// `verifyingContract` es la victima, y la firma que sale vale contra ESE vault. Con esta llave
// —que es de CUSTODIA (PENDIENTES §2)— eso significa bindear el vault ajeno y llevarse su ETH en
// la misma transaccion.
//
// El escenario de uso es justo el peor: alguien pide cobrar y provee la direccion del vault.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { createPublicClient, http, hashTypedData, serializeSignature } from "viem";
import { sign } from "viem/accounts";

const RPC = process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = 4663;

/// Debe coincidir EXACTAMENTE con el contrato y con web/lib/bind.ts:
///   EIP712("SocialFeeEscrow", "1")
///   Bind(address payoutWallet,uint256 nonce,uint256 deadline)
///
/// Se exporta a proposito: `test/attest-manual.test.ts` lo compara contra el mismo vector golden
/// que genera el contrato (contracts/test/fixtures/bind-vector.json). Sin ese test, esta seria la
/// TERCERA implementacion del digest y podria divergir en silencio de las otras dos.
export function bindDigestManual(vault, payout, nonce, deadline) {
  return hashTypedData({
    domain: { name: "SocialFeeEscrow", version: "1", chainId: CHAIN_ID, verifyingContract: vault },
    types: {
      Bind: [
        { name: "payoutWallet", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Bind",
    message: { payoutWallet: payout, nonce, deadline },
  });
}

// Corre solo cuando se invoca como script, no cuando el test lo importa.
if (process.argv[1]?.endsWith("attest-manual.mjs")) {
  const [vault, payout] = process.argv.slice(2);
  const factory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!vault || !payout || !process.env.ATTESTER_PK) {
    console.error("uso: ATTESTER_PK=0x.. NEXT_PUBLIC_FACTORY_ADDRESS=0x.. node scripts/attest-manual.mjs <vault> <payout>");
    process.exit(1);
  }
  if (!factory) {
    console.error("falta NEXT_PUBLIC_FACTORY_ADDRESS: sin la factory no puedo probar que <vault> sea nuestro, y firmar a ciegas es como se pierde el ETH de otro.");
    process.exit(1);
  }

  const client = createPublicClient({ transport: http(RPC) });

  // 1) El vault tiene que haber salido de NUESTRA factory. Es la misma capa que ya exigen
  //    lib/identity.ts, lib/relay.ts y la UI del claim.
  const esNuestro = await client.readContract({
    address: factory,
    abi: [{ type: "function", name: "isVault", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] }],
    functionName: "isVault",
    args: [vault],
  });
  if (!esNuestro) {
    console.error(`RECHAZADO: ${vault} no salio de la factory ${factory}.`);
    process.exit(1);
  }

  // 2) El nonce es lo UNICO que se lee del vault. Aunque mintiera, el dominio del digest sigue
  //    scopeado a `vault`, asi que la firma no vale contra ningun otro.
  const escrowAbi = [
    { type: "function", name: "bindNonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "identityType", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
    { type: "function", name: "identityValue", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { type: "function", name: "boundWallet", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  ];
  const [nonce, identityType, identityValue, bound] = await Promise.all(
    ["bindNonce", "identityType", "identityValue", "boundWallet"].map((functionName) =>
      client.readContract({ address: vault, abi: escrowAbi, functionName }),
    ),
  );

  // 3) Lo que el humano tiene que mirar antes de firmar, impreso a stderr para no ensuciar el JSON.
  const tipo = ["wallet", "github", "x"][identityType] ?? `desconocido(${identityType})`;
  console.error("─────────────────────────────────────────────");
  console.error(` vault:    ${vault}`);
  console.error(` identidad: ${tipo} · ${identityValue || "(sin valor)"}`);
  console.error(` payout:   ${payout}`);
  if (bound && bound !== "0x0000000000000000000000000000000000000000") {
    console.error(` OJO: este vault YA esta bindeado a ${bound}. Vas a re-bindearlo.`);
  }
  console.error(" Confirmaste FUERA DE BANDA que quien pide cobrar es esa identidad?");
  console.error("─────────────────────────────────────────────");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
  const digest = bindDigestManual(vault, payout, nonce, deadline);
  const sig = await sign({ hash: digest, privateKey: process.env.ATTESTER_PK });
  console.log(JSON.stringify({ vault, payout, deadline: deadline.toString(), signature: serializeSignature(sig) }, null, 2));
}
