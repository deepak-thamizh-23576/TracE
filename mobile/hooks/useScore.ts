/**
 * useScore — Computes and tracks the rolling 7-day activity score.
 *
 * Calls POST /score/calculate on mount and exposes `recalculate`
 * so callers can trigger a refresh after mutations.
 */

import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";

// ──────────── API base URL (mirrors useBackend.ts) ────────────

const DEPLOYED_BASE =
  "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function";

const LOCAL_PORT = process.env.EXPO_PUBLIC_LOCAL_PORT ?? "3000";

function getLocalBase(): string {
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

const USE_LOCAL = __DEV__;
const API_BASE = USE_LOCAL ? getLocalBase() : DEPLOYED_BASE;

// ──────────── Types ────────────

export interface ScoreBreakdown {
  tasksAdded: number;
  tasksCompleted: number;
  highPriorityCompleted: number;
  goalsCompleted: number;
  foodLogged: number;
  fullMealDays: number;
  remindersCompleted: number;
  emptyTaskDays: number;
  emptyFoodDays: number;
  staleTasks: number;
  droppedTasks: number;
  totalPositive: number;
  totalNegative: number;
}

export interface ScoreResult {
  score: number;
  tier: "On Fire" | "Good" | "Needs Work" | "Slipping";
  breakdown: ScoreBreakdown;
}

// ──────────── Hook ────────────

export function useScore(token: string | undefined) {
  const [data, setData] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/score/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TE-Token": token,
        },
      });
      if (!res.ok) {
        console.error("Score calc failed:", res.status);
        return;
      }
      const json: ScoreResult = await res.json();
      setData(json);
    } catch (e) {
      console.error("Score calc error:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Calculate on mount (once token is available)
  useEffect(() => {
    calculate();
  }, [calculate]);

  return {
    score: data?.score ?? null,
    tier: data?.tier ?? null,
    breakdown: data?.breakdown ?? null,
    loading,
    recalculate: calculate,
  };
}
