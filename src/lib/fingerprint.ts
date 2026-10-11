import { randomBytes } from "node:crypto";

// Leak tracing: every row a researcher decrypts carries a trace_id unique to its grant and batch, so a copy found
// later (a leaked file, a training set) can be traced back to the grant it came from. The ID is random and maps to
// the grant only in server memory, so it reveals nothing on its own. A visible tag can be stripped; it is a
// deterrent and an audit hook, not tamper-proof watermarking.

export interface TraceEntry {
  grantId: string;
  batch: number;
}

const g = globalThis as unknown as { __dataDeckFingerprints?: Map<string, TraceEntry> };
const index = (g.__dataDeckFingerprints ??= new Map());

const TRACE_ID = /dd-[0-9a-f]{16}/g;

/** Adds the batch's trace_id to every row object. Called by the vault before a batch is encrypted. */
export function fingerprintRows(grantId: string, batch: number, rows: unknown[]): unknown[] {
  const traceId = `dd-${randomBytes(8).toString("hex")}`;
  index.set(traceId, { grantId, batch });
  return rows.map((r) => (r && typeof r === "object" && !Array.isArray(r) ? { ...r, trace_id: traceId } : r));
}

/** Every known trace_id found anywhere in the text (a pasted row, CSV or JSON), in order of appearance. */
export function traceText(text: string): (TraceEntry & { traceId: string })[] {
  const ids = [...new Set(text.match(TRACE_ID) ?? [])];
  return ids.flatMap((traceId) => {
    const hit = index.get(traceId);
    return hit ? [{ traceId, ...hit }] : [];
  });
}
