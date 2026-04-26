import { AppColors } from "@/constants/colors";
import { Task } from "@/constants/tasks";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PriorityDot from "./PriorityDot";

interface CompletedTaskCardProps {
  task: Task;
  onUncomplete?: () => void;
}

export default function CompletedTaskCard({ task, onUncomplete }: CompletedTaskCardProps) {
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
        <TouchableOpacity
          style={styles.checkboxDone}
          onPress={onUncomplete}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.checkmark}>✓</Text>
        </TouchableOpacity>
        <View style={styles.content}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.date}>{task.date}</Text>
        </View>
        {hasDelays && (
          <View style={styles.delayBadge}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={AppColors.textSecondary}
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
              {/* Thread line connector */}
              <View style={styles.threadLineColumn}>
                <View style={styles.threadDot} />
                {index < task.delays.length - 1 && (
                  <View style={styles.threadLine} />
                )}
              </View>

              {/* Delay content */}
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
                      <Text style={styles.delayReasonText}>
                        {delay.reason}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(249,250,251,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.gray100,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  checkboxDone: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: AppColors.primarySolid,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  content: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "line-through",
    color: AppColors.gray400,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  delayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: AppColors.textSecondary,
  },
  // --- Delay history section ---
  delaySection: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    padding: 16,
    paddingTop: 12,
  },
  threadTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  threadEntry: {
    flexDirection: "row",
    minHeight: 48,
  },
  threadLineColumn: {
    width: 20,
    alignItems: "center",
  },
  threadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    paddingBottom: 16,
  },
  threadDate: {
    fontSize: 10,
    color: AppColors.gray400,
    marginBottom: 6,
  },
  delayCard: {
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 8,
    padding: 12,
  },
  delayCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    overflow: "hidden",
  },
  attachmentThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: AppColors.gray100,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  attachmentImage: {
    width: "100%",
    height: "100%",
    opacity: 0.8,
  },
  delayReasonContainer: {
    flex: 1,
    overflow: "hidden",
  },
  delayReasonText: {
    fontSize: 13,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
});
