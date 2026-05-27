/**
 * Backend hook for Track Everything mobile app.
 *
 * Connects directly to the Catalyst backend function via HTTP.
 * Loads all data on mount and refreshes after each mutation.
 * Optionally polls at a configurable interval for cross-client sync.
 */

import {
  DelayEntry,
  FoodItem,
  Goal,
  MealType,
  Priority,
  RecurrenceType,
  ReminderItem,
  Task,
} from "@/constants/tasks";
import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// ──────────── API base URL ────────────

/** Deployed Catalyst function URLs */
const PROD_BASE =
  "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function/";
const DEV_BASE =
  "https://trackeverythingte-904503171.development.catalystserverless.com/server/track_everything_te_function/";

const LOCAL_PORT = process.env.EXPO_PUBLIC_LOCAL_PORT ?? "3000";

function getLocalBase(): string {
  // On web, always use localhost — the backend binds only to localhost
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return `http://localhost:${LOCAL_PORT}/server/track_everything_te_function`;
  }
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    // @ts-ignore – older SDKs
    Constants.manifest?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(":")[0];
    return `http://${host}:${LOCAL_PORT}/server/track_everything_te_function`;
  }

  return `http://localhost:${LOCAL_PORT}/server/track_everything_te_function`;
}

// Web dev → local catalyst serve (http://localhost:3000)
// Mobile dev → Development Catalyst environment
// Production build → Production Catalyst environment
const API_BASE = __DEV__
  ? (Platform.OS === "web" ? getLocalBase() : DEV_BASE)
  : PROD_BASE;

/** How often to poll for cross-client sync (ms). Set to 0 to disable. */
const POLL_INTERVAL = 60_000; // 60s — conservative to save API credits

// ──────────── Types mirroring the backend row shape ────────────

interface WebItem {
  id: string;
  module: "Task" | "Food" | "Reminder" | "Goal";
  level: string;
  text: string;
  status: string | null;
  createdAt: string;
  taskDate: string | null;
  delays: WebDelay[];
  forkedFromTaskId: string | null;
}

interface WebDelay {
  id: string;
  reason: string;
  attachmentLink: string | null;
  date: string;
  taskRowId: string;
  forkedTaskId: string | null;
}

// ──────────── Converter helpers ────────────

function webPriorityToMobile(level: string): Priority {
  const l = level?.toLowerCase();
  if (l === "high") return "high";
  if (l === "low") return "low";
  return "medium";
}

function webDelayToMobile(d: WebDelay): DelayEntry {
  return {
    id: d.id,
    reason: d.reason,
    date: formatDate(d.date),
    rawDate: d.date, // Keep original for sorting
    attachmentUri: d.attachmentLink ?? undefined,
    forkedTaskId: d.forkedTaskId ?? undefined,
  };
}

