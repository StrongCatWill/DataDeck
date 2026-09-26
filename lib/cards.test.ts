import { describe, expect, it } from "vitest";
import { buildDeck, cardsForWeek, parseHealthCsv, type DayRecord } from "./cards";
import { loadSampleDays } from "./sampleData";

// A week that earns nothing: late wakes, short sleep, few steps, higher resting HR.
const plain: DayRecord = { date: "2026-01-01", wakeTime: "07:30", sleepHours: 7, steps: 5000, restingHr: 65 };
const week = (patch: Partial<DayRecord> = {}, overrides: Partial<DayRecord>[] = []) =>
  Array.from({ length: 7 }, (_, i) => ({ ...plain, ...patch, ...overrides[i] }));
const names = (days: DayRecord[]) => cardsForWeek(days).map((c) => c.name);

describe("cardsForWeek", () => {
  it("earns nothing for a plain week", () => {
    expect(names(week())).toEqual([]);
  });

  it("Early Bird needs 5 wakes strictly before 7:00", () => {
    const early = { wakeTime: "06:59" };
    expect(names(week({}, [early, early, early, early, { wakeTime: "07:00" }]))).toEqual([]);
    expect(names(week({}, [early, early, early, early, early]))).toEqual(["Early Bird"]);
  });

  it("Step Starter at 50,000 and Marathon Week at 100,000 total steps", () => {
    const perDay = (total: number) => week({ steps: total / 7 });
    expect(names(perDay(49_999))).toEqual([]);
    expect(names(perDay(50_000))).toEqual(["Step Starter"]);
    expect(names(perDay(99_999))).toEqual(["Step Starter"]);
    expect(names(perDay(100_000))).toEqual(["Step Starter", "Marathon Week"]);
  });

  it("Deep Sleeper needs 8+ hours on all 7 nights", () => {
    expect(names(week({ sleepHours: 8 }))).toEqual(["Deep Sleeper"]);
    expect(names(week({ sleepHours: 8 }, [{ sleepHours: 7.9 }]))).toEqual([]);
  });

  it("Calm Heart needs resting HR under 60 every day", () => {
    expect(names(week({ restingHr: 59 }))).toEqual(["Calm Heart"]);
    expect(names(week({ restingHr: 59 }, [{ restingHr: 60 }]))).toEqual([]);
  });

  it("Perfect Week needs Deep Sleeper, Step Starter and Calm Heart together", () => {
    expect(names(week({ sleepHours: 8, restingHr: 55, steps: 8000 }))).toEqual([
      "Step Starter",
      "Deep Sleeper",
      "Calm Heart",
      "Perfect Week",
    ]);
  });

  it("explains each card from the week's data", () => {
    const [card] = cardsForWeek(week({ steps: 10_000 }));
    expect(card).toMatchObject({ name: "Step Starter", rarity: "common", why: "70,000 steps this week." });
  });
});

describe("parseHealthCsv", () => {
  it("reads columns by header name", () => {
    const csv = "steps,date,resting_hr,wake_time,sleep_hours\n9000,2026-09-01,58,06:45,8.2\n";
    expect(parseHealthCsv(csv)).toEqual([
      { date: "2026-09-01", wakeTime: "06:45", sleepHours: 8.2, steps: 9000, restingHr: 58 },
    ]);
  });

  it("rejects a CSV without a required column", () => {
    expect(() => parseHealthCsv("date,steps\n2026-09-01,9000")).toThrow(/wake_time/);
  });
});

describe("sample data", () => {
  it("produces a rarity mix ending in a Perfect Week", () => {
    const deck = buildDeck(loadSampleDays());
    expect(deck.map((p) => p.cards.map((c) => c.name))).toEqual([
      ["Step Starter"],
      ["Early Bird", "Calm Heart"],
      ["Step Starter", "Marathon Week"],
      ["Early Bird", "Step Starter", "Deep Sleeper", "Calm Heart", "Perfect Week"],
    ]);
  });

  it("levels up a card each time it is earned again", () => {
    const deck = buildDeck(loadSampleDays());
    expect(deck[3].cards.find((c) => c.name === "Step Starter")?.level).toBe(3);
    expect(deck[3].cards.find((c) => c.name === "Perfect Week")?.level).toBe(1);
  });
});
