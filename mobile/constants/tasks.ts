export type Priority = "high" | "medium" | "low";

export interface DelayEntry {
  id: string;
  reason: string;
  date: string;
  rawDate: string; // Original ISO/timestamp for sorting
  attachmentUri?: string;
  forkedTaskId?: string; // ROWID of the task created by forking this delay
}

export interface Task {
  id: string;
  title: string;
  date: string;
  dueDate: string; // ISO date string "YYYY-MM-DD" for calendar linking
  priority: Priority;
  completed: boolean;
  dropped?: boolean;
  expanded?: boolean;
  delays: DelayEntry[];
  forkedFromTaskId?: string; // ROWID of parent task this was forked from
  forkedFromTaskTitle?: string; // Title of parent task (for display)
}

// ──────────── FOOD ────────────

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

export interface FoodItem {
  id: string;
  title: string;
  meal: MealType;
  date: string;
  dueDate: string;
}

// ──────────── REMINDER ────────────

export type RecurrenceType = "once" | "daily" | "weekly" | "monthly";

export interface ReminderItem {
  id: string;
  title: string;
  recurrence: RecurrenceType;
  reminderDateTime: string; // Local datetime string "YYYY-MM-DDTHH:mm"
  completed: boolean;
  snoozedUntil?: string; // Absolute datetime string (typically ISO with timezone)
  date: string; // formatted created date
  dueDate: string; // YYYY-MM-DD for calendar
}

export const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: "One-time", value: "once" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

// ──────────── GOAL ────────────

export interface Goal {
  id: string;
  title: string;
  date: string;
  priority: Priority;
  completed: boolean;
  expanded?: boolean;
  delays: DelayEntry[];
}

// ──────────── TRAVEL ────────────

export interface TravelPlace {
  id: string;
  title: string;       // Place name (e.g., "Anna Nagar, Chennai")
  address: string;     // Full formatted address from Nominatim
  latitude: number;
  longitude: number;
  visitDate: string;   // YYYY-MM-DD
  status: "visited" | "to-visit" | "trip";
}

export interface TripWaypoint {
  t: string;   // time label e.g. "10:32 AM"
  lat: number;
  lng: number;
  p: string;   // place name
}

export interface TripRecord {
  id: string;
  date: string;          // YYYY-MM-DD
  startTime: number;     // epoch ms
  endTime: number;       // epoch ms
  durationMs: number;
  distanceKm: number;
  waypoints: TripWaypoint[];
}

// ──────────── HELPERS ────────────

// Helper to get today's date as YYYY-MM-DD
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TODAY = new Date();
const YESTERDAY = new Date(TODAY);
YESTERDAY.setDate(TODAY.getDate() - 1);
const TOMORROW = new Date(TODAY);
TOMORROW.setDate(TODAY.getDate() + 1);
const DAY_AFTER = new Date(TODAY);
DAY_AFTER.setDate(TODAY.getDate() + 2);

export const MOCK_TASKS: Task[] = [
  {
    id: "1",
    title: "Read 10 pages",
    date: "Oct 22, 10:00 AM",
    dueDate: toDateKey(TODAY),
    priority: "high",
    completed: false,
    expanded: true,
    delays: [
      {
        id: "d1",
        reason: "Unexpected meeting",
        date: "Oct 22, 09:15 PM",
        rawDate: "2024-10-22 21:15:00:000",
        attachmentUri: "https://lh3.googleusercontent.com/aida-public/AB6AXuBWx612j90BPGX-ReW5hK9OJgE3C_doUXdd2H7oWcki4111FGE3eqyigq0ROowWlry41G-FMjdmcbq0lTFjA8YuCvPRsun5VFGLDWup4MhvzxAFkNh1duTVOGCQYchZ8iQREGD5OAE4ZRxe-x_sW5cLjmyDfSOfp_drsz7Ai-Agcf1etOPIR-wxs5EqBqDIlmepZDiAjZ5kLGXZMlOtYV4pPSwmaGXHRE1vfsptZT0N2YEKVUOUT2XC4APbFMTzY1EFGy-wgIvCSYA",
      },
    ],
  },
  {
    id: "2",
    title: "Morning Meditation",
    date: "Oct 23, 07:30 AM",
    dueDate: toDateKey(TODAY),
    priority: "medium",
    completed: false,
    delays: [],
  },
  {
    id: "3",
    title: "Evening Yoga Session",
    date: "Oct 23, 08:00 AM",
    dueDate: toDateKey(TOMORROW),
    priority: "medium",
    completed: false,
    delays: [],
  },
  {
    id: "4",
    title: "Drink 2L of water",
    date: "Oct 23, 09:15 AM",
    dueDate: toDateKey(TODAY),
    priority: "low",
    completed: true,
    delays: [],
  },
  {
    id: "5",
    title: "Reflective Journaling",
    date: "Oct 23, 08:45 AM",
    dueDate: toDateKey(YESTERDAY),
    priority: "low",
    completed: true,
    delays: [],
  },
  {
    id: "6",
    title: "Review weekly goals",
    date: "Oct 24, 09:00 AM",
    dueDate: toDateKey(TOMORROW),
    priority: "high",
    completed: false,
    delays: [],
  },
  {
    id: "7",
    title: "Plan next sprint",
    date: "Oct 25, 10:00 AM",
    dueDate: toDateKey(DAY_AFTER),
    priority: "medium",
    completed: false,
    delays: [],
  },
];

