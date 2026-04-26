import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { AppColors } from "@/constants/colors";
import { Task } from "@/constants/tasks";
import { Ionicons } from "@expo/vector-icons";
import PriorityDot from "./PriorityDot";

function formatDueDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface TaskCardProps {
  task: Task;
  onPress?: () => void;
  onComplete?: () => void;
  onNavigateToParent?: (parentTaskId: string) => void;
  dueDateLabel?: string; // YYYY-MM-DD — shown as a pill in all-pending mode
}

export default function TaskCard({ task, onPress, onComplete, onNavigateToParent, dueDateLabel }: TaskCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={styles.checkbox}
        onPress={onComplete}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{task.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.date}>{task.date}</Text>
          {dueDateLabel && (
            <View style={styles.dueDatePill}>
              <Text style={styles.dueDateText}>{formatDueDate(dueDateLabel)}</Text>
            </View>
          )}
          {task.forkedFromTaskId && (
            <TouchableOpacity
              style={styles.forkedFromPill}
              onPress={() => onNavigateToParent?.(task.forkedFromTaskId!)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Ionicons name="git-branch-outline" size={10} color={AppColors.primarySolid} />
              <Text style={styles.forkedFromText}>Forked</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <PriorityDot priority={task.priority} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: AppColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.gray100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AppColors.gray200,
  },
  content: {
    flex: 1,
    marginLeft: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  date: {
    fontSize: 10,
    color: AppColors.gray400,
  },
  dueDatePill: {
    backgroundColor: AppColors.primarySolid,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dueDateText: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  forkedFromPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: AppColors.gray100,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  forkedFromText: {
    fontSize: 9,
    fontWeight: "700",
    color: AppColors.textSecondary,
  },
});
