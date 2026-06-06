import BottomInputBar, { BottomInputBarHandle } from "@/components/tasks/BottomInputBar";
import CalendarDropdown from "@/components/tasks/CalendarDropdown";
import ReminderList from "@/components/tasks/ReminderList";
import FoodList from "@/components/tasks/FoodList";
import GoalList from "@/components/tasks/GoalList";
import Header, { TabName } from "@/components/tasks/Header";
import ProfilePanel from "@/components/tasks/ProfilePanel";
import SearchOverlay from "@/components/tasks/SearchOverlay";
import TaskList from "@/components/tasks/TaskList";
import {
  FoodItem,
  Goal,
  MEAL_SECTIONS,
  MealType,
  Priority,
  RecurrenceType,
  ReminderItem,
  Task,
  dateToKey,
  formatLocalReminderDateTime,
  parseNaturalReminder,
} from "@/constants/tasks";
import { useAuth } from "@/contexts/AuthContext";
import { useBackend } from "@/hooks/useBackend";
import { useNotifications } from "@/hooks/useNotifications";
import { useScore } from "@/hooks/useScore";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const smoothSpring = LayoutAnimation.create(
  300,
  LayoutAnimation.Types.spring,
  LayoutAnimation.Properties.scaleY
);

export default function Home() {
  const { isLoading, user, token, logout } = useAuth();

  // ────────── All hooks MUST be called before any conditional return ──────────
  const [activeTab, setActiveTab] = useState<TabName>("Task");
  const [inputText, setInputText] = useState("");
  const inputBarRef = useRef<BottomInputBarHandle>(null);

  // Auto-focus input when switching tabs
  useEffect(() => {
    const t = setTimeout(() => inputBarRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [activeTab]);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPriority, setSelectedPriority] = useState<Priority>("medium");
  const [selectedMeal, setSelectedMeal] = useState<MealType>("Breakfast");
  const [selectedRecurrence, setSelectedRecurrence] = useState<RecurrenceType>("once");

  // ────────── In-app reminder creation toast ──────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showReminderToast = useCallback((preview: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(preview);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  }, [toastAnim]);

  // ────────── Backend hook (pass auth token) ──────────
  const ds = useBackend(token ?? undefined);

  // ────────── Activity Score ──────────
  const { score, tier, loading: scoreLoading, recalculate: recalculateScore } = useScore(token ?? undefined);

  // Debounced score recalc — waits 2s after a mutation so the backend has the new data
  const scoreRecalcTimer = useRef<ReturnType<typeof setTimeout>>();
  const debouncedRecalcScore = useCallback(() => {
    if (scoreRecalcTimer.current) clearTimeout(scoreRecalcTimer.current);
    scoreRecalcTimer.current = setTimeout(() => recalculateScore(), 2000);
  }, [recalculateScore]);

  // ────────── Notifications ──────────
  // Drives food reminders, pending-task alerts, and daily task-log reminder.
  useNotifications(ds.tasks, ds.food, ds.reminders, ds.synced);

  // ────────── Local state (used for UI, seeded from backend) ──────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [reminderItems, setReminderItems] = useState<ReminderItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // ────────── Sync from backend ──────────
  // When the hook delivers synced data, update local state.
  // We preserve local `expanded` flags so the UI doesn't collapse on sync.
  useEffect(() => {
    if (!ds.synced) return;
    setTasks((prev) => {
      const expandedIds = new Set(prev.filter((t) => t.expanded).map((t) => t.id));
      // Build a title lookup for resolving forkedFromTaskTitle
      const titleMap = new Map(ds.tasks.map((t) => [t.id, t.title]));
      return ds.tasks.map((t) => ({
        ...t,
        expanded: expandedIds.has(t.id) ? true : t.expanded,
        forkedFromTaskTitle: t.forkedFromTaskId
          ? titleMap.get(t.forkedFromTaskId) ?? "Parent Task"
          : undefined,
      }));
    });
  }, [ds.tasks, ds.synced]);

  useEffect(() => {
    if (!ds.synced) return;
    setFoodItems(ds.food);
  }, [ds.food, ds.synced]);

  useEffect(() => {
    if (!ds.synced) return;
    setReminderItems(ds.reminders);
  }, [ds.reminders, ds.synced]);

  useEffect(() => {
    if (!ds.synced) return;
    setGoals((prev) => {
      const expandedIds = new Set(prev.filter((g) => g.expanded).map((g) => g.id));
      return ds.goals.map((g) => ({
        ...g,
        expanded: expandedIds.has(g.id) ? true : g.expanded,
      }));
    });
  }, [ds.goals, ds.synced]);

  // ────────── Date filtering ──────────
  const selectedDateKey = dateToKey(selectedDate);

  const filteredTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === selectedDateKey),
    [tasks, selectedDateKey]
  );

  const filteredFood = useMemo(
    () => foodItems.filter((f) => f.dueDate === selectedDateKey),
    [foodItems, selectedDateKey]
  );

  const filteredReminders = useMemo(
    () => reminderItems.filter((r) => r.dueDate === selectedDateKey),
    [reminderItems, selectedDateKey]
  );

  // Compute set of dates that have pending (incomplete, non-dropped) tasks
  const pendingDates = useMemo(() => {
    const dates = new Set<string>();
    for (const task of tasks) {
      if (!task.completed && !task.dropped) {
        dates.add(task.dueDate);
      }
    }
    return dates;
  }, [tasks]);

  // ────────── Helper: capitalize first letter ──────────
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // ────────────────────────────────────────
  //  Task handlers
  // ────────────────────────────────────────

  const handleToggleExpand = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, expanded: !t.expanded } : t
        )
      );
    });
  };

  const handleComplete = (id: string) => {
    // Optimistic local update
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed: true, expanded: false } : t
        )
      );
    });
    // Send to backend via HTTP
    ds.updateStatus(id, "completed");
    debouncedRecalcScore();
  };

  const handleUncomplete = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed: false } : t
        )
      );
    });
    ds.updateStatus(id, "pending");
  };

  const handleSaveDelay = (id: string, reason: string, attachmentLink?: string) => {
    // Optimistic local update
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                delays: [
                  ...t.delays,
                  {
                    id: `d-${Date.now()}`,
                    reason,
                    rawDate: new Date().toISOString(),
                    date: new Date().toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }),
                    attachmentUri: attachmentLink,
                  },
                ],
              }
            : t
        )
      );
    });
    // Send to backend via HTTP
    ds.addDelay(id, reason, attachmentLink);
  };

  const handleDeleteTask = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });
    ds.deleteItem(id);
    debouncedRecalcScore();
  };

  const handleEditDelay = (taskId: string, delayId: string, newReason: string) => {
    // Optimistic local update
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                delays: t.delays.map((d) =>
                  d.id === delayId ? { ...d, reason: newReason } : d
                ),
              }
            : t
        )
      );
    });
    ds.updateDelay(delayId, newReason);
  };

  const handleDeleteDelay = (taskId: string, delayId: string) => {
    // Optimistic local update
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, delays: t.delays.filter((d) => d.id !== delayId) }
            : t
        )
      );
    });
    ds.deleteDelay(delayId);
  };

  const handleEditTask = (id: string, newTitle: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, title: newTitle } : t
        )
      );
    });
    ds.updateItem(id, newTitle);
  };

  const handleDropTask = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, dropped: true, expanded: false } : t
        )
      );
    });
    ds.updateStatus(id, "dropped");
    debouncedRecalcScore();
  };

  const handleUndropTask = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, dropped: false } : t
        )
      );
    });
    ds.updateStatus(id, "pending");
  };

  // ── Fork delay as a new task ──
  // Alert.alert multi-button callbacks don't work on React Native Web,
  // so we use an in-app modal instead.

  const [forkPending, setForkPending] = useState<{
    taskId: string;
    delayId: string;
    delayReason: string;
  } | null>(null);

  const [forkCalMonth, setForkCalMonth] = useState(new Date().getMonth());
  const [forkCalYear, setForkCalYear] = useState(new Date().getFullYear());
  const [forkSelectedDate, setForkSelectedDate] = useState<string | null>(null);

  const handleForkDelay = (taskId: string, delayId: string, delayReason: string) => {
    const now = new Date();
    setForkCalMonth(now.getMonth());
    setForkCalYear(now.getFullYear());
    setForkSelectedDate(null);
    setForkPending({ taskId, delayId, delayReason });
  };

  const executeFork = async (
    taskId: string,
    delayId: string,
    delayReason: string,
    targetDate: string
  ) => {
    // Find the parent task to get its title for the forked task reference
    const parentTask = tasks.find((t) => t.id === taskId);

    // Optimistic: mark delay as forked locally
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                delays: t.delays.map((d) =>
                  d.id === delayId ? { ...d, forkedTaskId: `fork-${Date.now()}` } : d
                ),
              }
            : t
        )
      );
    });

    // Optimistic: add the forked task locally
    const newForkedTask: Task = {
      id: `fork-${Date.now()}`,
      title: delayReason,
      date: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      dueDate: targetDate,
      priority: "medium",
      completed: false,
      delays: [],
      forkedFromTaskId: taskId,
      forkedFromTaskTitle: parentTask?.title ?? "Parent Task",
    };
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setTasks((prev) => [newForkedTask, ...prev]);
    });

    // Backend call + refresh to get real IDs
    const result = await ds.forkDelay(delayId, taskId, targetDate, "Medium");
    // Always refresh so real ROWIDs replace the optimistic temp IDs
    ds.refresh();
  };

  // ── Navigate to a task by ID (used for parent task navigation) ──

  const handleNavigateToTask = useCallback((taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    // Switch to Task tab, set date, and expand the task
    setActiveTab("Task");
    const [y, m, d] = target.dueDate.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));
    LayoutAnimation.configureNext(smoothSpring);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, expanded: true } : t))
    );
  }, [tasks]);

  // ────────────────────────────────────────
  //  Goal handlers
  // ────────────────────────────────────────

  const handleGoalToggleExpand = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, expanded: !g.expanded } : g
        )
      );
    });
  };

  const handleGoalComplete = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, completed: true, expanded: false } : g
        )
      );
    });
    ds.updateStatus(id, "completed");
    debouncedRecalcScore();
  };

  const handleGoalUncomplete = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, completed: false } : g
        )
      );
    });
    ds.updateStatus(id, "pending");
  };

  const handleGoalDelete = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    });
    ds.deleteItem(id);
    debouncedRecalcScore();
  };

  const handleGoalEdit = (id: string, newTitle: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, title: newTitle } : g
        )
      );
    });
    ds.updateItem(id, newTitle);
  };

  const handleGoalSaveDelay = (id: string, reason: string, attachmentLink?: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                delays: [
                  ...g.delays,
                  {
                    id: `d-${Date.now()}`,
                    reason,
                    rawDate: new Date().toISOString(),
                    date: new Date().toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }),
                    attachmentUri: attachmentLink,
                  },
                ],
              }
            : g
        )
      );
    });
    ds.addDelay(id, reason, attachmentLink);
  };

  const handleGoalEditDelay = (goalId: string, delayId: string, newReason: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                delays: g.delays.map((d) =>
                  d.id === delayId ? { ...d, reason: newReason } : d
                ),
              }
            : g
        )
      );
    });
    ds.updateDelay(delayId, newReason);
  };

  const handleGoalDeleteDelay = (goalId: string, delayId: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, delays: g.delays.filter((d) => d.id !== delayId) }
            : g
        )
      );
    });
    ds.deleteDelay(delayId);
  };

  // ────────────────────────────────────────
  //  Food handlers
  // ────────────────────────────────────────

  const handleFoodEdit = (id: string, newTitle: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setFoodItems((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, title: newTitle } : f
        )
      );
    });
    ds.updateItem(id, newTitle);
  };

  const handleFoodDelete = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setFoodItems((prev) => prev.filter((f) => f.id !== id));
    });
    ds.deleteItem(id);
  };

  // ────────────────────────────────────────
  //  Reminder handlers
  // ────────────────────────────────────────

  const handleRemindTask = (taskId: string, dateTime: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const now = new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
    const dueDate = dateTime.split("T")[0];
    const newReminder: ReminderItem = {
      id: `r-${Date.now()}`,
      title: task.title,
      recurrence: "once",
      reminderDateTime: dateTime,
      completed: false,
      date: now,
      dueDate,
    };
    LayoutAnimation.configureNext(smoothSpring);
    setReminderItems((prev) => [newReminder, ...prev]);
    // Show in-app toast with scheduled time
    const d = new Date(dateTime);
    const timeLabel = isNaN(d.getTime())
      ? dateTime
      : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    showReminderToast(`Reminder set for ${timeLabel}`);
    ds.addItem({
      itemType: "Reminder",
      itemTypeLevel: "once",
      itemContent: task.title,
      status: JSON.stringify({ reminderDateTime: dateTime, completed: false }),
      createdDate: dueDate,
    }).then(() => ds.refresh());
  };

  const handleReminderComplete = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setReminderItems((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, completed: !r.completed } : r
        )
      );
    });
    const item = reminderItems.find((r) => r.id === id);
    if (item) {
      const currentStatus = item.completed;
      let parsed: any = {};
      try { parsed = JSON.parse(item.snoozedUntil || "{}"); } catch { /* ignore */ }
      // We need to read the full status to toggle
      ds.updateStatus(id, JSON.stringify({
        reminderDateTime: item.reminderDateTime,
        completed: !currentStatus,
        snoozedUntil: item.snoozedUntil,
      }));
    }
  };

  const handleReminderDelete = (id: string) => {
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setReminderItems((prev) => prev.filter((r) => r.id !== id));
    });
    ds.deleteItem(id);
  };

  const handleReminderSnooze = (id: string, minutes: number) => {
    const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
    requestAnimationFrame(() => {
      LayoutAnimation.configureNext(smoothSpring);
      setReminderItems((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, snoozedUntil } : r
        )
      );
    });
    const item = reminderItems.find((r) => r.id === id);
    if (item) {
      ds.updateStatus(id, JSON.stringify({
        reminderDateTime: item.reminderDateTime,
        completed: false,
        snoozedUntil,
      }));
    }
  };

  // ────────────────────────────────────────
  //  Submit handler (adds to active tab)
  // ────────────────────────────────────────

  const handleSubmit = () => {
    if (!inputText.trim()) return;

    const now = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    LayoutAnimation.configureNext(smoothSpring);

    const dateKey = dateToKey(selectedDate);

    if (activeTab === "Task") {
      // Optimistic local add
      const newTask: Task = {
        id: Date.now().toString(),
        title: inputText.trim(),
        date: now,
        dueDate: dateKey,
        priority: selectedPriority,
        completed: false,
        delays: [],
      };
      setTasks((prev) => [newTask, ...prev]);

      // Send to backend, then refresh so real ROWID + date format replace the optimistic item
      ds.addItem({
        itemType: "Task",
        itemTypeLevel: capitalize(selectedPriority),
        itemContent: inputText.trim(),
        status: "pending",
        createdDate: dateKey,
      }).then(() => ds.refresh());
    } else if (activeTab === "Food") {
      const newFood: FoodItem = {
        id: `f-${Date.now()}`,
        title: inputText.trim(),
        meal: selectedMeal,
        date: now,
        dueDate: dateKey,
      };
      setFoodItems((prev) => [newFood, ...prev]);

      ds.addItem({
        itemType: "Food",
        itemTypeLevel: selectedMeal,
        itemContent: inputText.trim(),
        status: null,
        createdDate: dateKey,
      }).then(() => ds.refresh());
    } else if (activeTab === "Reminder") {
      // Parse natural language to extract title, date and time
      const parsed = parseNaturalReminder(inputText.trim());
      const dt = parsed.dateTime ?? formatLocalReminderDateTime(new Date(Date.now() + 3600_000));
      const reminderTitle = parsed.title || inputText.trim();
      const dueDate = dt.split("T")[0];
      const newReminder: ReminderItem = {
        id: `r-${Date.now()}`,
        title: reminderTitle,
        recurrence: selectedRecurrence,
        reminderDateTime: dt,
        completed: false,
        date: now,
        dueDate,
      };
      setReminderItems((prev) => [newReminder, ...prev]);
      // Show in-app toast with scheduled time
      const previewLabel = parsed.preview ?? (() => {
        const d = new Date(dt);
        return isNaN(d.getTime()) ? dt : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      })();
      showReminderToast(`Reminder set • ${previewLabel}`);

      ds.addItem({
        itemType: "Reminder",
        itemTypeLevel: selectedRecurrence,
        itemContent: reminderTitle,
        status: JSON.stringify({ reminderDateTime: dt, completed: false }),
        createdDate: dueDate,
      }).then(() => ds.refresh());

      setSelectedRecurrence("once");
    } else if (activeTab === "Goal") {
      const newGoal: Goal = {
        id: `g-${Date.now()}`,
        title: inputText.trim(),
        date: now,
        priority: selectedPriority,
        completed: false,
        delays: [],
      };
      setGoals((prev) => [newGoal, ...prev]);

      ds.addItem({
        itemType: "Goal",
        itemTypeLevel: capitalize(selectedPriority),
        itemContent: inputText.trim(),
        status: "pending",
        createdDate: null, // Goals are not date-filtered
      }).then(() => ds.refresh());
    }

    setInputText("");
    setSelectedPriority("medium");
    Keyboard.dismiss();
    debouncedRecalcScore();
  };

  const handleAttach = () => {
    console.log("Attach file");
  };

  // ────────────────────────────────────────
  //  Search navigation handlers
  // ────────────────────────────────────────

  const handleSearchSelectTask = useCallback((task: Task) => {
    const [y, m, d] = task.dueDate.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));
    setActiveTab("Task");
    LayoutAnimation.configureNext(smoothSpring);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, expanded: true } : t))
    );
  }, []);

  const handleSearchSelectFood = useCallback((item: FoodItem) => {
    const [y, m, d] = item.dueDate.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));
    setActiveTab("Food");
  }, []);

  const handleSearchSelectReminder = useCallback((item: ReminderItem) => {
    const [y, m, d] = item.dueDate.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));
    setActiveTab("Reminder");
  }, []);

  const handleSearchSelectGoal = useCallback((goal: Goal) => {
    setActiveTab("Goal");
    LayoutAnimation.configureNext(smoothSpring);
    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? { ...g, expanded: true } : g))
    );
  }, []);

  // ────────────────────────────────────────
  //  Render active list
  // ────────────────────────────────────────

  const renderActiveList = () => {
    switch (activeTab) {
      case "Task":
        return (
          <TaskList
            tasks={filteredTasks}
            allTasks={tasks}
            onToggleExpand={handleToggleExpand}
            onComplete={handleComplete}
            onSaveDelay={handleSaveDelay}
            onDelete={handleDeleteTask}
            onEditDelay={handleEditDelay}
            onDeleteDelay={handleDeleteDelay}
            onUncomplete={handleUncomplete}
            onEdit={handleEditTask}
            onDrop={handleDropTask}
            onUndrop={handleUndropTask}
            onForkDelay={handleForkDelay}
            onNavigateToTask={handleNavigateToTask}
            onRemind={handleRemindTask}
            authToken={token ?? undefined}
            refreshing={ds.refreshing}
            onRefresh={ds.refresh}
          />
        );
      case "Food":
        return (
          <FoodList
            items={filteredFood}
            refreshing={ds.refreshing}
            onRefresh={ds.refresh}
            onEdit={handleFoodEdit}
            onDelete={handleFoodDelete}
          />
        );
      case "Reminder":
        return (
          <ReminderList
            items={filteredReminders}
            allItems={reminderItems}
            refreshing={ds.refreshing}
            onRefresh={ds.refresh}
            onComplete={handleReminderComplete}
            onDelete={handleReminderDelete}
            onSnooze={handleReminderSnooze}
          />
        );
      case "Goal":
        return (
          <GoalList
            goals={goals}
            authToken={token ?? undefined}
            onToggleExpand={handleGoalToggleExpand}
            onComplete={handleGoalComplete}
            onUncomplete={handleGoalUncomplete}
            onDelete={handleGoalDelete}
            onEdit={handleGoalEdit}
            onSaveDelay={handleGoalSaveDelay}
            onEditDelay={handleGoalEditDelay}
            onDeleteDelay={handleGoalDeleteDelay}
            refreshing={ds.refreshing}
            onRefresh={ds.refresh}
          />
        );
    }
  };

  // Goal tab doesn't use calendar
  const showCalendar = activeTab !== "Goal";

  // Placeholder text per tab
  const placeholders: Record<TabName, string> = {
    Task: "Add a new task…",
    Food: "Log a food item…",
    Reminder: "e.g. Buy milk today 7pm…",
    Goal: "Add a new goal…",
  };

  // Compute selector options based on active tab
  const selectorOptions =
    activeTab === "Food"
      ? (MEAL_SECTIONS as unknown as string[])
      : undefined;

  const selectedOption =
    activeTab === "Food"
      ? selectedMeal
      : undefined;

  const handleOptionChange = (option: string) => {
    if (activeTab === "Food") {
      setSelectedMeal(option as MealType);
    }
  };

  const selectorLabel =
    activeTab === "Food" ? "Meal" : undefined;

  // ────────── Auth guard (after all hooks) ──────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD900" style={{ flex: 1 }} />
      </View>
    );
  }
  if (!user || !token) {
    return <Redirect href={"/login" as Href} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCalendarPress={() => setCalendarVisible(true)}
        onSearchPress={() => setSearchVisible(true)}
        selectedDate={selectedDate}
        onLogoPress={() => setProfileVisible(true)}
        score={score}
        tier={tier}
        scoreLoading={scoreLoading}
      />
      {renderActiveList()}
      <BottomInputBar
        ref={inputBarRef}
        value={inputText}
        onChangeText={setInputText}
        onSubmit={handleSubmit}
        onAttach={handleAttach}
        placeholder={placeholders[activeTab]}
        showPriority={activeTab === "Task" || activeTab === "Goal"}
        selectedPriority={selectedPriority}
        onPriorityChange={setSelectedPriority}
        selectorOptions={selectorOptions}
        selectedOption={selectedOption}
        onOptionChange={handleOptionChange}
        selectorLabel={selectorLabel}
        showReminder={activeTab === "Reminder"}
        selectedRecurrence={selectedRecurrence}
        onRecurrenceChange={setSelectedRecurrence}
      />
      {showCalendar && (
        <CalendarDropdown
          visible={calendarVisible}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setCalendarVisible(false);
          }}
          onClose={() => setCalendarVisible(false)}
          pendingDates={pendingDates}
        />
      )}
      <ProfilePanel
        visible={profileVisible}
        firstName={user?.firstName ?? ""}
        lastName={user?.lastName ?? ""}
        email={user?.email ?? ""}
        onClose={() => setProfileVisible(false)}
        onLogout={logout}
        onOpenTravel={() => router.push("/travel")}
      />
      <SearchOverlay
        visible={searchVisible}
        initialSection={activeTab}
        tasks={tasks}
        foodItems={foodItems}
        reminderItems={reminderItems}
        goals={goals}
        onClose={() => setSearchVisible(false)}
        onSelectTask={handleSearchSelectTask}
        onSelectFood={handleSearchSelectFood}
        onSelectReminder={handleSearchSelectReminder}
        onSelectGoal={handleSearchSelectGoal}
      />

      {/* ── Fork date picker modal ── */}
      {forkPending && (() => {
        const today = new Date();
        const todayKey = dateToKey(today);
        const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const daysInMonth = new Date(forkCalYear, forkCalMonth + 1, 0).getDate();
        const firstDay = new Date(forkCalYear, forkCalMonth, 1).getDay();
        const cells: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        return (
          <View style={styles.forkModalOverlay}>
            <View style={styles.forkModal}>
              <Text style={styles.forkModalTitle}>Fork as Task</Text>
              <Text style={styles.forkModalSubtitle} numberOfLines={2}>
                "{forkPending.delayReason}"
              </Text>
              <Text style={styles.forkModalLabel}>Pick a date for the new task:</Text>
              {/* Calendar nav */}
              <View style={styles.forkCalNav}>
                <TouchableOpacity onPress={() => {
                  if (forkCalMonth === 0) { setForkCalMonth(11); setForkCalYear(forkCalYear - 1); }
                  else setForkCalMonth(forkCalMonth - 1);
                }} activeOpacity={0.7}>
                  <Text style={styles.forkCalNavArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.forkCalNavTitle}>{MONTHS[forkCalMonth]} {forkCalYear}</Text>
                <TouchableOpacity onPress={() => {
                  if (forkCalMonth === 11) { setForkCalMonth(0); setForkCalYear(forkCalYear + 1); }
                  else setForkCalMonth(forkCalMonth + 1);
                }} activeOpacity={0.7}>
                  <Text style={styles.forkCalNavArrow}>›</Text>
                </TouchableOpacity>
              </View>
              {/* Day headers */}
              <View style={styles.forkCalRow}>
                {DAYS.map((d) => (
                  <Text key={d} style={styles.forkCalDayHeader}>{d}</Text>
                ))}
              </View>
              {/* Day cells */}
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
                <View key={row} style={styles.forkCalRow}>
                  {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                    if (day === null) return <View key={`e${col}`} style={styles.forkCalCell} />;
                    const cellDate = new Date(forkCalYear, forkCalMonth, day);
                    const cellKey = dateToKey(cellDate);
                    const isPast = cellKey < todayKey;
                    const isToday = cellKey === todayKey;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.forkCalCell,
                          isToday && styles.forkCalCellToday,
                          forkSelectedDate === cellKey && styles.forkCalCellSelected,
                        ]}
                        disabled={isPast}
                        activeOpacity={0.7}
                        onPress={() => setForkSelectedDate(cellKey)}
                      >
                        <Text style={[
                          styles.forkCalCellText,
                          isPast && styles.forkCalCellTextPast,
                          isToday && !forkSelectedDate && styles.forkCalCellTextToday,
                          forkSelectedDate === cellKey && styles.forkCalCellTextSelected,
                        ]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              {/* Confirm + Cancel */}
              <TouchableOpacity
                style={[styles.forkModalConfirm, !forkSelectedDate && styles.forkModalConfirmDisabled]}
                activeOpacity={0.7}
                disabled={!forkSelectedDate}
                onPress={() => {
                  if (!forkSelectedDate) return;
                  const pending = forkPending;
                  setForkPending(null);
                  executeFork(pending.taskId, pending.delayId, pending.delayReason, forkSelectedDate);
                }}
              >
                <Text style={[styles.forkModalConfirmText, !forkSelectedDate && styles.forkModalConfirmTextDisabled]}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.forkModalCancel}
                activeOpacity={0.7}
                onPress={() => setForkPending(null)}
              >
                <Text style={styles.forkModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* ── In-app reminder creation toast ── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBanner,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  toastBanner: {
    position: "absolute",
    top: 56,
    alignSelf: "center",
    backgroundColor: "#111827",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 9,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  forkModalOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  forkModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 360,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  forkModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  forkModalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
  },
  forkModalLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#9CA3AF",
    marginTop: 4,
  },
  forkCalNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 2,
  },
  forkCalNavArrow: {
    fontSize: 22,
    fontWeight: "600",
    color: "#374151",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  forkCalNavTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  forkCalRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  forkCalDayHeader: {
    width: 36,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  forkCalCell: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  forkCalCellToday: {
    backgroundColor: "#FDE68A",
  },
  forkCalCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  forkCalCellTextPast: {
    color: "#D1D5DB",
  },
  forkCalCellTextToday: {
    color: "#92400E",
    fontWeight: "800",
  },
  forkCalCellSelected: {
    backgroundColor: "#F59E0B",
  },
  forkCalCellTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  forkModalConfirm: {
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  forkModalConfirmDisabled: {
    backgroundColor: "#E5E7EB",
  },
  forkModalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  forkModalConfirmTextDisabled: {
    color: "#9CA3AF",
  },
  forkModalCancel: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 2,
  },
  forkModalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
});
