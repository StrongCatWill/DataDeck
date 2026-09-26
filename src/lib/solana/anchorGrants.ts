import { Buffer } from "buffer";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getBounty } from "../bounties";
import type { GrantBackend } from "../grants";
import { saltedHash } from "../hash";
import type { GrantView, OnChainGrant } from "../types";
import { DISC, GRANT_LAYOUT, decodeGrant, hexToBytes } from "./codec";
import { grantContext, rememberGrant } from "./grantIndex";
import { consumeGrantIx, createGrantIx, grantPda, grantProgramId, newGrantId } from "./grantTx";

// GRANT_BACKEND=anchor: reads and writes the deployed data_deck_grants program on devnet.
// The player's own signatures (manual grants, kill switch) happen in the browser with grantTx.ts;
// the server signs only as the rule delegate (auto-accept) or the researcher (consume_grant).

export const connection = () => new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");

const toBase58 = (b: Uint8Array) => new PublicKey(b).toBase58();

export function keypairFromEnv(name: string): Keypair {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is not set`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

/** Joins the on-chain grant with its off-chain bounty/card; unknown grants get empty strings. */
export function withContext(grant: OnChainGrant): GrantView {
  const ctx = grantContext(grant.grantId);
  return { ...grant, bountyId: ctx?.bountyId ?? "", cardId: ctx?.cardId ?? "" };
}

const grantFilter = { dataSize: GRANT_LAYOUT.size };
const discFilter = { memcmp: { offset: 0, bytes: Buffer.from(DISC.grantAccount).toString("base64"), encoding: "base64" as const } };

/** Reads one Grant by ID. One getAccountInfo when the player is known, else a getProgramAccounts filtered on grant_id. */
export async function readOnChainGrant(grantId: string, conn = connection()): Promise<OnChainGrant | null> {
  if (!/^[0-9a-f]{32}$/.test(grantId)) return null;
  const programId = grantProgramId();
  const player = grantContext(grantId)?.player;
  let data: Uint8Array | undefined;
  if (player) {
    data = (await conn.getAccountInfo(grantPda(new PublicKey(player), grantId, programId)))?.data;
  } else {
    const idBytes = Buffer.from(hexToBytes(grantId, 16)).toString("base64");
    const [hit] = await conn.getProgramAccounts(programId, {
      filters: [grantFilter, discFilter, { memcmp: { offset: GRANT_LAYOUT.grantId, bytes: idBytes, encoding: "base64" } }],
    });
    data = hit?.account.data;
  }
  return data ? decodeGrant(data, toBase58) : null;
}

export const anchorBackend: GrantBackend = {
  async readGrant(grantId) {
    const grant = await readOnChainGrant(grantId);
    return grant && withContext(grant);
  },

  async listGrants(player) {
    const accounts = await connection().getProgramAccounts(grantProgramId(), {
      filters: [grantFilter, discFilter, { memcmp: { offset: GRANT_LAYOUT.player, bytes: new PublicKey(player).toBase58() } }],
    });
    return accounts.map((a) => decodeGrant(a.account.data, toBase58)).filter((x) => x !== null).map(withContext);
  },

  // Auto-accept only: the rule delegate key signs. Manual grants are signed by the player's wallet.
  async createGrant({ player, bountyId, cardId, rule }) {
    if (!rule) throw new Error("Manual grants are signed by the player's wallet (grantTx.createGrantIx), not the server");
    const bounty = getBounty(bountyId);
    if (!bounty?.researcherPubkey) throw new Error("Unknown bounty or bounty has no researcher pubkey");
    const delegate = keypairFromEnv("RULE_DELEGATE_SECRET_KEY");
    const grantId = newGrantId();
    const ix = createGrantIx({
      player: new PublicKey(player),
      researcher: new PublicKey(bounty.researcherPubkey),
      grantId,
      bountyHash: saltedHash(bounty.id).hash,
      accessType: bounty.accessType,
      pricePerDay: Math.round(bounty.priceUsdc * 1_000_000),
      delegate: delegate.publicKey,
    });
    const conn = connection();
    await sendAndConfirmTransaction(conn, new Transaction().add(ix), [delegate]);
    rememberGrant(grantId, { player, bountyId, cardId });
    const grant = await readOnChainGrant(grantId, conn);
    if (!grant) throw new Error("Grant not found after create_grant");
    return withContext(grant);
  },

  async revokeAll() {
    throw new Error("The kill switch is signed by the player's wallet (grantTx.killSwitchTx), not the server");
  },

  async consumeGrant(grantId) {
    const grant = await readOnChainGrant(grantId);
    if (!grant) throw new Error("Unknown grant");
    const researcher = keypairFromEnv("RESEARCHER_SECRET_KEY");
    const ix = consumeGrantIx(researcher.publicKey, new PublicKey(grant.player), grantId);
    await sendAndConfirmTransaction(connection(), new Transaction().add(ix), [researcher]);
  },
};
