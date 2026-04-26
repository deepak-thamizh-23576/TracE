import { AppColors } from "@/constants/colors";
import { Task } from "@/constants/tasks";
import React, { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import CompletedTaskCard from "./CompletedTaskCard";
import DroppedTaskCard from "./DroppedTaskCard";
import ExpandedTaskCard from "./ExpandedTaskCard";
import TaskCard from "./TaskCard";

interface TaskListProps {
  tasks: Task[];          // date-filtered tasks
  allTasks: Task[];       // all tasks (for "show all pending" mode)
  onToggleExpand: (id: string) => void;
  onComplete: (id: string) => void;
  onSaveDelay: (id: string, reason: string, attachmentLink?: string) => void;
  onDelete: (id: string) => void;
  onEditDelay: (taskId: string, delayId: string, newReason: string) => void;
  onDeleteDelay: (taskId: string, delayId: string) => void;
  onUncomplete: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  onDrop: (id: string) => void;
  onUndrop: (id: string) => void;
  onForkDelay: (taskId: string, delayId: string, delayReason: string) => void;
  onNavigateToTask: (taskId: string) => void;
  authToken?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function TaskList({ tasks, allTasks, onToggleExpand, onComplete, onSaveDelay, onDelete, onEditDelay, onDeleteDelay, onUncomplete, onEdit, onDrop, onUndrop, onForkDelay, onNavigateToTask, authToken, refreshing, onRefresh }: TaskListProps) {
  const [showAllPending, setShowAllPending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function handleDelayFocus() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }

  // In "all pending" mode: every active (not completed, not dropped) task across all dates
  const allPendingTasks = allTasks
    .filter((t) => !t.completed && !t.dropped)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const pendingTasks = showAllPending
    ? allPendingTasks
    : tasks.filter((t) => !t.completed && !t.dropped);
  const completedTasks = tasks.filter((t) => t.completed);
  const droppedTasks = tasks.filter((t) => t.dropped);

  const pendingCount = allTasks.filter((t) => !t.completed && !t.dropped).length;

  return (
    <ScrollView
      ref={scrollRef}
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
        <TouchableOpacity
          style={styles.sectionTitleRow}
          onPress={() => setShowAllPending((v) => !v)}
          activeOpacity={0.6}
        >
          <Text style={styles.sectionTitle}>
            {showAllPending ? `All Pending (${allPendingTasks.length})` : "Pending"}
          </Text>
          <View style={[styles.allPendingBadge, showAllPending && styles.allPendingBadgeActive]}>
            <Text style={[styles.allPendingBadgeText, showAllPending && styles.allPendingBadgeTextActive]}>
              {showAllPending ? "Date view" : `${pendingCount} total`}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.cardList}>
          {pendingTasks.map((task) =>
            task.expanded ? (
              <ExpandedTaskCard
                key={task.id}
                task={task}
                authToken={authToken}
                onComplete={() => onComplete(task.id)}
                onCollapse={() => onToggleExpand(task.id)}
                onSaveDelay={(reason, attachmentLink) => onSaveDelay(task.id, reason, attachmentLink)}
                onDelete={() => onDelete(task.id)}
                onEditDelay={(delayId, newReason) => onEditDelay(task.id, delayId, newReason)}
                onDeleteDelay={(delayId) => onDeleteDelay(task.id, delayId)}
                onEdit={(newTitle) => onEdit(task.id, newTitle)}
                onDrop={() => onDrop(task.id)}
                onDelayFocus={handleDelayFocus}
                onForkDelay={(delayId, delayReason) => onForkDelay(task.id, delayId, delayReason)}
                onNavigateToParent={(parentId) => onNavigateToTask(parentId)}
                dueDateLabel={showAllPending ? task.dueDate : undefined}
              />
            ) : (
              <TaskCard
                key={task.id}
                task={task}
                onPress={() => onToggleExpand(task.id)}
                onComplete={() => onComplete(task.id)}
                onNavigateToParent={(parentId) => onNavigateToTask(parentId)}
                dueDateLabel={showAllPending ? task.dueDate : undefined}
              />
            )
          )}
        </View>
      </View>

      {/* Completed section — only shown in date view */}
      {!showAllPending && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed</Text>
          <View style={[styles.cardList, { opacity: 0.8 }]}>
            {completedTasks.map((task) => (
              <CompletedTaskCard
                key={task.id}
                task={task}
                onUncomplete={() => onUncomplete(task.id)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Dropped section — only shown in date view */}
      {!showAllPending && droppedTasks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dropped</Text>
          <View style={styles.cardList}>
            {droppedTasks.map((task) => (
              <DroppedTaskCard
                key={task.id}
                task={task}
                onRestore={() => onUndrop(task.id)}
                onDelete={() => onDelete(task.id)}
              />
            ))}
          </View>
        </View>
      )}
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
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  allPendingBadge: {
    backgroundColor: AppColors.gray100,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  allPendingBadgeActive: {
    backgroundColor: AppColors.primarySolid,
  },
  allPendingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textSecondary,
    letterSpacing: 0.3,
  },
  allPendingBadgeTextActive: {
    color: AppColors.textPrimary,
  },
  cardList: {
    gap: 12,
  },
});
