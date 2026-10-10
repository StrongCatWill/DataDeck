import { createDecipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GET as getKey } from "@/app/api/keys/[grantId]/[batch]/route";
import { POST as trace } from "@/app/api/trace/route";
import { grantBackend } from "../grants";
import { traceText } from "../fingerprint";
import { getBatches, sealBatches } from "../vault";

const post = (body: unknown) => trace(new Request("http://test", { method: "POST", body: JSON.stringify(body) }));

// Lends a card and returns batch 1 exactly as the researcher decrypts it.
async function leakedBatch(player: string) {
  const grant = await grantBackend().createGrant({ player, bountyId: "b-trinity-sleep", cardId: "card-1" });
  sealBatches(grant.grantId, [[{ steps: 1 }], [{ steps: 2 }, { steps: 3 }]]);
  const res = await getKey(new Request("http://test"), { params: Promise.resolve({ grantId: grant.grantId, batch: "1" }) });
  const { key } = await res.json();
  const b = getBatches(grant.grantId)[1];
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), Buffer.from(b.iv, "base64"));
  decipher.setAuthTag(Buffer.from(b.authTag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(b.ciphertext, "base64")), decipher.final()]).toString();
  return { grant, rows: JSON.parse(plain) as { trace_id: string }[] };
}

describe("leak tracing", () => {
  it("tags every row of a batch with the same trace_id, different per batch and grant", async () => {
    const a = await leakedBatch("p-tag-a");
    const b = await leakedBatch("p-tag-b");
    expect(a.rows[0].trace_id).toBe(a.rows[1].trace_id);
    expect(a.rows[0].trace_id).not.toBe(b.rows[0].trace_id);
    expect(traceText(JSON.stringify(a.rows))).toEqual([{ traceId: a.rows[0].trace_id, grantId: a.grant.grantId, batch: 1 }]);
  });

  it("traces a pasted CSV line back to the player's grant, researcher and when it was opened", async () => {
    const { grant, rows } = await leakedBatch("p-trace");
    const csv = `steps,trace_id\n2,${rows[0].trace_id}`;
    const res = await post({ player: "p-trace", text: csv });
    expect(res.status).toBe(200);
    const { matches } = await res.json();
    expect(matches).toEqual([
      expect.objectContaining({ grantId: grant.grantId, batch: 1, researcher: grant.researcher, openedAt: expect.any(Number) }),
    ]);
  });

  it("never reports another player's grant, and ignores unknown IDs", async () => {
    const { rows } = await leakedBatch("p-owner");
    expect((await (await post({ player: "p-stranger", text: rows[0].trace_id })).json()).matches).toEqual([]);
    expect((await (await post({ player: "p-owner", text: "dd-0000000000000000" })).json()).matches).toEqual([]);
  });

  it("returns 400 without player or text", async () => {
    expect((await post({ text: "x" })).status).toBe(400);
    expect((await post({ player: "p" })).status).toBe(400);
  });
});
