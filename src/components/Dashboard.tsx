"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import type { Bounty, Card, GrantView } from "@/lib/types";
import { WalletButton } from "./WalletButton";

const ORG_LABEL: Record<Bounty["orgType"], string> = {
  non_profit_university: "Non-profit university",
  non_profit: "Non-profit",
  commercial: "Commercial",
};

export function Dashboard({ cards, bounties }: { cards: Card[]; bounties: Bounty[] }) {
  const { publicKey } = useWallet();
  const player = publicKey?.toBase58() ?? "demo-player";
  const [grants, setGrants] = useState<GrantView[]>([]);
  const [consentFor, setConsentFor] = useState<Bounty | null>(null);
  const [killResult, setKillResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/grants?player=${player}`);
    if (res.ok) setGrants(await res.json());
  }, [player]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = grants.filter((g) => g.status === "Active" && g.expiresAt * 1000 > Date.now());
  const cardFor = (b: Bounty) => cards.find((c) => c.name === b.cardWanted);

  async function stopSharing() {
    const res = await fetch("/api/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ player }),
    });
    const r = await res.json();
    setKillResult(
      `Stopped ${r.revoked.length} grant(s) in tx ${r.tx}. ${r.keysDestroyed} undelivered batch keys destroyed. ` +
        `An erasure request was logged to each researcher.`,
    );
    refresh();
  }

  return (
    <main>
      <header>
        <h1>Data Deck</h1>
        <WalletButton />
      </header>
      <p className="muted">Devnet demo with sample data. Lend data by the day and keep the off switch.</p>

      <h2>Your deck</h2>
      {/* TODO(role B): pack-opening animation, cosmetic levels, set completion. */}
      <div className="grid">
        {cards.map((c) => {
          const lending = active.find((g) => g.cardId === c.id);
          return (
            <div className="card" key={c.id}>
              <strong>{c.name}</strong> <span className="badge">{c.rarity}</span>
              {lending && <span className="badge">lending</span>}
              <div className="muted">Week {c.week} · Level {c.level}</div>
              <p className="muted">
                <b>Why this card?</b> {c.whyThisCard}
              </p>
            </div>
          );
        })}
      </div>

      <h2>Bounty board</h2>
      <div className="grid">
        {bounties.map((b) => (
          <div className="card" key={b.id}>
            <strong>{b.researcher}</strong>
            <div className="muted">
              {ORG_LABEL[b.orgType]} · ethics ref: {b.ethicsRef ?? "none"}
            </div>
            <table>
              <tbody>
                <tr><th>Wants</th><td>{b.cardWanted}{b.weeksWanted > 1 ? `, ${b.weeksWanted} weeks` : ""}</td></tr>
                <tr><th>Access</th><td>{b.accessWindowLabel}</td></tr>
                <tr><th>Retention</th><td>{b.retention}</td></tr>
                <tr><th>Pays</th><td>{b.priceUsdc} USDC {b.priceUnit === "per_day" ? "per day" : "once"}</td></tr>
              </tbody>
            </table>
            <p>
              <button disabled={!cardFor(b)} onClick={() => setConsentFor(b)}>
                {cardFor(b) ? "Review and lend" : "Card not in deck"}
              </button>
            </p>
          </div>
        ))}
      </div>

      <h2>Active grants</h2>
      {active.length === 0 ? (
        <p className="muted">Nothing is being shared.</p>
      ) : (
        <ul>
          {active.map((g) => (
            <li key={g.grantId}>
              <code>{g.grantId.slice(0, 8)}…</code> {g.accessType} · ends{" "}
              {new Date(g.expiresAt * 1000).toLocaleTimeString()} {g.auto && <span className="badge">auto-accepted</span>}{" "}
              <a href={`/researcher?grant=${g.grantId}`} target="_blank">researcher view</a>
            </li>
          ))}
        </ul>
      )}

      <h2>Stop sharing</h2>
      <div className="card">
        <p>
          Stops every future batch key and payment for your grants and turns off auto-accept. Undelivered keys are
          destroyed, so stored copies stay unreadable. Batches a researcher already opened cannot be recalled; we send
          them an erasure request with the revoke transaction as proof of time.
        </p>
        <button className="danger" onClick={stopSharing}>Stop sharing</button>
        {killResult && <p className="muted">{killResult}</p>}
      </div>

      <h2>Privacy panel</h2>
      {/* TODO(role B): side-by-side "what the public chain sees" vs "what the app sees" (FR-11). */}
      <p className="muted">
        The public chain sees grant IDs, salted hashes, timestamps, prices and statuses. Card names, health values and
        study topics stay in the app.
      </p>

      {consentFor && (
        <ConsentSheet
          bounty={consentFor}
          onCancel={() => setConsentFor(null)}
          onConfirm={async () => {
            await fetch("/api/grants", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ player, bountyId: consentFor.id, cardId: cardFor(consentFor)!.id }),
            });
            setConsentFor(null);
            refresh();
          }}
        />
      )}
    </main>
  );
}

// Layered notice: labelled AI summary on top, full notice below, explicit Confirm (FR-3).
function ConsentSheet({ bounty, onCancel, onConfirm }: { bounty: Bounty; onCancel: () => void; onConfirm: () => void }) {
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
