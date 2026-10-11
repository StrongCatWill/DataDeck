import { Connection, Keypair, Message, Transaction } from "@solana/web3.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/chain/route";
import { bytesToBase58 } from "../solana/codec";
import { MEMO_PROGRAM_ID } from "../solana/grantTx";

const player = Keypair.generate().publicKey;
const blockhash = Keypair.generate().publicKey.toBase58();
const call = (body: unknown) => POST(new Request("http://test", { method: "POST", body: JSON.stringify(body) }));

function fromBase58(s: string): Uint8Array {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const ch of s) n = n * 58n + BigInt(A.indexOf(ch));
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

describe("base58", () => {
  it("matches web3.js for keys and keeps leading zero bytes", () => {
    const k = Keypair.generate().publicKey;
    expect(bytesToBase58(k.toBytes())).toBe(k.toBase58());
    expect(bytesToBase58(Uint8Array.from([0, 0, 1]))).toBe("112");
  });
});

describe("/api/chain wallet bridge", () => {
  beforeAll(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_RESEARCHER_PUBKEY", Keypair.generate().publicKey.toBase58());
    vi.spyOn(Connection.prototype, "getLatestBlockhash").mockResolvedValue({ blockhash, lastValidBlockHeight: 1 });
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("says which mode the server runs, and needs no wallet in mock mode", async () => {
    vi.stubEnv("GRANT_BACKEND", "mock");
    expect(await (await GET()).json()).toMatchObject({ grantBackend: "mock", cluster: "devnet" });
    expect((await call({ action: "grant", player: player.toBase58(), bountyId: "b-trinity-sleep" })).status).toBe(400);
  });

  it("builds an unsigned dd:grant memo tx for the player's wallet to sign, with nothing health-related in it", async () => {
    vi.stubEnv("GRANT_BACKEND", "memo");
    const res = await call({ action: "grant", player: player.toBase58(), bountyId: "b-trinity-sleep" });
    expect(res.status).toBe(200);
    const { grantId, message } = await res.json();
    const tx = Transaction.populate(Message.from(fromBase58(message)));
    expect(tx.feePayer?.toBase58()).toBe(player.toBase58());
    expect(tx.recentBlockhash).toBe(blockhash);
    expect(tx.instructions[0].programId.equals(MEMO_PROGRAM_ID)).toBe(true);
    const memo = Buffer.from(tx.instructions[0].data).toString("utf8");
    expect(memo).toContain(grantId);
    expect(memo).not.toMatch(/sleep|trinity|heart|steps/i);
  });

  it("rejects a player that is not a wallet address", async () => {
    vi.stubEnv("GRANT_BACKEND", "memo");
    expect((await call({ action: "grant", player: "demo-player", bountyId: "b-trinity-sleep" })).status).toBe(400);
  });
});
