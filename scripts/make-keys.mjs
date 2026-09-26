// Creates the two devnet server keypairs (researcher, rule delegate) and writes them into .env.local.
// Run once on the machine that runs the app: `npm run keys`. Secrets never leave that machine.
// Existing keys are kept, so re-running is safe. Devnet only (NFR-6).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

const FILE = ".env.local";
let env = existsSync(FILE) ? readFileSync(FILE, "utf8") : readFileSync(".env.example", "utf8");

const get = (name) => env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1].trim() ?? "";
const set = (name, value) => {
  const line = `${name}=${value}`;
  env = new RegExp(`^${name}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${name}=.*$`, "m"), line) : `${env.trimEnd()}\n${line}\n`;
};

function ensure(secretName, publicName) {
  const existing = get(secretName);
  const kp = existing ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(existing))) : Keypair.generate();
  if (!existing) set(secretName, JSON.stringify([...kp.secretKey]));
  set(publicName, kp.publicKey.toBase58());
  return { pubkey: kp.publicKey.toBase58(), created: !existing };
}

const researcher = ensure("RESEARCHER_SECRET_KEY", "NEXT_PUBLIC_DEMO_RESEARCHER_PUBKEY");
const delegate = ensure("RULE_DELEGATE_SECRET_KEY", "NEXT_PUBLIC_RULE_DELEGATE_PUBKEY");
writeFileSync(FILE, env);

console.log(`Wrote ${FILE} (never commit it).`);
console.log(`Researcher    ${researcher.pubkey}${researcher.created ? " (new)" : ""}  -> fund with ~0.05 SOL + devnet USDC`);
console.log(`Rule delegate ${delegate.pubkey}${delegate.created ? " (new)" : ""}  -> fund with ~0.05 SOL`);
