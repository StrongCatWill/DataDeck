import { describe, expect, it, vi } from "vitest";
import { ExplainError, summariseNotice, type ExplainClient } from "./explain";

function fakeClient(response: object) {
  const create = vi.fn().mockResolvedValue(response);
  return { client: { beta: { messages: { create } } } as unknown as ExplainClient, create };
}
const reply = (text: string, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "text", text }] });

describe("summariseNotice", () => {
  it("sends the notice to claude-opus-5 and returns the text", async () => {
    const { client, create } = fakeClient(reply("  You lend sleep data to Trinity Sleep Lab.  "));
    expect(await summariseNotice(client, "NOTICE")).toBe("You lend sleep data to Trinity Sleep Lab.");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-opus-5", messages: [{ role: "user", content: "NOTICE" }] }),
    );
  });

  it("rejects a refusal", async () => {
    await expect(summariseNotice(fakeClient(reply("", "refusal")).client, "N")).rejects.toThrow(ExplainError);
  });

  it("rejects an empty summary", async () => {
    await expect(summariseNotice(fakeClient(reply("   ")).client, "N")).rejects.toThrow(/empty/);
  });

  it("rejects a summary with banned wording", async () => {
    await expect(summariseNotice(fakeClient(reply("Your data is anonymous.")).client, "N")).rejects.toThrow(/banned/);
  });
});
