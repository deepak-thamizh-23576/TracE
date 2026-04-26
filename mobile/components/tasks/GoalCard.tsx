import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { AppColors } from "@/constants/colors";
import { Goal } from "@/constants/tasks";
import PriorityDot from "./PriorityDot";

interface GoalCardProps {
  goal: Goal;
  onPress?: () => void;
  onComplete?: () => void;
}

export default function GoalCard({ goal, onPress, onComplete }: GoalCardProps) {
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
        <Text style={styles.title}>{goal.title}</Text>
        <Text style={styles.date}>{goal.date}</Text>
      </View>
      <PriorityDot priority={goal.priority} />
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
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  date: {
    fontSize: 10,
    color: AppColors.gray400,
    marginTop: 2,
  },
});
