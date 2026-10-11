import { randomBytes } from "node:crypto";

// The player's app account: sign-in, age check, data sources, goals, settings, game progress, notifications and
// cash-outs. In server memory like the grant and key stores (a demo; production needs a database).
// The rules live here, not in the browser: the 18+ gate, XP and levels, one reward per quest per day and per pack,
// and a cash-out never above what payouts actually paid.

export const XP_PER_LEVEL = 400;
export const QUEST_XP = 30;
export const PACK_XP = 40;
export const LEVELS = ["Rookie", "Walker", "Night Owl", "Pacer", "Legend"];
export const SOURCES = ["health", "phone", "strava", "sample"] as const;
export type Source = (typeof SOURCES)[number];
export type Quest = "steps" | "sleep";

export interface Notification {
  id: string;
  icon: string;
  title: string;
  body: string;
  act: string | null;
  at: number; // unix seconds
  read: boolean;
}

export interface CashOut {
  id: string;
  amountUsdc: number;
  destination: "bank" | "wallet";
  signature: string; // "sim-cash-..." while PAYOUT_MODE is simulate
  at: number;
}

export interface SleepNight {
  start: number;
  end: number;
  hours: number;
}

export interface Profile {
  player: string;
  name: string;
  color: string;
  provider: string | null;
  signedIn: boolean;
  birthYear: number | null;
  ageVerified: boolean;
  sources: Record<Source, boolean>;
  types: { sleep: boolean; steps: boolean; heart: boolean };
  goals: { steps: number; sleep: number };
  settings: Record<string, boolean>;
  level: number;
  xp: number;
  streak: number;
  lastQuestDay: string | null; // YYYY-MM-DD of the last day a quest was finished
  quests: Record<string, Quest[]>; // day -> quests finished that day
  packsOpened: number[]; // weeks
  nights: SleepNight[];
  notifications: Notification[];
  cashOuts: CashOut[];
  createdAt: number;
}

export class ProfileError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const g = globalThis as unknown as { __dataDeckProfiles?: Map<string, Profile> };
const store = (g.__dataDeckProfiles ??= new Map());

const now = () => Math.floor(Date.now() / 1000);
const today = (at = Date.now()) => new Date(at).toISOString().slice(0, 10);
const id = () => randomBytes(6).toString("hex");

function fresh(player: string): Profile {
  return {
    player,
    name: "Player",
    color: "#6C4DF5",
    provider: null,
    signedIn: false,
    birthYear: null,
    ageVerified: false,
    sources: { health: false, phone: false, strava: false, sample: false },
    types: { sleep: true, steps: true, heart: true },
    goals: { steps: 6000, sleep: 8 },
    settings: { haptics: true, reduce: false, payout: true, pack: true, bedtime: true, quests: true, studies: false },
    level: 1,
    xp: 0,
    streak: 0,
    lastQuestDay: null,
    quests: {},
    packsOpened: [],
    nights: [],
    notifications: [],
    cashOuts: [],
    createdAt: now(),
  };
}

// The demo player starts mid-game, as in the pitch: level 3 with 330 XP and a 5-day streak that ran up to
// yesterday, so the first pack and one quest reach level 4. Every other player starts at level 1.
export const DEMO_PLAYER = "demo-player";
function demoStart(p: Profile): Profile {
  p.level = 3;
  p.xp = 330;
  p.streak = 5;
  p.lastQuestDay = today(Date.now() - 86_400_000);
  return p;
}

export const getProfile = (player: string): Profile | null => store.get(player) ?? null;

function need(player: string): Profile {
  const p = store.get(player);
  if (!p) throw new ProfileError("Sign in first", 401);
  return p;
}

export const levelName = (level: number) => LEVELS[Math.min(level, LEVELS.length) - 1];

export function signIn(player: string, provider: string, name?: string): Profile {
  const p = store.get(player) ?? (player === DEMO_PLAYER ? demoStart(fresh(player)) : fresh(player));
  p.provider = provider;
  p.signedIn = true;
  if (name) p.name = name.slice(0, 40);
  store.set(player, p);
  return p;
}

export function signOut(player: string): Profile {
  const p = need(player);
  p.signedIn = false;
  return p;
}

/** 18+ only. Under 18 is refused and nothing else can be saved until a valid year is given. */
export function verifyAge(player: string, birthYear: number, at = new Date()): Profile {
  const p = need(player);
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > at.getFullYear()) throw new ProfileError("Invalid birth year");
  p.birthYear = birthYear;
  p.ageVerified = at.getFullYear() - birthYear >= 18;
  if (!p.ageVerified) throw new ProfileError("You need to be 18 or over to use Data Deck", 403);
  return p;
}

function verified(player: string): Profile {
  const p = need(player);
  if (!p.ageVerified) throw new ProfileError("Confirm you are 18 or over first", 403);
  return p;
}

export function setSources(player: string, sources: Partial<Record<Source, boolean>>): Profile {
  const p = verified(player);
  for (const s of SOURCES) if (typeof sources[s] === "boolean") p.sources[s] = sources[s]!;
  return p;
}

