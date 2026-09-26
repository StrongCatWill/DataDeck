import { createHash } from "node:crypto";
import { Keypair, PublicKey, type ConfirmedSignatureInfo, type Connection } from "@solana/web3.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DISC,
  GRANT_LAYOUT,
  decodeGrant,
  encodeCreateGrant,
  formatGrantMemo,
  formatRevokeMemo,
  parseMemo,
  parseRpcMemoField,
} from "../solana/codec";
import { createGrantIx, grantPda } from "../solana/grantTx";
import { grantsFromMemos } from "../solana/memoGrants";

const disc = (name: string) => [...createHash("sha256").update(name).digest().subarray(0, 8)];
const toBase58 = (b: Uint8Array) => new PublicKey(b).toBase58();

const player = Keypair.generate().publicKey;
const researcher = Keypair.generate().publicKey;
const grantId = "7f3a00112233445566778899aabbccdd";
const bountyHash = "ab".repeat(32);

beforeAll(() => {
  process.env.NEXT_PUBLIC_GRANT_PROGRAM_ID = Keypair.generate().publicKey.toBase58();
});

describe("Anchor codec", () => {
  it("discriminators match Anchor's sha256 naming", () => {
    expect(DISC.createGrant).toEqual(disc("global:create_grant"));
    expect(DISC.revokeGrant).toEqual(disc("global:revoke_grant"));
    expect(DISC.consumeGrant).toEqual(disc("global:consume_grant"));
    expect(DISC.disableDelegate).toEqual(disc("global:disable_delegate"));
    expect(DISC.grantAccount).toEqual(disc("account:Grant"));
  });

  it("decodes a Grant account laid out as in lib.rs", () => {
    const data = new Uint8Array(GRANT_LAYOUT.size);
    const view = new DataView(data.buffer);
    data.set(DISC.grantAccount, 0);
    data.set(player.toBytes(), GRANT_LAYOUT.player);
    data.set(researcher.toBytes(), GRANT_LAYOUT.researcher);
    data.set(Buffer.from(grantId, "hex"), GRANT_LAYOUT.grantId);
    data.set(Buffer.from(bountyHash, "hex"), GRANT_LAYOUT.bountyHash);
    data[GRANT_LAYOUT.accessType] = 1;
    view.setBigInt64(GRANT_LAYOUT.createdAt, 1_000n, true);
    view.setBigInt64(GRANT_LAYOUT.expiresAt, 1_300n, true);
    view.setBigUint64(GRANT_LAYOUT.pricePerDay, 500_000n, true);
    data[GRANT_LAYOUT.status] = 1;
    view.setBigInt64(GRANT_LAYOUT.revokedAt, 1_100n, true);

    expect(decodeGrant(data, toBase58)).toEqual({
      player: player.toBase58(),
      researcher: researcher.toBase58(),
      grantId,
      bountyHash,
      accessType: "stream_30d",
      createdAt: 1_000,
      expiresAt: 1_300,
      pricePerDay: 500_000,
      status: "Revoked",
      auto: false,
      ruleHash: null,
      revokedAt: 1_100,
    });
  });

  it("rejects data that is not a Grant account", () => {
    expect(decodeGrant(new Uint8Array(GRANT_LAYOUT.size), toBase58)).toBeNull();
  });

  it("encodes create_grant args after the discriminator", () => {
    const data = encodeCreateGrant(grantId, bountyHash, "single_query", 2_000_000);
    expect(data.length).toBe(65);
    expect([...data.subarray(0, 8)]).toEqual(DISC.createGrant);
    expect(Buffer.from(data.subarray(8, 24)).toString("hex")).toBe(grantId);
    expect(data[56]).toBe(2);
    expect(new DataView(data.buffer).getBigUint64(57, true)).toBe(2_000_000n);
  });

  it("builds create_grant against the player's grant PDA, program ID as the empty rule delegate", () => {
    const ix = createGrantIx({ player, researcher, grantId, bountyHash, accessType: "snapshot_24h", pricePerDay: 1 });
    expect(ix.keys[0]).toMatchObject({ pubkey: player, isSigner: true });
    expect(ix.keys[3].pubkey.equals(ix.programId)).toBe(true);
    expect(ix.keys[4].pubkey.equals(grantPda(player, grantId))).toBe(true);
  });
});

describe("Memo fallback", () => {
  const memo = { grantId, accessType: "stream_30d" as const, expiresAt: 1_727_380_800, pricePerDay: 500_000, researcher: researcher.toBase58(), bountyHash };

  it("round-trips a grant memo and carries no health terms", () => {
    const text = formatGrantMemo(memo);
    expect(text).toMatch(/^dd:grant id=7f3a\S+ type=S30 exp=1727380800 price=500000 res=\S+ bh=\S+$/);
    expect(parseMemo(text)).toEqual({ kind: "grant", ...memo });
  });

  it("parses the RPC memo field and ignores foreign memos", () => {
    const field = `[12] hello world; [44] ${formatRevokeMemo(grantId)}`;
    expect(parseRpcMemoField(field)).toEqual([{ kind: "revoke", grantId }]);
    expect(parseMemo("dd:grant id=zz type=S30")).toBeNull();
  });

  const sig = (signature: string, memoText: string, blockTime: number): ConfirmedSignatureInfo =>
    ({ signature, memo: `[${memoText.length}] ${memoText}`, blockTime, err: null, slot: 0 }) as ConfirmedSignatureInfo;

  // Fake RPC: says which signatures the player signed.
  const fakeConn = (signedByPlayer: string[]) =>
    ({
      getParsedTransaction: async (s: string) => ({
        transaction: { message: { accountKeys: [{ signer: true, pubkey: signedByPlayer.includes(s) ? player : researcher }] } },
      }),
    }) as unknown as Connection;

  it("latest player-signed memo wins: grant then revoke is Revoked", async () => {
    const sigs = [sig("s2", formatRevokeMemo(grantId), 200), sig("s1", formatGrantMemo(memo), 100)]; // newest first
    const [g] = await grantsFromMemos(fakeConn(["s1", "s2"]), player.toBase58(), sigs);
    expect(g).toMatchObject({ grantId, status: "Revoked", createdAt: 100, revokedAt: 200, pricePerDay: 500_000 });
  });

  it("ignores memos the player did not sign", async () => {
    const forged = [sig("s1", formatGrantMemo(memo), 100)];
    expect(await grantsFromMemos(fakeConn([]), player.toBase58(), forged)).toEqual([]);

    const sigs = [sig("s2", formatRevokeMemo(grantId), 200), sig("s1", formatGrantMemo(memo), 100)];
    const [g] = await grantsFromMemos(fakeConn(["s1"]), player.toBase58(), sigs);
    expect(g.status).toBe("Active");
  });
});
