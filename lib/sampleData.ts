// Server-only: reads the bundled sample CSV from disk. Do not import from client components.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseHealthCsv, type DayRecord } from "./cards";

export function loadSampleDays(): DayRecord[] {
  return parseHealthCsv(readFileSync(path.join(process.cwd(), "data", "sample-health.csv"), "utf8"));
}
