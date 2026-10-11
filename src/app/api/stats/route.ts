import { NextResponse } from "next/server";
import { groupWeeks } from "@/lib/cards";
import { loadSampleRows } from "@/lib/csv";

// GET /api/stats -> the daily rows behind the cards, grouped by week, for the app's Steps, Sleep and Heart charts.
// Sample data only; the source picker in the app does not change it yet.
export async function GET() {
  const weeks = [...groupWeeks(loadSampleRows()).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, days]) => ({ week, days }));
  return NextResponse.json({ source: "sample", weeks });
}
