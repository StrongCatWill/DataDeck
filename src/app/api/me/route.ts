import { NextResponse } from "next/server";
import { POST as stopSharing } from "@/app/api/revoke/route";
import {
  ProfileError,
  cashOut,
  completeQuest,
  deleteProfile,
  getProfile,
  logSleep,
  notify,
  openPack,
  readAllNotifications,
  setDetails,
  setGoals,
  setSettings,
  setSources,
  setTolerance,
  signIn,
  signOut,
  verifyAge,
  view,
} from "@/lib/profile";
import { USDC_DECIMALS, listPayouts } from "@/lib/solana/payout";

// /api/me: the player's app account. Like a Spring controller with one command endpoint:
//   GET    /api/me?player=...              -> { profile } (null before sign-in)
//   POST   /api/me { player, action, ... } -> runs one action, returns { profile, ...result }
//   DELETE /api/me?player=...              -> stops every loan (kill switch), then deletes the account
export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  const p = getProfile(player);
  return NextResponse.json({ profile: p && view(p) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { player, action } = body as { player?: string; action?: string };
  if (typeof player !== "string" || !player || typeof action !== "string") {
    return NextResponse.json({ error: "player and action required" }, { status: 400 });
  }
  try {
    const result = await run(player, action, body);
    const p = getProfile(player);
    return NextResponse.json({ ...result, profile: p && view(p) });
  } catch (e) {
    if (e instanceof ProfileError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

async function run(player: string, action: string, b: Record<string, any>): Promise<Record<string, unknown>> {
  switch (action) {
    case "signIn":
      signIn(player, String(b.provider ?? "email"), b.name);
      return {};
    case "signOut":
      signOut(player);
      return {};
    case "age":
      verifyAge(player, Number(b.birthYear));
      return {};
    case "sources":
      setSources(player, b.sources ?? {});
      return {};
    case "goals":
      setGoals(player, b.goals ?? {});
      return {};
    case "settings":
      setSettings(player, b.settings ?? {});
      return {};
    case "tolerance":
      setTolerance(player, b.level);
      return {};
    case "details":
      setDetails(player, b);
      return {};
    case "quest": {
      const { xp, levelsGained } = completeQuest(player, b.quest);
      return { xp, levelsGained };
    }
    case "pack": {
      const { xp, levelsGained } = openPack(player, Number(b.week));
      return { xp, levelsGained };
    }
    case "sleep": {
      const { xp, levelsGained, hours } = logSleep(player, Number(b.start), Number(b.end));
      return { xp, levelsGained, hours };
    }
    case "notify":
      return { notification: notify(player, { icon: String(b.icon ?? "bell"), title: String(b.title ?? ""), body: String(b.body ?? ""), act: b.act ?? null }) };
    case "readAll":
      readAllNotifications(player);
      return {};
    case "cashOut": {
      const paid = (await listPayouts({ player })).reduce((sum, p) => sum + p.amount, 0) / 10 ** USDC_DECIMALS;
      return { cashOut: cashOut(player, Number(b.amountUsdc), b.destination, paid) };
    }
    default:
      throw new ProfileError(`Unknown action ${action}`);
  }
}

export async function DELETE(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
  // Stop sharing first: every active loan is revoked, unreleased keys destroyed and erasure requests logged.
  const stop = await stopSharing(new Request("http://internal/api/revoke", { method: "POST", body: JSON.stringify({ player }) }));
  const stopped = await stop.json();
  return NextResponse.json({ deleted: deleteProfile(player), stopped });
}
