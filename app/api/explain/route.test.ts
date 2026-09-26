import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/explain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/explain")>()),
  cachedSummary: vi.fn(),
}));

import { cachedSummary } from "@/lib/explain";
import { POST } from "./route";

const post = (body: unknown) => POST(new Request("http://test", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/explain", () => {
  it("returns the labelled summary above the full notice", async () => {
    vi.mocked(cachedSummary).mockResolvedValue("Short summary.");
    const json = await (await post({ bountyId: "trinity-sleep" })).json();
    expect(json.summary).toEqual({ label: "AI-generated summary", text: "Short summary." });
    expect(json.notice).toContain("Trinity Sleep Lab");
  });

  it("still returns the full notice when Claude is unavailable", async () => {
    vi.mocked(cachedSummary).mockImplementation(async () => {
      throw new Error("no API key");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ bountyId: "trinity-sleep" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ summary: null, notice: expect.stringContaining("Trinity Sleep Lab") });
  });

  it("returns 404 for an unknown bounty", async () => {
    expect((await post({ bountyId: "nope" })).status).toBe(404);
    expect((await post({})).status).toBe(404);
  });
});
