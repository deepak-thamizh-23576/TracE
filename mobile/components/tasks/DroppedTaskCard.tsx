import { AppColors } from "@/constants/colors";
import { Task } from "@/constants/tasks";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PriorityDot from "./PriorityDot";
import LinkText from "./LinkText";

interface DroppedTaskCardProps {
  task: Task;
  onRestore?: () => void;
  onDelete?: () => void;
}

export default function DroppedTaskCard({ task, onRestore, onDelete }: DroppedTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDelays = task.delays.length > 0;

  return (
    <View style={styles.container}>
      {/* Top row */}
      <TouchableOpacity
        style={styles.topRow}
        onPress={() => hasDelays && setExpanded((prev) => !prev)}
        activeOpacity={hasDelays ? 0.7 : 1}
      >
        {/* Drop indicator icon */}
        <View style={styles.dropIcon}>
          <MaterialIcons name="block" size={14} color={AppColors.gray400} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.date}>{task.date}</Text>
        </View>

        {hasDelays && (
          <View style={styles.delayBadge}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={AppColors.gray400}
            />
            <Text style={styles.delayBadgeText}>{task.delays.length}</Text>
          </View>
        )}
        <PriorityDot priority={task.priority} />
      </TouchableOpacity>

      {/* Delay history (read-only) */}
      {expanded && hasDelays && (
        <View style={styles.delaySection}>
          <Text style={styles.threadTitle}>Delay History</Text>
          {task.delays.map((delay, index) => (
            <View key={delay.id} style={styles.threadEntry}>
              <View style={styles.threadLineColumn}>
                <View style={styles.threadDot} />
                {index < task.delays.length - 1 && (
                  <View style={styles.threadLine} />
                )}
              </View>
              <View style={styles.threadContent}>
                <Text style={styles.threadDate}>{delay.date}</Text>
                <View style={styles.delayCard}>
                  <View style={styles.delayCardContent}>
                    {delay.attachmentUri && (
                      <View style={styles.attachmentThumb}>
                        <Image
                          source={{ uri: delay.attachmentUri }}
                          style={styles.attachmentImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                    <View style={styles.delayReasonContainer}>
                      <LinkText text={delay.reason} style={styles.delayReasonText} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Restore / Delete actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={onRestore}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={13} color={AppColors.textSecondary} />
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="delete-outline" size={13} color={AppColors.red500} />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    opacity: 0.7,
  },
  dropIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AppColors.gray300,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.gray100,
  },
  content: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.gray400,
    textDecorationLine: "line-through",
  },
  date: {
    fontSize: 10,
    color: AppColors.gray300,
    marginTop: 2,
  },
  delayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.gray100,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  delayBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: AppColors.gray400,
  },
  // ── Delay history ──
  delaySection: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray200,
    backgroundColor: AppColors.gray50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 0,
  },
  threadTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  threadEntry: {
    flexDirection: "row",
    minHeight: 44,
  },
  threadLineColumn: {
    width: 20,
    alignItems: "center",
  },
  threadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.gray300,
    marginTop: 4,
  },
  threadLine: {
    width: 2,
    flex: 1,
    backgroundColor: AppColors.gray200,
    marginTop: 4,
  },
  threadContent: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 12,
  },
  threadDate: {
    fontSize: 10,
    color: AppColors.gray300,
    marginBottom: 4,
  },
  delayCard: {
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 8,
    padding: 10,
  },
  delayCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  attachmentThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: AppColors.gray100,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  attachmentImage: {
    width: "100%",
    height: "100%",
    opacity: 0.6,
  },
  delayReasonContainer: {
    flex: 1,
    flexShrink: 1,
  },
  delayReasonText: {
    fontSize: 12,
    color: AppColors.gray400,
  },
  // ── Action row ──
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  restoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.red50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.red100,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.red500,
  },
});
