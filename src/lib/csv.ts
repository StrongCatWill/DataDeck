import { readFileSync } from "node:fs";
import path from "node:path";
import type { DailyRow } from "./types";

// Sample data only (NFR-6). Server-side use.
export function loadSampleRows(): DailyRow[] {
  const raw = readFileSync(path.join(process.cwd(), "data", "sample.csv"), "utf8").trim();
  const [header, ...lines] = raw.split("\n");
  const cols = header.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    const row: Record<string, string | number> = {};
    cols.forEach((c, i) => {
      const v = cells[i];
      row[c] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    });
    return row as unknown as DailyRow;
  });
}
