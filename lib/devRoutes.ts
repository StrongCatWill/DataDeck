/** Dev-only routes (mock grant create/revoke) run locally, or on a deploy with ENABLE_DEV_ROUTES=true. */
export function devRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_ROUTES === "true";
}

export const devRoutesDisabled = () => Response.json({ error: "not_found" }, { status: 404 });
