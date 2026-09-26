// Erasure requests logged by the kill switch (FR-12, Art. 17(1)(b)). Revoking cannot recall data the
// researcher already decrypted, so the researcher is asked to erase it. In server memory for the demo.

export interface ErasureRequest {
  grantId: string;
  /** Revoke transaction signature, as proof of time; null when revoked in the mock. */
  revokeTx: string | null;
  /** ISO timestamp. */
  requestedAt: string;
  message: string;
}

export class ErasureLog {
  private requests = new Map<string, ErasureRequest>();

  /** Logs one request per grant; later calls return the first. */
  request(grantId: string, revokeTx: string | null, nowMs: number): ErasureRequest {
    const existing = this.requests.get(grantId);
    if (existing) return existing;
    const requestedAt = new Date(nowMs).toISOString();
    const entry = {
      grantId,
      revokeTx,
      requestedAt,
      message:
        `The participant withdrew consent for grant ${grantId} at ${requestedAt}. ` +
        "Please erase any data from this grant that you still hold, unless another legal basis applies (GDPR Art. 17(1)(b)).",
    };
    this.requests.set(grantId, entry);
    return entry;
  }

  get(grantId: string): ErasureRequest | null {
    return this.requests.get(grantId) ?? null;
  }
}

// Kept on globalThis so `next dev` hot reloads don't wipe the log.
const store = globalThis as unknown as { erasureLog?: ErasureLog };

export function getErasureLog(): ErasureLog {
  store.erasureLog ??= new ErasureLog();
  return store.erasureLog;
}