/** Convert a Date to a "YYYY-MM-DD" key */
export function dateToKey(date: Date): string {
  return toDateKey(date);
}

const LOCAL_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Parses a reminder datetime string while preserving local wall-clock time.
 * - "YYYY-MM-DDTHH:mm" is treated as local time.
 * - Other formats (for example ISO with timezone) use native Date parsing.
 */
export function parseReminderDateTime(dateTime: string): Date | null {
  if (!dateTime) return null;

  const localMatch = dateTime.match(LOCAL_DATE_TIME_REGEX);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]) - 1;
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const minute = Number(localMatch[5]);
    const localDate = new Date(year, month, day, hour, minute, 0, 0);
    return isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(dateTime);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Formats a Date as local "YYYY-MM-DDTHH:mm". */
export function formatLocalReminderDateTime(date: Date): string {

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface ParsedReminder {
  /** Cleaned title with date/time tokens stripped out */
  title: string;
  /** "YYYY-MM-DDTHH:mm" or null if nothing was detected */
  dateTime: string | null;
  /** Human-readable label like "Today, 9:00 PM" */
  preview: string | null;
}

/**
 * Parses a natural language reminder string.
 * Extracts date ("today", "tomorrow", day names, "Apr 30") and
 * time ("9pm", "9:00 am", "noon") from the text, strips them out
 * along with connector words ("for", "at", "on"), and returns a
 * clean title plus a "YYYY-MM-DDTHH:mm" dateTime.
 *
 * Examples:
 *   "Buy safety pin for today 9:00pm"  → title: "Buy safety pin", dateTime: "2026-04-30T21:00"
 *   "Call dentist tomorrow at 10am"    → title: "Call dentist", dateTime: "2026-05-01T10:00"
 *   "Team meeting monday 3:30pm"       → title: "Team meeting", dateTime: "2026-05-04T15:30"
 */
export function parseNaturalReminder(text: string): ParsedReminder {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  let working = text;
  let hour: number | null = null;
  let minute = 0;
  let date: Date | null = null;

  // ── 1. Extract time ──
  const T_HHMM_AMPM = /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i;
  const T_H_AMPM    = /\b(\d{1,2})\s*(am|pm)\b/i;
  const T_NOON_MID  = /\b(noon|midnight)\b/i;
  const T_24H       = /\b([01]\d|2[0-3]):([0-5]\d)\b/;

  let m: RegExpExecArray | null;
  if ((m = T_HHMM_AMPM.exec(working))) {
    hour = parseInt(m[1], 10); minute = parseInt(m[2], 10);
    const ap = m[3].toLowerCase();
    if (ap === "am" && hour === 12) hour = 0;
    if (ap === "pm" && hour !== 12) hour += 12;
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = T_H_AMPM.exec(working))) {
    hour = parseInt(m[1], 10); minute = 0;
    const ap = m[2].toLowerCase();
    if (ap === "am" && hour === 12) hour = 0;
    if (ap === "pm" && hour !== 12) hour += 12;
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = T_NOON_MID.exec(working))) {
    hour = m[1].toLowerCase() === "noon" ? 12 : 0; minute = 0;
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = T_24H.exec(working))) {
    hour = parseInt(m[1], 10); minute = parseInt(m[2], 10);
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  }

  // ── 2. Extract date ──
  const MONTH_MAP: Record<string, number> = {
    jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
    jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  };
  const DAY_MAP: Record<string, number> = {
    sunday:0, monday:1, tuesday:2, wednesday:3,
    thursday:4, friday:5, saturday:6,
  };
  const MO = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const DN = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday)";

  const D_TODAY    = /\btoday\b/i;
  const D_TOMORROW = /\btomorrow\b/i;
  const D_NEXT_DAY = new RegExp(`\\bnext\\s+${DN}\\b`, "i");
  const D_DAY_NAME = new RegExp(`\\b${DN}\\b`, "i");
  const D_MON_DAY  = new RegExp(`\\b${MO}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i");
  const D_DAY_MON  = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MO}\\b`, "i");

  const nextOccurrence = (targetDow: number, minDiff = 1) => {
    const base = new Date(now);
    let diff = (targetDow - base.getDay() + 7) % 7;
    if (diff < minDiff) diff += 7;
    base.setDate(base.getDate() + diff);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate());
  };

  if ((m = D_TODAY.exec(working))) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = D_TOMORROW.exec(working))) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = D_NEXT_DAY.exec(working))) {
    date = nextOccurrence(DAY_MAP[m[1].toLowerCase()], 1);
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = D_MON_DAY.exec(working))) {
    const mo = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
    const dy = parseInt(m[2], 10);
    const d = new Date(now.getFullYear(), mo, dy);
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = D_DAY_MON.exec(working))) {
    const dy = parseInt(m[1], 10);
    const mo = MONTH_MAP[m[2].toLowerCase().slice(0, 3)];
    const d = new Date(now.getFullYear(), mo, dy);
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  } else if ((m = D_DAY_NAME.exec(working))) {
    date = nextOccurrence(DAY_MAP[m[1].toLowerCase()], 1);
    working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length);
  }

  // ── 3. Strip connector words & clean title ──
  working = working.replace(/\b(for|at|on|by|remind\s+me(\s+to)?)\b/gi, " ");
  const title = working.replace(/\s+/g, " ").trim();

  // ── 4. Build result ──
  if (!date && hour === null) {
    return { title: text.trim(), dateTime: null, preview: null };
  }

  if (!date) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const h = hour ?? 9;
  const finalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, minute);
  const dateTime = `${finalDate.getFullYear()}-${pad(finalDate.getMonth() + 1)}-${pad(finalDate.getDate())}T${pad(h)}:${pad(minute)}`;

  const isToday = finalDate.toDateString() === now.toDateString();
  const isTomorrow = (() => {
    const t = new Date(now); t.setDate(t.getDate() + 1);
    return finalDate.toDateString() === t.toDateString();
  })();
  const dateLabel = isToday ? "Today" : isTomorrow ? "Tomorrow"
    : finalDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? "PM" : "AM";
  const preview = `${dateLabel}, ${h12}:${pad(minute)} ${ampm}`;

  return { title: title || text.trim(), dateTime, preview };
}

