import { createHash, randomBytes } from "node:crypto";

export const randomGrantId = () => randomBytes(16).toString("hex");

/** Salted so the on-chain hash cannot be matched against a public bounty list (risk 3). */
export function saltedHash(value: string, salt = randomBytes(16).toString("hex")) {
  return { hash: createHash("sha256").update(salt).update(value).digest("hex"), salt };
}

export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");
