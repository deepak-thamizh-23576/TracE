import { AppColors } from "@/constants/colors";
import { Goal } from "@/constants/tasks";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PriorityDot from "./PriorityDot";

interface CompletedGoalCardProps {
  goal: Goal;
  onUncomplete?: () => void;
}

export default function CompletedGoalCard({ goal, onUncomplete }: CompletedGoalCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.checkboxDone}
          onPress={onUncomplete}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.checkmark}>✓</Text>
        </TouchableOpacity>
        <View style={styles.content}>
          <Text style={styles.title}>{goal.title}</Text>
          <Text style={styles.date}>{goal.date}</Text>
        </View>
        <PriorityDot priority={goal.priority} />
      </View>
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
});
