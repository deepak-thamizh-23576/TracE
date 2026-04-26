import { AppColors } from "@/constants/colors";
import { Goal } from "@/constants/tasks";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import CompletedGoalCard from "./CompletedGoalCard";
import ExpandedGoalCard from "./ExpandedGoalCard";
import GoalCard from "./GoalCard";

interface GoalListProps {
  goals: Goal[];
  authToken?: string;
  onToggleExpand: (id: string) => void;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  onSaveDelay: (id: string, reason: string, attachmentLink?: string) => void;
  onEditDelay: (goalId: string, delayId: string, newReason: string) => void;
  onDeleteDelay: (goalId: string, delayId: string) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function GoalList({
  goals,
  authToken,
  onToggleExpand,
  onComplete,
  onUncomplete,
  onDelete,
  onEdit,
  onSaveDelay,
  onEditDelay,
  onDeleteDelay,
  refreshing,
  onRefresh,
}: GoalListProps) {
  const pendingGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {/* Pending section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending</Text>
        <View style={styles.cardList}>
          {pendingGoals.map((goal) =>
            goal.expanded ? (
              <ExpandedGoalCard
                key={goal.id}
                goal={goal}
                authToken={authToken}
                onComplete={() => onComplete(goal.id)}
                onCollapse={() => onToggleExpand(goal.id)}
                onDelete={() => onDelete(goal.id)}
                onEdit={(newTitle) => onEdit(goal.id, newTitle)}
                onSaveDelay={(reason, attachmentLink) => onSaveDelay(goal.id, reason, attachmentLink)}
                onEditDelay={(delayId, newReason) => onEditDelay(goal.id, delayId, newReason)}
                onDeleteDelay={(delayId) => onDeleteDelay(goal.id, delayId)}
              />
            ) : (
              <GoalCard
                key={goal.id}
                goal={goal}
                onPress={() => onToggleExpand(goal.id)}
                onComplete={() => onComplete(goal.id)}
              />
            )
          )}
          {pendingGoals.length === 0 && (
            <Text style={styles.emptyText}>No pending goals</Text>
          )}
        </View>
      </View>

      {/* Completed section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Completed</Text>
        <View style={[styles.cardList, { opacity: 0.8 }]}>
          {completedGoals.map((goal) => (
            <CompletedGoalCard
              key={goal.id}
              goal={goal}
              onUncomplete={() => onUncomplete(goal.id)}
            />
          ))}
          {completedGoals.length === 0 && (
            <Text style={styles.emptyText}>No completed goals</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: AppColors.white,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 32,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: AppColors.textSecondary,
    paddingHorizontal: 4,
  },
  cardList: {
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.gray400,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 16,
  },
});
