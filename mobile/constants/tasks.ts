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
