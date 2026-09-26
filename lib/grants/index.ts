import type { GrantService } from "./GrantService";
import { MockGrantService } from "./MockGrantService";

// Kept on globalThis so `next dev` hot reloads don't wipe the in-memory grants.
const store = globalThis as unknown as { grantService?: MockGrantService };

/** Mock only for now; the Anchor or Memo implementation gets selected here later. */
export function getGrantService(): GrantService {
  return getMockGrantService();
}

/** Direct access to the mock's create/revoke, for dev and tests. */
export function getMockGrantService(): MockGrantService {
  store.grantService ??= new MockGrantService();
  return store.grantService;
}
