import { explorerUrl, listAccess } from "@/lib/accessLog";
import { effectiveStatus, erasureLog, grantBackend } from "@/lib/grants";
import { USDC_DECIMALS, listPayouts } from "@/lib/solana/payout";

// /privacy?player=<pubkey> -> the player's grants, every released batch key with its payout receipt, and every
// erasure request logged after "Stop sharing".
// Server component: reads the grant backend and the in-memory erasure log directly.
export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const { player = "demo-player" } = await searchParams;
  const grants = await grantBackend().listGrants(player);
  const erasures = erasureLog.filter((e) => grants.some((g) => g.grantId === e.grantId));
  const time = (unix: number | null) => (unix ? new Date(unix * 1000).toLocaleString() : "-");
  const accesses = listAccess(player);
  const payouts = await listPayouts({ player });
  const usdc = (base: number) => (base / 10 ** USDC_DECIMALS).toFixed(2);
  const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1>Privacy record</h1>
      <p>Player: <code>{player}</code></p>

      <h2>Access grants</h2>
      {grants.length === 0 ? (
        <p>No grants yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Grant</th><th>Bounty</th><th>Access</th><th>Status</th><th>Expires</th><th>Stopped</th></tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.grantId}>
                <td><code>{g.grantId.slice(0, 8)}…</code></td>
                <td>{g.bountyId}</td>
                <td>{g.accessType}{g.auto ? " (auto-accepted)" : ""}</td>
                <td>{effectiveStatus(g)}</td>
                <td>{time(g.expiresAt)}</td>
                <td>{time(g.revokedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Access and payment receipts</h2>
      <p>
        Every time a researcher received a key for one of your batches. Total paid to you: <strong>{usdc(totalPaid)} USDC</strong>
      </p>
      {accesses.length === 0 ? (
        <p>No batches opened yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Opened</th><th>Grant</th><th>Batch</th><th>Researcher</th><th>Paid</th><th>Payout</th></tr>
          </thead>
          <tbody>
            {accesses.map((a, i) => {
              // A repeated key request (or a later key on a one-off grant) reuses the first payout: show the amount once.
              const repeat = a.payoutSig !== null && accesses.some((x, j) => j > i && x.payoutSig === a.payoutSig);
              const payout = repeat ? undefined : payouts.find((p) => p.signature === a.payoutSig);
              const link = a.payoutSig ? explorerUrl(a.payoutSig) : null;
              return (
                <tr key={i}>
                  <td>{time(a.releasedAt)}</td>
                  <td><code>{a.grantId.slice(0, 8)}…</code></td>
                  <td>{a.batch}</td>
                  <td>{a.researcher}</td>
                  <td>{payout ? `${usdc(payout.amount)} USDC` : repeat ? "already paid" : "-"}</td>
                  <td>
                    {!a.payoutSig ? "pending retry" : link ? <a href={link}>View on Explorer</a> : <code>simulated</code>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>Erasure requests</h2>
      <p>
        When you stop sharing, keys not yet released are destroyed and future access ends. Batches the researcher already
        decrypted cannot be recalled, so we log an erasure request to them.
      </p>
      {erasures.length === 0 ? (
        <p>No erasure requests yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Grant</th><th>Researcher</th><th>Revoke tx</th><th>Requested</th></tr>
          </thead>
          <tbody>
            {erasures.map((e) => (
              <tr key={e.grantId}>
                <td><code>{e.grantId.slice(0, 8)}…</code></td>
                <td>{e.researcher}</td>
                <td><code>{e.revokeTx}</code></td>
                <td>{new Date(e.requestedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
