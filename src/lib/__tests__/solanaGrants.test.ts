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
  formatRulesMemo,
  parseMemo,
  RULES_OFF_MEMO,
  parseRpcMemoField,
} from "../solana/codec";
import { createGrantIx, grantPda } from "../solana/grantTx";
import { grantsFromMemos } from "../solana/memoGrants";
import { ATA_PROGRAM_ID, TOKEN_PROGRAM_ID, associatedTokenAddress, payoutBatch, payoutIxs } from "../solana/payout";

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
    expect(DISC.setRuleDelegate).toEqual(disc("global:set_rule_delegate"));
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
    ({ signature, memo: `[${memoText.length}] ${memoText}`, blockTime, err: null, slot: blockTime }) as ConfirmedSignatureInfo;

  // Fake RPC: which key signed each signature.
  const fakeConn = (signers: Record<string, PublicKey>) =>
    ({
      getParsedTransaction: async (s: string) => ({
        transaction: { message: { accountKeys: [{ signer: true, pubkey: signers[s] ?? researcher }] } },
      }),
    }) as unknown as Connection;
  const P = player.toBase58();

  it("latest player-signed memo wins: grant then revoke is Revoked", async () => {
    const playerSigs = [sig("s2", formatRevokeMemo(grantId), 200), sig("s1", formatGrantMemo(memo), 100)]; // newest first
    const [g] = await grantsFromMemos(fakeConn({ s1: player, s2: player }), P, { playerSigs });
    expect(g).toMatchObject({ grantId, status: "Revoked", createdAt: 100, revokedAt: 200, pricePerDay: 500_000, auto: false });
  });

  it("ignores memos the player did not sign", async () => {
    const forged = [sig("s1", formatGrantMemo(memo), 100)];
    expect(await grantsFromMemos(fakeConn({}), P, { playerSigs: forged })).toEqual([]);

    const playerSigs = [sig("s2", formatRevokeMemo(grantId), 200), sig("s1", formatGrantMemo(memo), 100)];
    const [g] = await grantsFromMemos(fakeConn({ s1: player }), P, { playerSigs });
    expect(g.status).toBe("Active");
  });

  describe("auto-accept via the rule delegate", () => {
    const delegate = Keypair.generate().publicKey;
    const ruleHash = "cd".repeat(32);
    const auto = formatGrantMemo({ ...memo, player: P, ruleHash });
    const rules = formatRulesMemo({ delegate: delegate.toBase58(), ruleHash, expiresAt: 10_000 });
    const src = (playerSigs: ConfirmedSignatureInfo[], signers: Record<string, PublicKey>) => ({
      conn: fakeConn({ d1: delegate, ...signers }),
      sources: { playerSigs, delegate: delegate.toBase58(), delegateSigs: [sig("d1", auto, 300)] },
    });

    it("counts a delegate grant while the player's rule is in force", async () => {
      const { conn, sources } = src([sig("r1", rules, 100)], { r1: player });
      const [g] = await grantsFromMemos(conn, P, sources);
      expect(g).toMatchObject({ grantId, status: "Active", auto: true, ruleHash, player: P });
    });

    it("rejects it without a rule, with a different rule hash, or after dd:rules-off", async () => {
      const none = src([], {});
      expect(await grantsFromMemos(none.conn, P, none.sources)).toEqual([]);

      const otherRule = formatRulesMemo({ delegate: delegate.toBase58(), ruleHash: "ef".repeat(32), expiresAt: 10_000 });
      const wrong = src([sig("r1", otherRule, 100)], { r1: player });
      expect(await grantsFromMemos(wrong.conn, P, wrong.sources)).toEqual([]);

      const off = src([sig("r2", RULES_OFF_MEMO, 200), sig("r1", rules, 100)], { r1: player, r2: player });
      expect(await grantsFromMemos(off.conn, P, off.sources)).toEqual([]);
    });

    it("rejects a delegate memo not signed by the delegate", async () => {
      const { sources } = src([sig("r1", rules, 100)], { r1: player });
      const conn = fakeConn({ r1: player, d1: researcher });
      expect(await grantsFromMemos(conn, P, sources)).toEqual([]);
    });

    it("the player's revoke still stops an auto grant", async () => {
      const { conn, sources } = src([sig("x", formatRevokeMemo(grantId), 400), sig("r1", rules, 100)], { r1: player, x: player });
      const [g] = await grantsFromMemos(conn, P, sources);
      expect(g.status).toBe("Revoked");
    });
  });
});

describe("USDC payout", () => {
  it("creates the player's token account if needed, then transferChecked price_per_day with 6 decimals", () => {
    const mint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    const [create, transfer] = payoutIxs(researcher, player, mint, 600_000);
    expect(create.programId.equals(ATA_PROGRAM_ID)).toBe(true);
    expect([...create.data]).toEqual([1]); // CreateIdempotent
    expect(create.keys[1].pubkey.equals(associatedTokenAddress(player, mint))).toBe(true);

    expect(transfer.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(transfer.data[0]).toBe(12); // TransferChecked
    expect(transfer.data.readBigUInt64LE(1)).toBe(600_000n);
    expect(transfer.data[9]).toBe(6);
    expect(transfer.keys[0].pubkey.equals(associatedTokenAddress(researcher, mint))).toBe(true);
    expect(transfer.keys[3]).toMatchObject({ pubkey: researcher, isSigner: true });
  });

  it("pays nothing for non-stream grants or mock players", async () => {
    const base = { grantId, bountyHash, researcher: researcher.toBase58(), createdAt: 0, expiresAt: 1, pricePerDay: 1, status: "Active" as const, auto: false, ruleHash: null, revokedAt: null };
    expect(await payoutBatch({ ...base, player: player.toBase58(), accessType: "snapshot_24h" }, 0)).toBeNull();
    expect(await payoutBatch({ ...base, player: "demo-player", accessType: "stream_30d" }, 0)).toBeNull();
  });
});
