// Backup demo in the terminal: lend a card, fetch a key, stop sharing, show the key API refusing, then trace a
// leaked copy of the decrypted batch back to the grant it came from.
import { createDecipheriv } from "node:crypto";
// Usage: npm run dev (in another terminal), then `npm run demo:flow` [BASE_URL defaults to http://localhost:3000]
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PLAYER = process.env.PLAYER ?? "demo-player";
const BOUNTY = "b-trinity-sleep";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  console.log(`${method} ${path} -> ${res.status}`);
  return { status: res.status, json };
}

function expect(ok, message) {
  if (!ok) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
}

await call("POST", "/api/demo/reset");

const { json: bounties } = await call("GET", "/api/bounties");
const { json: deck } = await call("GET", "/api/cards");
const bounty = (bounties.bounties ?? bounties).find((b) => b.id === BOUNTY);
const card = deck.cards.find((c) => c.name === bounty?.cardWanted);
expect(bounty && card, `no ${bounty?.cardWanted ?? BOUNTY} card in the sample deck`);

console.log(`\n1. Lend "${card.name}" to ${bounty.researcher}`);
const grant = await call("POST", "/api/grants", { player: PLAYER, bountyId: bounty.id, cardId: card.id });
expect(grant.status === 201, "grant was not created");
const grantId = grant.json.grantId;

console.log("\n2. Researcher fetches the key for batch 0 while the grant is active");
const key = await call("GET", `/api/keys/${grantId}/0`);
expect(key.status === 200, "key was not released");
const { json: batches } = await call("GET", `/api/batches/${grantId}`);
const b = batches[0];
const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key.json.key, "base64"), Buffer.from(b.iv, "base64"));
decipher.setAuthTag(Buffer.from(b.authTag, "base64"));
const rows = JSON.parse(Buffer.concat([decipher.update(Buffer.from(b.ciphertext, "base64")), decipher.final()]).toString());
console.log(`   decrypted batch 0: ${JSON.stringify(rows[0])}`);

console.log("\n3. Player taps Stop sharing");
const revoke = await call("POST", "/api/revoke", { player: PLAYER });
console.log(`   revoked ${revoke.json.revoked?.length ?? 0} grant(s), destroyed ${revoke.json.keysDestroyed} unreleased key(s)`);

console.log("\n4. Researcher asks for the next batch key");
const denied = await call("GET", `/api/keys/${grantId}/1`);
expect(denied.status === 403, "key API should refuse after stop sharing");
console.log(`   refused: ${denied.json.error}`);

console.log("\n5. A copy of batch 0 turns up somewhere; the player pastes it into the trace API");
const traced = await call("POST", "/api/trace", { player: PLAYER, text: JSON.stringify(rows) });
const hit = traced.json.matches?.[0];
expect(hit?.grantId === grantId, "trace did not find the grant");
console.log(`   came from grant ${hit.grantId.slice(0, 8)}… (${hit.researcher}), batch ${hit.batch}, opened ${new Date(hit.openedAt * 1000).toISOString()}`);

console.log(`\nOK. Erasure request logged; see ${BASE}/privacy?player=${PLAYER}`);
