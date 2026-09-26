import { describe, expect, it, vi } from "vitest";
import { BOUNTIES } from "../bounties";
import { findBannedCopy } from "../copy";
import { ExplainError, summariseNotice, type ExplainClient } from "../explain";

function fakeClient(response: object) {
  const create = vi.fn().mockResolvedValue(response);
  return { client: { beta: { messages: { create } } } as unknown as ExplainClient, create };
}
const reply = (text: string, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "text", text }] });

describe("summariseNotice", () => {
  it("sends the notice to Claude and returns the trimmed text", async () => {
    const { client, create } = fakeClient(reply("  You lend sleep data.  "));
    expect(await summariseNotice(client, "NOTICE")).toBe("You lend sleep data.");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ messages: [{ role: "user", content: "NOTICE" }] }));
  });

  it("rejects refusals, empty replies and banned wording", async () => {
    await expect(summariseNotice(fakeClient(reply("", "refusal")).client, "N")).rejects.toThrow(ExplainError);
    await expect(summariseNotice(fakeClient(reply("  ")).client, "N")).rejects.toThrow(/empty/);
    await expect(summariseNotice(fakeClient(reply("It is anonymous.")).client, "N")).rejects.toThrow(/banned/);
  });
});

describe("copy (NFR-4)", () => {
  it("flags banned wording and allows the approved words", () => {
    for (const bad of ["We sell data", "sold", "anonymised", "Anonymous", "deleted forever"]) {
      expect(findBannedCopy(bad)).not.toBeNull();
    }
    expect(findBannedCopy("You lend pseudonymised data and can stop sharing.")).toBeNull();
  });

  it("every full notice is written, free of banned wording, and says what cannot be recalled", () => {
    for (const b of BOUNTIES) {
      expect(b.fullNotice).not.toMatch(/TODO/);
      expect(findBannedCopy(b.fullNotice)).toBeNull();
      expect(b.fullNotice).toContain("cannot be recalled");
      expect(b.fullNotice.toLowerCase()).toContain(b.retention.split(" ")[0].toLowerCase());
    }
  });
});
