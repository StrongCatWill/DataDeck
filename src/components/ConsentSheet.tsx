"use client";

import { useEffect, useState } from "react";
import type { Bounty } from "@/lib/types";

// Layered notice: labelled AI summary on top, full notice below, explicit Confirm (FR-3).
export function ConsentSheet({ bounty, onCancel, onConfirm }: { bounty: Bounty; onCancel: () => void; onConfirm: () => void }) {
  const [summary, setSummary] = useState<{ label: string; summary: string } | null>(null);
  useEffect(() => {
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bountyId: bounty.id }),
    })
      .then((r) => r.json())
      .then(setSummary);
  }, [bounty.id]);

  return (
    <div className="sheet">
      <div>
        <h3>Lend {bounty.cardWanted} to {bounty.researcher}</h3>
        <div className="ai">
          <div className="badge">{summary?.label ?? "AI-generated summary"}</div>
          <p>{summary?.summary ?? "Loading…"}</p>
        </div>
        <h4>Full notice</h4>
        <p className="muted">{bounty.fullNotice}</p>
        <p className="muted">
          Access: {bounty.accessWindowLabel}. Retention: {bounty.retention}. Your data is pseudonymised: your name is removed, but daily data like this could still be linked back to you.
        </p>
        <button onClick={onConfirm}>Confirm and lend</button>{" "}
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
