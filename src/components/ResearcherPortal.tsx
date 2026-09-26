"use client";

import { useEffect, useState } from "react";
import type { EncryptedBatch } from "@/lib/types";
import { DEMO_DAY_SECONDS } from "@/lib/types";

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function decrypt(batch: EncryptedBatch, keyB64: string): Promise<unknown[]> {
  const key = await crypto.subtle.importKey("raw", b64(keyB64), "AES-GCM", false, ["decrypt"]);
  // WebCrypto expects the GCM tag appended to the ciphertext.
  const data = new Uint8Array([...b64(batch.ciphertext), ...b64(batch.authTag)]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(batch.iv) }, key, data);
  return JSON.parse(new TextDecoder().decode(plain));
}

type Row = { batch: number; state: "decrypted"; rows: unknown[] } | { batch: number; state: "locked"; reason: string };

// Researcher side of the demo (FR-8): batches arrive, decrypt, then lock after the kill switch.
export function ResearcherPortal({ initialGrantId }: { initialGrantId: string }) {
  const [grantId, setGrantId] = useState(initialGrantId);
  const [results, setResults] = useState<Map<number, Row>>(new Map());
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (!grantId) return;
    let stop = false;
    const seen = new Map<number, Row>();

    async function poll() {
      const res = await fetch(`/api/batches/${grantId}`);
      if (!res.ok) return;
      const batches: EncryptedBatch[] = await res.json();
      for (const b of batches) {
        if (seen.get(b.batch)?.state === "decrypted") continue;
        const k = await fetch(`/api/keys/${grantId}/${b.batch}`);
        if (k.status === 403) {
          seen.set(b.batch, { batch: b.batch, state: "locked", reason: "Access revoked by participant" });
          setRevoked(true);
          break;
        }
        if (!k.ok) continue;
        const { key } = await k.json();
        seen.set(b.batch, { batch: b.batch, state: "decrypted", rows: await decrypt(b, key) });
      }
      if (!stop) setResults(new Map(seen));
    }

    poll();
    const id = setInterval(poll, DEMO_DAY_SECONDS * 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [grantId]);

  return (
    <main>
      <h1>Researcher portal</h1>
      <p className="muted">Polls every {DEMO_DAY_SECONDS} s (one demo day). Each batch needs its own key.</p>
      <input
        placeholder="Grant ID"
        value={grantId}
        onChange={(e) => setGrantId(e.target.value.trim())}
        style={{ width: "100%", maxWidth: 420, padding: 8 }}
      />
      {revoked && <p className="card locked">Access revoked by participant. No further batch keys will be released.</p>}
      <div className="grid" style={{ marginTop: 16 }}>
        {[...results.values()].map((r) => (
          <div key={r.batch} className={`card ${r.state === "locked" ? "locked" : ""}`}>
            <strong>Batch {r.batch + 1}</strong>
            {r.state === "locked" ? <p>{r.reason}</p> : <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(r.rows, null, 1)}</pre>}
          </div>
        ))}
      </div>
    </main>
  );
}
