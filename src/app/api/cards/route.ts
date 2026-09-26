import { NextResponse } from "next/server";
import { generateCards } from "@/lib/cards";
import { loadSampleRows } from "@/lib/csv";

// GET /api/cards -> the player's deck from the sample data, with "Why this card?" and cosmetic levels (FR-1).
export async function GET() {
  return NextResponse.json({ cards: generateCards(loadSampleRows()) });
}
