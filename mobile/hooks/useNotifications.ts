/**
 * useNotifications — TracE push/local notification system.
 *
 * Three notification types:
 *  1. Pending tasks without a delay reason — fires once per day.
 *  2. Food reminders — 3 times a day (8 AM Breakfast, 2 PM Lunch, 8 PM Dinner).
 *  3. Daily task-log reminder — 9 PM every evening.
 *
 * NOTE: expo-notifications requires a native build. All calls are wrapped in
 * try/catch so this hook is a no-op on OTA builds that predate the native module.
 */

import {
  FoodItem,
  ReminderItem,
  Task,
  parseReminderDateTime,
} from "@/constants/tasks";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

// ─── Lazy native module access ────────────────────────────────────────────────
// We import dynamically so a missing native build doesn't crash at module load.
let Notifications: typeof import("expo-notifications") | null = null;
let SecureStore: typeof import("expo-secure-store") | null = null;

try {
  Notifications = require("expo-notifications");
  SecureStore = require("expo-secure-store");

  // Set handler only if the native module loaded successfully
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Native module not available in this binary (OTA-only build). Silently skip.
  Notifications = null;
  SecureStore = null;
}

// ─── SecureStore keys ────────────────────────────────────────────────────────
const KEY_FOOD_IDS = "te_food_notif_ids";
const KEY_TASK_LOG_ID = "te_tasklog_notif_id";
const KEY_PENDING_DATE = "te_pending_last_date";
const KEY_REMINDER_IDS = "te_reminder_notif_ids";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextOccurrence(hour: number, minute = 0): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

async function cancelById(id: string | undefined): Promise<void> {
  if (!id || !Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or unavailable — ignore.
  }
}

async function getStored(key: string): Promise<string | null> {
  if (!SecureStore) return null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setStored(key: string, value: string): Promise<void> {
  if (!SecureStore) return;
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Best-effort.
  }
}

// ─── Permission request ───────────────────────────────────────────────────────

async function requestPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("trace-default", {
        name: "Reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// ─── 1. Daily task-log reminder ───────────────────────────────────────────────

async function scheduleTaskLogReminder(): Promise<void> {
  if (!Notifications) return;
  try {
    const stored = await getStored(KEY_TASK_LOG_ID);
    if (stored) await cancelById(stored);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily Check-in",
        body: "End of day! Log your tasks and activities before you wrap up 📝",
        sound: undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
      },
    });
    await setStored(KEY_TASK_LOG_ID, id);
  } catch {
    // Silently skip if scheduling fails.
  }
}

// ─── 2. Food reminders ────────────────────────────────────────────────────────

interface FoodNotifIds {
  breakfast?: string;
  lunch?: string;
  dinner?: string;
}

async function scheduleFoodReminders(food: FoodItem[]): Promise<void> {
  if (!Notifications) return;
  try {
    const today = todayKey();
    const todayMeals = food.filter((f) => f.dueDate === today);
    const hasBreakfast = todayMeals.some((f) => f.meal === "Breakfast");
    const hasLunch = todayMeals.some((f) => f.meal === "Lunch");
    const hasDinner = todayMeals.some((f) => f.meal === "Dinner");

    let ids: FoodNotifIds = {};
    const raw = await getStored(KEY_FOOD_IDS);
    if (raw) {
      try { ids = JSON.parse(raw); } catch { /* ignore */ }
    }

    const updated: FoodNotifIds = {};

    await cancelById(ids.breakfast);
    if (!hasBreakfast) {
      updated.breakfast = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Breakfast",
          body: "Good morning! Don't forget to log your breakfast 🍳",
          sound: undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextOccurrence(8, 0),
        },
      });
    }

    await cancelById(ids.lunch);
    if (!hasLunch) {
      updated.lunch = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Lunch",
          body: "Afternoon check-in! Log your lunch 🍱",
          sound: undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextOccurrence(14, 0),
        },
      });
    }

    await cancelById(ids.dinner);
    if (!hasDinner) {
      updated.dinner = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Dinner",
          body: "Evening! Don't forget to log your dinner 🌙",
          sound: undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextOccurrence(20, 0),
        },
      });
    }

    await setStored(KEY_FOOD_IDS, JSON.stringify(updated));
  } catch {
    // Silently skip if scheduling fails.
  }
}

// ─── 3. Pending tasks without delay reason ────────────────────────────────────

async function notifyPendingWithoutDelay(tasks: Task[]): Promise<void> {
  if (!Notifications) return;
  try {
    const today = todayKey();
    const lastDate = await getStored(KEY_PENDING_DATE);
    if (lastDate === today) return;

    const count = tasks.filter((t) => !t.completed && t.delays.length === 0).length;
    if (count === 0) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Pending Update Needed",
        body:
          count === 1
            ? "1 pending task has no delay reason yet. Tap to add one."
            : `${count} pending tasks have no delay reason yet. Tap to update them.`,
        sound: undefined,
      },
      trigger: null,
    });

    await setStored(KEY_PENDING_DATE, today);
  } catch {
    // Silently skip.
  }
}

// ─── 4. Custom reminders ──────────────────────────────────────────────────────

async function scheduleCustomReminders(reminders: ReminderItem[]): Promise<void> {
  if (!Notifications) return;
  try {
    // Cancel previously scheduled reminder notifications
    const raw = await getStored(KEY_REMINDER_IDS);
    let oldIds: string[] = [];
    if (raw) {
      try { oldIds = JSON.parse(raw); } catch { /* ignore */ }
    }
    for (const id of oldIds) {
      await cancelById(id);
    }

    const newIds: string[] = [];
    const now = Date.now();

    for (const reminder of reminders) {
      if (reminder.completed) continue;
      if (!reminder.reminderDateTime) continue;

      const triggerDate = parseReminderDateTime(
        reminder.snoozedUntil || reminder.reminderDateTime
      );
      if (!triggerDate) continue;
      if (isNaN(triggerDate.getTime()) || triggerDate.getTime() <= now) continue;

      const recurrenceLabel =
        reminder.recurrence === "once"
          ? ""
          : ` (${reminder.recurrence})`;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reminder${recurrenceLabel}`,
          body: reminder.title,
          sound: undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
      newIds.push(id);
    }

    await setStored(KEY_REMINDER_IDS, JSON.stringify(newIds));
  } catch {
    // Silently skip.
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(
  tasks: Task[],
  food: FoodItem[],
  reminders: ReminderItem[],
  synced: boolean
): void {
  const permittedRef = useRef(false);
  const taskLogScheduledRef = useRef(false);

  useEffect(() => {
    requestPermissions().then((granted) => {
      permittedRef.current = granted;
      if (granted && !taskLogScheduledRef.current) {
        scheduleTaskLogReminder();
        taskLogScheduledRef.current = true;
      }
    });
  }, []);

  const foodRef = useRef<FoodItem[]>([]);
  useEffect(() => {
    if (!synced || !permittedRef.current) return;
    if (food === foodRef.current) return;
    foodRef.current = food;
    scheduleFoodReminders(food);
  }, [synced, food]);

  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    if (!synced || !permittedRef.current) return;
    if (tasks === tasksRef.current) return;
    tasksRef.current = tasks;
    notifyPendingWithoutDelay(tasks).catch(() => {});
  }, [synced, tasks]);

  const remindersRef = useRef<ReminderItem[]>([]);
  useEffect(() => {
    if (!synced || !permittedRef.current) return;
    if (reminders === remindersRef.current) return;
    remindersRef.current = reminders;
    scheduleCustomReminders(reminders);
  }, [synced, reminders]);
}