export function setGoals(player: string, goals: { steps?: number; sleep?: number }): Profile {
  const p = verified(player);
  if (goals.steps !== undefined) {
    if (!Number.isFinite(goals.steps) || goals.steps < 1000 || goals.steps > 50000) throw new ProfileError("Step goal must be 1,000 to 50,000");
    p.goals.steps = Math.round(goals.steps);
  }
  if (goals.sleep !== undefined) {
    if (!Number.isFinite(goals.sleep) || goals.sleep < 4 || goals.sleep > 12) throw new ProfileError("Sleep goal must be 4 to 12 hours");
    p.goals.sleep = goals.sleep;
  }
  return p;
}

export function setSettings(player: string, settings: Record<string, unknown>): Profile {
  const p = verified(player);
  for (const [k, v] of Object.entries(settings)) if (k in p.settings && typeof v === "boolean") p.settings[k] = v;
  return p;
}

export function setDetails(player: string, details: { name?: string; color?: string }): Profile {
  const p = verified(player);
  if (details.name !== undefined) {
    const name = String(details.name).trim().slice(0, 40);
    if (!name) throw new ProfileError("Name can't be empty");
    p.name = name;
  }
  if (details.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(details.color)) throw new ProfileError("Colour must be #RRGGBB");
    p.color = details.color;
  }
  return p;
}

/** Adds XP and returns how many levels were gained. Levels never change what a study pays. */
function addXp(p: Profile, n: number): number {
  p.xp += n;
  let gained = 0;
  while (p.xp >= XP_PER_LEVEL) {
    p.xp -= XP_PER_LEVEL;
    p.level++;
    gained++;
  }
  return gained;
}

export function notify(player: string, n: Omit<Notification, "id" | "at" | "read">): Notification {
  const p = need(player);
  const note: Notification = { ...n, id: id(), at: now(), read: false };
  p.notifications.unshift(note);
  p.notifications.length = Math.min(p.notifications.length, 100);
  return note;
}

export function readAllNotifications(player: string): Profile {
  const p = need(player);
  for (const n of p.notifications) n.read = true;
  return p;
}

/** A finished daily quest: +30 XP once per quest per day, and keeps the streak going. */
export function completeQuest(player: string, quest: Quest, at = Date.now()): { profile: Profile; xp: number; levelsGained: number } {
  const p = verified(player);
  if (quest !== "steps" && quest !== "sleep") throw new ProfileError("Unknown quest");
  const day = today(at);
  const done = (p.quests[day] ??= []);
  if (done.includes(quest)) return { profile: p, xp: 0, levelsGained: 0 };
  done.push(quest);
  if (p.lastQuestDay !== day) {
    const yesterday = today(at - 86_400_000);
    p.streak = p.lastQuestDay === yesterday ? p.streak + 1 : 1;
    p.lastQuestDay = day;
  }
  return { profile: p, xp: QUEST_XP, levelsGained: addXp(p, QUEST_XP) };
}

/** Opening a week's pack: +40 XP once per week. */
export function openPack(player: string, week: number): { profile: Profile; xp: number; levelsGained: number } {
  const p = verified(player);
  if (!Number.isInteger(week) || week < 1) throw new ProfileError("Invalid week");
  if (p.packsOpened.includes(week)) return { profile: p, xp: 0, levelsGained: 0 };
  p.packsOpened.push(week);
  return { profile: p, xp: PACK_XP, levelsGained: addXp(p, PACK_XP) };
}

/** A night logged with Sleep mode (phone tracker). Meeting the sleep goal finishes the sleep quest. */
export function logSleep(player: string, start: number, end: number, at = Date.now()) {
  const p = verified(player);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 16 * 3600) throw new ProfileError("Invalid night");
  const hours = Math.round(((end - start) / 3600) * 10) / 10;
  p.nights.unshift({ start, end, hours });
  const quest = hours >= p.goals.sleep ? completeQuest(player, "sleep", at) : { profile: p, xp: 0, levelsGained: 0 };
  return { ...quest, hours };
}

/** Cash out up to what payouts actually paid, minus earlier cash-outs. Simulated transfer. */
export function cashOut(player: string, amountUsdc: number, destination: "bank" | "wallet", paidUsdc: number): CashOut {
  const p = verified(player);
  if (destination !== "bank" && destination !== "wallet") throw new ProfileError("Pick a bank account or your own wallet");
  const cashed = p.cashOuts.reduce((sum, c) => sum + c.amountUsdc, 0);
  const available = Math.round((paidUsdc - cashed) * 1e6) / 1e6;
  if (!(amountUsdc > 0)) throw new ProfileError("Nothing to cash out");
  if (amountUsdc > available + 1e-9) throw new ProfileError(`Only ${available.toFixed(2)} USDC is available`, 409);
  const c: CashOut = { id: id(), amountUsdc, destination, signature: `sim-cash-${id()}`, at: now() };
  p.cashOuts.unshift(c);
  return c;
}

export const cashedOut = (p: Profile) => p.cashOuts.reduce((sum, c) => sum + c.amountUsdc, 0);

/** Deletes the account. The caller stops every loan first (kill switch) so no study keeps access. */
export function deleteProfile(player: string): boolean {
  return store.delete(player);
}

/** What the app shows: the profile plus derived fields. */
export function view(p: Profile) {
  return {
    ...p,
    levelName: levelName(p.level),
    xpToNext: XP_PER_LEVEL - p.xp,
    unread: p.notifications.filter((n) => !n.read).length,
    questsToday: p.quests[today()] ?? [],
    cashedOutUsdc: cashedOut(p),
  };
}
