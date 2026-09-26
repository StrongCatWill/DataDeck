import { buildDeck } from "@/lib/cards";
import { loadSampleDays } from "@/lib/sampleData";

/** Weekly card packs generated from the sample CSV. */
export async function GET() {
  return Response.json({ packs: buildDeck(loadSampleDays()) });
}
