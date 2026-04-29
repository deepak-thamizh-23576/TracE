import { AppColors } from "@/constants/colors";
import { ReminderItem, parseReminderDateTime } from "@/constants/tasks";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReminderCard from "./ReminderCard";

interface ReminderListProps {
  items: ReminderItem[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSnooze?: (id: string, minutes: number) => void;
}

export default function ReminderList({
  items,
  refreshing,
  onRefresh,
  onComplete,
  onDelete,
  onSnooze,
}: ReminderListProps) {
  const active = items.filter((r) => !r.completed);
  const completed = items.filter((r) => r.completed);

  // Sort: overdue first, then by reminderDateTime ascending
  const now = Date.now();
  active.sort((a, b) => {
    const aTime = parseReminderDateTime(a.snoozedUntil || a.reminderDateTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = parseReminderDateTime(b.snoozedUntil || b.reminderDateTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const aOverdue = aTime < now ? 0 : 1;
    const bOverdue = bTime < now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return aTime - bTime;
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={40} color={AppColors.gray300} />
          <Text style={styles.emptyTitle}>No reminders</Text>
          <Text style={styles.emptySubtitle}>
            Add a reminder using the input below
          </Text>
        </View>
      ) : (
        <>
          {active.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Upcoming · {active.length}
              </Text>
              <View style={styles.cardList}>
                {active.map((item) => (
                  <ReminderCard
                    key={item.id}
                    item={item}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onSnooze={onSnooze}
                  />
                ))}
              </View>
            </View>
          )}
          {completed.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Done · {completed.length}
              </Text>
              <View style={styles.cardList}>
                {completed.map((item) => (
                  <ReminderCard
                    key={item.id}
                    item={item}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onSnooze={onSnooze}
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.gray400,
  },
  emptySubtitle: {
    fontSize: 12,
    color: AppColors.gray400,
    textAlign: "center",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: AppColors.gray400,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardList: {
    gap: 8,
  },
});
