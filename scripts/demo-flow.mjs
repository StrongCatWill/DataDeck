// Backup demo in the terminal, told as one story: Sam wears a sleep tracker, lends a week of sleep data to a
// university lab, gets paid per day, stops sharing, and later traces a copy of the data back to the lab's grant.
// Usage: npm run dev (in another terminal), then `npm run demo:flow` [BASE_URL defaults to http://localhost:3000]
// VERBOSE=1 also prints every HTTP call.
import { createDecipheriv } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PLAYER = process.env.PLAYER ?? "demo-player";
const BOUNTY = "b-trinity-sleep";
const VERBOSE = process.env.VERBOSE === "1";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (VERBOSE) console.log(`   ${method} ${path} -> ${res.status}`);
  return { status: res.status, json };
}

function expect(ok, message) {
  if (!ok) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
}

const say = (line = "") => console.log(line);
const step = (n, title) => say(`\n${n}. ${title}`);
const usdc = (n) => `${n.toFixed(2)} USDC`;

await call("POST", "/api/demo/reset");

const { json: bounties } = await call("GET", "/api/bounties");
const { json: deck } = await call("GET", "/api/cards");
const bounty = (bounties.bounties ?? bounties).find((b) => b.id === BOUNTY);
const card = deck.cards.find((c) => c.name === bounty?.cardWanted);
expect(bounty && card, `no ${bounty?.cardWanted ?? BOUNTY} card in the sample deck`);

say("The problem: wearable health data is useful to research, but today you either hand it over for good or not");
say("at all, and you never see who used it. Data Deck lends access instead: time-limited, revocable, paid per day.");
say("Why Solana: every grant and payment is a fast, cheap public receipt anyone can check, with no health data on-chain.");

step(1, `Sam's sleep tracker earned a "${card.name}" card (week ${card.week})`);
say(`   ${bounty.researcher} asks to borrow it: ${bounty.accessWindowLabel}, ${usdc(bounty.priceUsdc)} per day.`);

step(2, `Sam lends the card. Nothing is handed over yet; a grant opens.`);
const grant = await call("POST", "/api/grants", { player: PLAYER, bountyId: bounty.id, cardId: card.id });
expect(grant.status === 201, "grant was not created");
const grantId = grant.json.grantId;
say(`   grant ${grantId.slice(0, 8)}… is Active. Each day's data is encrypted with its own key.`);

step(3, `Day 1: the lab asks for today's key, reads the data, and Sam is paid`);
const key = await call("GET", `/api/keys/${grantId}/0`);
expect(key.status === 200, "key was not released");
const { json: batches } = await call("GET", `/api/batches/${grantId}`);
const b = batches[0];
const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key.json.key, "base64"), Buffer.from(b.iv, "base64"));
decipher.setAuthTag(Buffer.from(b.authTag, "base64"));
const rows = JSON.parse(Buffer.concat([decipher.update(Buffer.from(b.ciphertext, "base64")), decipher.final()]).toString());
say(`   the lab sees: ${JSON.stringify(rows[0])}`);
const { json: paid } = await call("GET", `/api/payouts?player=${encodeURIComponent(PLAYER)}`);
say(`   Sam received ${usdc(paid.totalUsdc ?? 0)} (${paid.mode === "devnet" ? "devnet transfer" : "simulated payout"}, receipt ${key.json.payoutSig ?? "pending"})`);

step(4, "Sam changes their mind and taps Stop sharing");
const revoke = await call("POST", "/api/revoke", { player: PLAYER });
say(`   grant revoked; ${revoke.json.keysDestroyed} keys for future days destroyed. Day 1 cannot be recalled, so the lab gets an erasure request.`);

step(5, "Day 2: the lab asks for the next key");
const denied = await call("GET", `/api/keys/${grantId}/1`);
expect(denied.status === 403, "key API should refuse after stop sharing");
say(`   refused: ${denied.json.error}. No key, no data, no more payments.`);

step(6, "Months later, a copy of Sam's day-1 data turns up in a dataset. Sam pastes it into the trace API");
const traced = await call("POST", "/api/trace", { player: PLAYER, text: JSON.stringify(rows) });
const hit = traced.json.matches?.[0];
expect(hit?.grantId === grantId, "trace did not find the grant");
say(`   it came from grant ${hit.grantId.slice(0, 8)}… (${(bounties.bounties ?? bounties).find((x) => x.id === hit.bountyId)?.researcher ?? hit.researcher}), day ${hit.batch + 1}, first opened ${new Date(hit.openedAt * 1000).toISOString()}`);

say(`\nOK. Sam's receipts, grants and erasure request: ${BASE}/privacy?player=${PLAYER}`);
