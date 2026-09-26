import { effectiveStatus, erasureLog, grantBackend } from "@/lib/grants";

// /privacy?player=<pubkey> -> the player's grants and every erasure request logged after "Stop sharing".
// Server component: reads the grant backend and the in-memory erasure log directly.
export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const { player = "demo-player" } = await searchParams;
  const grants = await grantBackend().listGrants(player);
  const erasures = erasureLog.filter((e) => grants.some((g) => g.grantId === e.grantId));
  const time = (unix: number | null) => (unix ? new Date(unix * 1000).toLocaleString() : "-");

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
