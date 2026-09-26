import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/payouts/route";
import type { AccessType, OnChainGrant } from "../types";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  DEVNET_USDC_MINT,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  listPayouts,
  payoutBatch,
  usdcTransferIxs,
} from "../solana/payout";

let n = 0;
function grant(accessType: AccessType, player = `p-${++n}`): OnChainGrant {
  return {
    player,
    researcher: "researcher-demo",
    grantId: (++n).toString(16).padStart(32, "0"),
    bountyHash: "00",
    accessType,
    createdAt: 0,
    expiresAt: 300,
    pricePerDay: 600_000, // 0.60 USDC
    status: "Active",
    auto: false,
    ruleHash: null,
    revokedAt: null,
  };
}

describe("payoutBatch (PAYOUT_MODE unset = simulate)", () => {
  it("pays pricePerDay once per released stream batch", async () => {
    const g = grant("stream_30d");
    const first = await payoutBatch(g, 0);
    expect(first).toMatchObject({ grantId: g.grantId, batch: 0, player: g.player, amount: 600_000, mode: "simulate" });
    expect(first.signature).toMatch(/^sim-/);

    await payoutBatch(g, 1);
    const again = await payoutBatch(g, 0); // researcher re-requests the same key
    expect(again).toBe(first);
    expect(await listPayouts({ grantId: g.grantId })).toHaveLength(2);
  });

  it("pays one-off grants once, whatever the batch", async () => {
    const g = grant("single_query");
    await payoutBatch(g, 0);
    await payoutBatch(g, 1);
    const paid = await listPayouts({ grantId: g.grantId });
    expect(paid).toHaveLength(1);
    expect(paid[0].batch).toBeNull();
  });
});

describe("usdcTransferIxs", () => {
  it("creates the player's token account, then TransferChecked with 6 decimals", () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const mint = new PublicKey(DEVNET_USDC_MINT);
    const [create, transfer] = usdcTransferIxs(from, to, mint, 600_000n);

    expect(create.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    expect([...create.data]).toEqual([1]);
    expect(create.keys[1].pubkey.equals(associatedTokenAddress(to, mint))).toBe(true);

    expect(transfer.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(transfer.data[0]).toBe(12);
    expect(transfer.data.readBigUInt64LE(1)).toBe(600_000n);
    expect(transfer.data[9]).toBe(6);
    expect(transfer.keys[0].pubkey.equals(associatedTokenAddress(from, mint))).toBe(true);
    expect(transfer.keys[3]).toMatchObject({ pubkey: from, isSigner: true });
  });
});

describe("GET /api/payouts", () => {
  it("returns a player's payouts and the USDC total", async () => {
    const g = grant("stream_30d", "p-route");
    await payoutBatch(g, 0);
    await payoutBatch(g, 1);
    const res = await GET(new Request("http://test/api/payouts?player=p-route"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: "simulate", totalUsdc: 1.2 });
  });

  it("needs a player or grantId", async () => {
    expect((await GET(new Request("http://test/api/payouts"))).status).toBe(400);
  });
});
