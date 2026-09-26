import { NextResponse } from "next/server";
import { resetDemoState } from "@/lib/demoReset";

// POST /api/demo/reset -> clears grants, batch keys, rules, erasure log and payouts held in server memory.
// Demo-only: refused on a production build unless ALLOW_DEMO_RESET=1.
export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_RESET !== "1") {
    return NextResponse.json({ error: "Demo reset is disabled" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, ...resetDemoState() });
}
