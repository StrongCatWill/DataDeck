// Demo-only: clears every in-memory store so the next run starts clean without restarting the server.
// Each store lives on globalThis (see vault.ts, grants.ts, rulesStore.ts, ...), so they are cleared in place.

interface Stores {
  __dataDeckVault?: { batches: Map<unknown, unknown>; keys: Map<unknown, Map<unknown, { key: Buffer }>> };
  __dataDeckGrants?: Map<unknown, unknown>;
  __dataDeckErasures?: unknown[];
  __dataDeckRules?: { rules: Map<unknown, unknown>; notices: unknown[]; accepted: Set<unknown> };
  __dataDeckGrantIndex?: Map<unknown, unknown>;
  __dataDeckPayouts?: Map<unknown, unknown>;
  __dataDeckExplain?: Map<unknown, unknown>;
}

export function resetDemoState(): { grants: number; keysDestroyed: number } {
  const g = globalThis as unknown as Stores;
  const grants = g.__dataDeckGrants?.size ?? 0;
  let keysDestroyed = 0;

  const vault = g.__dataDeckVault;
  if (vault) {
    for (const keys of vault.keys.values()) {
      for (const k of keys.values()) {
        k.key.fill(0);
        keysDestroyed++;
      }
    }
    vault.keys.clear();
    vault.batches.clear();
  }
  g.__dataDeckGrants?.clear();
  if (g.__dataDeckErasures) g.__dataDeckErasures.length = 0;
  if (g.__dataDeckRules) {
    g.__dataDeckRules.rules.clear();
    g.__dataDeckRules.notices.length = 0;
    g.__dataDeckRules.accepted.clear();
  }
  g.__dataDeckGrantIndex?.clear();
  g.__dataDeckPayouts?.clear();
  g.__dataDeckExplain?.clear();

  return { grants, keysDestroyed };
}