// ──────────── MOCK FOOD DATA ────────────

export const MOCK_FOOD: FoodItem[] = [
  { id: "f1", title: "Oatmeal with berries", meal: "Breakfast", date: "Mar 1, 8:00 AM", dueDate: toDateKey(TODAY) },
  { id: "f2", title: "Green tea", meal: "Breakfast", date: "Mar 1, 8:15 AM", dueDate: toDateKey(TODAY) },
  { id: "f3", title: "Grilled chicken salad", meal: "Lunch", date: "Mar 1, 12:30 PM", dueDate: toDateKey(TODAY) },
  { id: "f4", title: "Brown rice & veggies", meal: "Lunch", date: "Mar 1, 12:45 PM", dueDate: toDateKey(TODAY) },
  { id: "f5", title: "Salmon with quinoa", meal: "Dinner", date: "Mar 1, 7:00 PM", dueDate: toDateKey(TODAY) },
  { id: "f6", title: "Mixed nuts", meal: "Snacks", date: "Mar 1, 4:00 PM", dueDate: toDateKey(TODAY) },
  { id: "f7", title: "Protein bar", meal: "Snacks", date: "Mar 1, 5:30 PM", dueDate: toDateKey(TODAY) },
];

// ──────────── MOCK REMINDER DATA ────────────

export const MOCK_REMINDERS: ReminderItem[] = [];

// ──────────── MOCK GOAL DATA ────────────

export const MOCK_GOALS: Goal[] = [
  { id: "g1", title: "Read 12 books this year", date: "Jan 1, 9:00 AM", priority: "high", completed: false, delays: [] },
  { id: "g2", title: "Run a half marathon", date: "Feb 15, 10:00 AM", priority: "high", completed: false, delays: [] },
  { id: "g3", title: "Learn TypeScript", date: "Jan 10, 8:00 AM", priority: "medium", completed: true, delays: [] },
  { id: "g4", title: "Save ₹1L emergency fund", date: "Mar 1, 9:00 AM", priority: "medium", completed: false, delays: [] },
  { id: "g5", title: "Complete online course", date: "Feb 1, 10:00 AM", priority: "low", completed: true, delays: [] },
];

export const MEAL_SECTIONS: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];
