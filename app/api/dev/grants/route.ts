import { randomBytes } from "node:crypto";
import { devRoutesDisabled, devRoutesEnabled } from "@/lib/devRoutes";
import { getMockGrantService } from "@/lib/grants";
import { loadSampleDays } from "@/lib/sampleData";
import type { AccessType, Grant } from "@/lib/types";
import { DEMO_DAY_MS, getVault } from "@/lib/vault";

const ACCESS_TYPES: AccessType[] = ["snapshot24h", "stream30d", "singleQuery"];
const STREAM_DAYS = 30;

/**
 * Creates a mock grant and seals one encrypted batch per sample day.
 * Body (optional): { accessType?: AccessType, ttlSec?: number }. Default: 30-day stream (300 s demo time).
 */
export async function POST(request: Request) {
  if (!devRoutesEnabled()) return devRoutesDisabled();

  const body = (await request.json().catch(() => ({}))) as { accessType?: string; ttlSec?: number };
  const accessType = (body.accessType ?? "stream30d") as AccessType;
  if (!ACCESS_TYPES.includes(accessType)) {
    return Response.json({ error: "invalid_access_type" }, { status: 400 });
  }
  const ttlSec = body.ttlSec ?? (STREAM_DAYS * DEMO_DAY_MS) / 1000;

  const nowMs = Date.now();
  const grant: Grant = {
    grantId: randomBytes(16).toString("hex"),
    status: "active",
    accessType,
    expiresAt: Math.floor(nowMs / 1000) + ttlSec,
    pricePerDay: 600_000,
  };
  getMockGrantService().createGrant(grant);
  const batches = getVault().seal(grant.grantId, loadSampleDays().map((day) => JSON.stringify(day)), nowMs);

  return Response.json({ grant, batchCount: batches.length }, { status: 201 });
}
