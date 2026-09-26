import { Keypair, type Connection, type Transaction } from "@solana/web3.js";
import { beforeAll, describe, expect, it } from "vitest";
import { getBounty } from "../bounties";
import { lendCard, stopSharing, type WalletLike } from "../solana/clientGrants";
import { parseMemo } from "../solana/codec";
import { MEMO_PROGRAM_ID } from "../solana/grantTx";

const player = Keypair.generate().publicKey;
const researcher = Keypair.generate().publicKey.toBase58();
const bounty = getBounty("b-trinity-sleep")!;

beforeAll(() => {
  process.env.NEXT_PUBLIC_GRANT_PROGRAM_ID = Keypair.generate().publicKey.toBase58();
  process.env.NEXT_PUBLIC_DEMO_RESEARCHER_PUBKEY = researcher;
});

function harness(statuses: number[] = [201]) {
  const sent: Transaction[] = [];
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  const wallet: WalletLike = {
    publicKey: player,
    sendTransaction: async (tx) => (sent.push(tx), `sig${sent.length}`),
  };
  const connection = {
    getLatestBlockhash: async () => ({ blockhash: "x", lastValidBlockHeight: 1 }),
    confirmTransaction: async () => ({ value: { err: null } }),
    getAccountInfo: async () => null,
  } as unknown as Connection;
  const fetchFn = (async (url: string, init: RequestInit) => {
    posts.push({ url, body: JSON.parse(init.body as string) });
    const status = statuses.shift() ?? 201;
    return new Response(JSON.stringify({ error: "x", tx: "mock-tx" }), { status });
  }) as unknown as typeof fetch;
  return { sent, posts, deps: { wallet, connection, fetchFn } };
}

const memoText = (tx: Transaction, i = 0) => Buffer.from(tx.instructions[i].data).toString("utf8");

describe("lendCard", () => {
  it("memo mode: wallet signs a dd:grant memo matching the bounty, then the server records it", async () => {
    const h = harness();
    const { grantId, tx } = await lendCard(bounty, "card-1", { ...h.deps, mode: "memo" });

    expect(tx).toBe("sig1");
    const ix = h.sent[0].instructions[0];
    expect(ix.programId.equals(MEMO_PROGRAM_ID)).toBe(true);
    expect(parseMemo(memoText(h.sent[0]))).toMatchObject({
      kind: "grant",
      grantId,
      accessType: bounty.accessType,
      pricePerDay: Math.round(bounty.priceUsdc * 1_000_000),
      researcher,
    });
    expect(memoText(h.sent[0])).not.toMatch(/sleep|trinity|deep/i); // nothing health-related on-chain
    expect(h.posts).toEqual([
      { url: "/api/grants", body: { player: player.toBase58(), bountyId: bounty.id, cardId: "card-1", grantId } },
    ]);
  });

  it("anchor mode: builds create_grant signed by the player", async () => {
    const h = harness();
    await lendCard(bounty, "card-1", { ...h.deps, mode: "anchor" });
    expect(h.sent[0].instructions[0].keys[0]).toMatchObject({ pubkey: player, isSigner: true });
  });

  it("retries while the server has not seen the grant yet", async () => {
    const h = harness([404, 201]);
    await lendCard(bounty, "card-1", { ...h.deps, mode: "memo" });
    expect(h.posts).toHaveLength(2);
  }, 10_000);

  it("mock mode posts directly without a wallet signature", async () => {
    const h = harness();
    await lendCard(bounty, "card-1", { ...h.deps, mode: "mock" });
    expect(h.sent).toHaveLength(0);
    expect(h.posts[0].body).not.toHaveProperty("grantId");
  });
});

describe("stopSharing", () => {
  it("memo mode: one tx with a dd:revoke per grant, then tells the server with the signature", async () => {
    const h = harness();
    const ids = ["7f3a00112233445566778899aabbccdd", "00000000000000000000000000000001"];
    const { tx } = await stopSharing(ids, { ...h.deps, mode: "memo" });

    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].instructions.map((_, i) => memoText(h.sent[0], i))).toEqual(ids.map((id) => `dd:revoke id=${id}`));
    expect(h.posts[0]).toEqual({ url: "/api/revoke", body: { player: player.toBase58(), tx, grantIds: ids } });
  });

  it("anchor mode skips disable_delegate when the player never set one", async () => {
    const h = harness();
    await stopSharing(["7f3a00112233445566778899aabbccdd"], { ...h.deps, mode: "anchor" });
    expect(h.sent[0].instructions).toHaveLength(1);
  });
});
