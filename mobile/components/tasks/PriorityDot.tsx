import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppColors } from "@/constants/colors";
import { Priority } from "@/constants/tasks";

const PRIORITY_COLORS: Record<Priority, string> = {
  high: AppColors.priorityHigh,
  medium: AppColors.priorityMedium,
  low: AppColors.priorityLow,
};

interface PriorityDotProps {
  priority: Priority;
}

export default function PriorityDot({ priority }: PriorityDotProps) {
  return (
    <View
      style={[styles.dot, { backgroundColor: PRIORITY_COLORS[priority] }]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 9999,
  },
});
