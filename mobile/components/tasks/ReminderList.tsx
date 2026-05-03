import { AppColors } from "@/constants/colors";
import { ReminderItem, parseReminderDateTime } from "@/constants/tasks";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ReminderCard from "./ReminderCard";

interface ReminderListProps {
  items: ReminderItem[];      // date-filtered reminders
  allItems: ReminderItem[];   // all reminders across all dates
  refreshing?: boolean;
  onRefresh?: () => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSnooze?: (id: string, minutes: number) => void;
}

export default function ReminderList({
  items,
  allItems,
  refreshing,
  onRefresh,
  onComplete,
  onDelete,
  onSnooze,
}: ReminderListProps) {
  const [showAll, setShowAll] = useState(false);

  const sourceItems = showAll ? allItems : items;
  const active = sourceItems.filter((r) => !r.completed);
  const completed = sourceItems.filter((r) => r.completed);

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

  const totalCount = allItems.filter((r) => !r.completed).length;

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
      {sourceItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={40} color={AppColors.gray300} />
          <Text style={styles.emptyTitle}>No reminders</Text>
          <Text style={styles.emptySubtitle}>
            {showAll ? "No reminders at all" : "None for this date — tap the badge to see all"}
          </Text>
        </View>
      ) : (
        <>
          {active.length > 0 && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionTitleRow}
                onPress={() => setShowAll((v) => !v)}
                activeOpacity={0.6}
              >
                <Text style={styles.sectionTitle}>
                  {showAll ? `All Upcoming (${active.length})` : `Upcoming · ${active.length}`}
                </Text>
                <View style={[styles.badge, showAll && styles.badgeActive]}>
                  <Text style={[styles.badgeText, showAll && styles.badgeTextActive]}>
                    {showAll ? "Date view" : `${totalCount} total`}
                  </Text>
                </View>
              </TouchableOpacity>
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
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  Done · {completed.length}
                </Text>
              </View>
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
    backgroundColor: AppColors.white,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 32,
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
    gap: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: AppColors.textSecondary,
  },
  badge: {
    backgroundColor: AppColors.gray100,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeActive: {
    backgroundColor: AppColors.primarySolid,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textSecondary,
    letterSpacing: 0.3,
  },
  badgeTextActive: {
    color: AppColors.textPrimary,
  },
  cardList: {
    gap: 12,
  },
});