function extractDateKey(dateStr: string | null): string {
  if (!dateStr) {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }
  return dateStr.split(" ")[0].substring(0, 10);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  let normalized = dateStr.trim();
  normalized = normalized.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  normalized = normalized.replace(/:(\d{3})$/, ".$1");

  const d = new Date(normalized);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function convertItems(webItems: WebItem[]): {
  tasks: Task[];
  food: FoodItem[];
  reminders: ReminderItem[];
  goals: Goal[];
} {
  const tasks: Task[] = [];
  const food: FoodItem[] = [];
  const reminders: ReminderItem[] = [];
  const goals: Goal[] = [];

  for (const item of webItems) {
    switch (item.module) {
      case "Task": {
        const sortedDelays = (item.delays ?? [])
          .map(webDelayToMobile)
          .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
        tasks.push({
          id: item.id,
          title: item.text,
          date: formatDate(item.createdAt),
          dueDate: extractDateKey(item.taskDate || item.createdAt),
          priority: webPriorityToMobile(item.level),
          completed: item.status === "completed",
          dropped: item.status === "dropped",
          expanded: false,
          delays: sortedDelays,
          forkedFromTaskId: item.forkedFromTaskId ?? undefined,
        });
        break;
      }
      case "Food":
        food.push({
          id: item.id,
          title: item.text,
          meal: (item.level as MealType) || "Snacks",
          date: formatDate(item.createdAt),
          dueDate: extractDateKey(item.taskDate || item.createdAt),
        });
        break;
      case "Reminder": {
        let reminderDateTime = "";
        let snoozedUntil: string | undefined;
        let completed = false;
        if (item.status) {
          try {
            const parsed = JSON.parse(item.status);
            reminderDateTime = parsed.reminderDateTime || "";
            snoozedUntil = parsed.snoozedUntil || undefined;
            completed = parsed.completed === true;
          } catch {
            // status is not JSON — treat as incomplete
          }
        }
        reminders.push({
          id: item.id,
          title: item.text,
          recurrence: (item.level as RecurrenceType) || "once",
          reminderDateTime,
          completed,
          snoozedUntil,
          date: formatDate(item.createdAt),
          dueDate: extractDateKey(item.taskDate || item.createdAt),
        });
        break;
      }
      case "Goal": {
        const sortedGoalDelays = (item.delays ?? [])
          .map(webDelayToMobile)
          .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
        goals.push({
          id: item.id,
          title: item.text,
          date: formatDate(item.createdAt),
          priority: webPriorityToMobile(item.level),
          completed: item.status === "completed",
          expanded: false,
          delays: sortedGoalDelays,
        });
        break;
      }
    }
  }

  return { tasks, food, reminders, goals };
}

// ──────────── Hook ────────────

export interface UseBackendReturn {
  connected: boolean;
  synced: boolean;
  refreshing: boolean;
  tasks: Task[];
  food: FoodItem[];
  reminders: ReminderItem[];
  goals: Goal[];
  refresh: () => Promise<void>;
  addItem: (params: {
    itemType: string;
    itemTypeLevel: string;
    itemContent: string;
    status: string | null;
    createdDate: string | null;
  }) => Promise<void>;
  updateItem: (id: string, itemContent: string) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
  addDelay: (
    taskRowId: string,
    delayInput: string,
    attachmentLink?: string | null
  ) => Promise<void>;
  updateDelay: (id: string, delayInput: string) => Promise<void>;
  deleteDelay: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  forkDelay: (
    delayId: string,
    parentTaskId: string,
    targetDate: string,
    priority?: string
  ) => Promise<{ forkedTaskId?: string } | void>;
}

export function useBackend(authToken?: string): UseBackendReturn {
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [food, setFood] = useState<FoodItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const mountedRef = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Build auth headers if a token is provided */
  const authHeaders = useCallback((): Record<string, string> => {
    if (authToken) return { "X-TE-Token": authToken };
    return {};
  }, [authToken]);

  // ── Load all data from the backend via single HTTP request ──

  const loadAllData = useCallback(async (): Promise<boolean> => {
    try {
      // Single request fetches ALL items + ALL delays
      const res = await fetch(`${API_BASE}/listAll`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        console.warn("[backend] listAll failed:", res.status);
        return false;
      }
      const { items: rawItems, delays: rawDelays } = await res.json();

      // Build a map of delays grouped by TaskRowID for O(1) lookup
      const delaysByTask = new Map<string, WebDelay[]>();
      for (const d of rawDelays) {
        const taskId = String(d.TaskRowID);
        const entry: WebDelay = {
          id: d.ROWID,
          reason: d.delayInput,
          attachmentLink: d.attachmentLink,
          date: d.CREATEDTIME,
          taskRowId: taskId,
          forkedTaskId: d.forkedTaskId || null,
        };
        if (!delaysByTask.has(taskId)) {
          delaysByTask.set(taskId, []);
        }
        delaysByTask.get(taskId)!.push(entry);
      }

      // Convert raw rows to WebItems, attaching delays inline
      const allItems: WebItem[] = rawItems.map((row: any) => ({
        id: row.ROWID,
        module: row.itemType as WebItem["module"],
        level: row.itemTypeLevel,
        text: row.itemContent,
        status: row.status,
        createdAt: row.CREATEDTIME,
        taskDate: row.taskDate,
        delays: delaysByTask.get(String(row.ROWID)) ?? [],
        forkedFromTaskId: row.forkedFromTaskId || null,
      }));

      if (!mountedRef.current) return false;

      const converted = convertItems(allItems);
      setTasks(converted.tasks);
      setFood(converted.food);
      setReminders(converted.reminders);
      setGoals(converted.goals);
      setSynced(true);
      setConnected(true);
      return true;
    } catch (err) {
      console.warn("[backend] loadAllData error:", err);
      return false;
    }
  }, [authHeaders]);

  // ── Pull-to-refresh ──

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  // ── HTTP helpers for mutations ──
  // Mutations are fire-and-forget: the UI does optimistic local updates,
  // and the next poll cycle (or manual pull-to-refresh) will reconcile.
  // This avoids an extra full re-fetch after every single action.

  const postJSON = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.warn(`[backend] POST ${path} failed:`, res.status);
        }
      } catch (err) {
        console.warn(`[backend] POST ${path} error:`, err);
      }
      // No automatic re-fetch — optimistic UI handles it.
      // Pull-to-refresh or 60s poll will reconcile if needed.
    },
    [authHeaders]
  );

  const addItem = useCallback(
    async (params: {
      itemType: string;
      itemTypeLevel: string;
      itemContent: string;
      status: string | null;
      createdDate: string | null;
    }) => {
      await postJSON("/add", params);
    },
    [postJSON]
  );

  const updateItem = useCallback(
    async (id: string, itemContent: string) => {
      await postJSON("/update", { id, itemContent });
    },
    [postJSON]
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      await postJSON("/updateStatus", { id, status });
    },
    [postJSON]
  );

  const addDelay = useCallback(
    async (
      taskRowId: string,
      delayInput: string,
      attachmentLink?: string | null
    ) => {
      await postJSON("/addDelay", {
        taskRowId,
        delayInput,
        attachmentLink: attachmentLink ?? null,
      });
    },
    [postJSON]
  );

  const updateDelay = useCallback(
    async (id: string, delayInput: string) => {
      await postJSON("/updateDelay", { id, delayInput });
    },
    [postJSON]
  );

  const deleteDelay = useCallback(
    async (id: string) => {
      await postJSON("/deleteDelay", { id });
    },
    [postJSON]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await postJSON("/delete", { id });
    },
    [postJSON]
  );

  const forkDelay = useCallback(
    async (
      delayId: string,
      parentTaskId: string,
      targetDate: string,
      priority?: string
    ): Promise<{ forkedTaskId?: string } | void> => {
      try {
        const res = await fetch(`${API_BASE}/forkDelay`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ delayId, parentTaskId, targetDate, priority: priority ?? "Medium" }),
        });
        if (!res.ok) {
          console.warn("[backend] forkDelay failed:", res.status);
          return;
        }
        const json = await res.json();
        return { forkedTaskId: json.forkedTaskId };
      } catch (err) {
        console.warn("[backend] forkDelay error:", err);
      }
    },
    [authHeaders]
  );

  // ── Lifecycle ──

  useEffect(() => {
    mountedRef.current = true;

    // Don't attempt to load data without an auth token
    if (!authToken) return;

    // Initial load
    loadAllData().then((ok) => {
      if (ok) {
        console.log("[backend] Initial data load complete");
      } else {
        console.warn("[backend] Initial data load failed");
      }
    });

    // Optional periodic poll for cross-client sync
    if (POLL_INTERVAL > 0) {
      pollTimer.current = setInterval(() => {
        if (mountedRef.current) loadAllData();
      }, POLL_INTERVAL);
    }

    return () => {
      mountedRef.current = false;
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [authToken, loadAllData]);

  return {
    connected,
    synced,
    refreshing,
    tasks,
    food,
    reminders,
    goals,
    refresh,
    addItem,
    updateItem,
    updateStatus,
    addDelay,
    updateDelay,
    deleteDelay,
    deleteItem,
    forkDelay,
  };
}
