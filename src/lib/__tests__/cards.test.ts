import { describe, expect, it } from "vitest";
import { generateCards } from "../cards";
import { loadSampleRows } from "../csv";
import type { DailyRow } from "../types";

const plain: DailyRow = {
  week: 1, day: 1, date: "2026-01-01", sleep_hours: 7, deep_sleep_min: 80, bedtime: "23:00",
  wake_time: "07:30", steps: 5000, resting_hr: 65, active_min: 20,
};
const week = (patch: Partial<DailyRow> = {}, overrides: Partial<DailyRow>[] = []) =>
  Array.from({ length: 7 }, (_, i) => ({ ...plain, day: i + 1, ...patch, ...overrides[i] }));
const names = (rows: DailyRow[]) => generateCards(rows).map((c) => c.name);

describe("generateCards (v1 rules)", () => {
  it("earns nothing for a plain week", () => {
    expect(names(week())).toEqual([]);
  });

  it("Early Bird: awake strictly before 7:00 on 5+ days", () => {
    const early = { wake_time: "06:59" };
    expect(names(week({}, [early, early, early, early, { wake_time: "07:00" }]))).toEqual([]);
    expect(names(week({}, [early, early, early, early, early]))).toEqual(["Early Bird"]);
  });

  it("Step Starter at 50,000 and Marathon Week at 100,000 steps", () => {
    expect(names(week({ steps: 49_999 / 7 }))).toEqual([]);
    expect(names(week({ steps: 50_000 / 7 }))).toEqual(["Step Starter"]);
    expect(names(week({ steps: 100_000 / 7 }))).toEqual(["Step Starter", "Marathon Week"]);
  });

  it("Deep Sleeper: 8+ hours on all 7 nights", () => {
    expect(names(week({ sleep_hours: 8 }))).toEqual(["Deep Sleeper"]);
    expect(names(week({ sleep_hours: 8 }, [{ sleep_hours: 7.9 }]))).toEqual([]);
  });

  it("Calm Heart: resting heart rate under 60 every day", () => {
    expect(names(week({ resting_hr: 59 }))).toEqual(["Calm Heart"]);
    expect(names(week({ resting_hr: 59 }, [{ resting_hr: 60 }]))).toEqual([]);
  });

  it("Perfect Week: Deep Sleeper + Step Starter + Calm Heart", () => {
    expect(names(week({ sleep_hours: 8, steps: 8000, resting_hr: 55 }))).toEqual([
      "Step Starter",
      "Deep Sleeper",
      "Calm Heart",
      "Perfect Week",
    ]);
  });

  it("sample data: a Perfect Week, then a Marathon Week with levelled-up repeats", () => {
    const cards = generateCards(loadSampleRows());
    expect(cards.map((c) => `${c.week}:${c.name}:${c.level}`)).toEqual([
      "1:Early Bird:1",
      "1:Step Starter:1",
      "1:Deep Sleeper:1",
      "1:Calm Heart:1",
      "1:Perfect Week:1",
      "2:Early Bird:2",
      "2:Step Starter:2",
      "2:Marathon Week:1",
    ]);
    expect(cards.every((c) => c.whyThisCard.length > 0)).toBe(true);
  });
});
