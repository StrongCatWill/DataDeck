import { BOUNTIES, formatPrice } from "@/lib/bounties";

/** The bounty board (FR-2). */
export async function GET() {
  return Response.json({ bounties: BOUNTIES.map((b) => ({ ...b, priceText: formatPrice(b.price) })) });
}
