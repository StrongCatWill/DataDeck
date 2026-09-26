// Server-side index: grantId -> the off-chain context the chain must not hold (bounty, card) and the
// player, which the Memo backend needs to find a grant. Filled when the app records a grant.

export interface GrantContext {
  player: string;
  bountyId: string;
  cardId: string;
}

const g = globalThis as unknown as { __dataDeckGrantIndex?: Map<string, GrantContext> };
const index = (g.__dataDeckGrantIndex ??= new Map());

export const rememberGrant = (grantId: string, ctx: GrantContext) => void index.set(grantId, ctx);
export const grantContext = (grantId: string) => index.get(grantId);
