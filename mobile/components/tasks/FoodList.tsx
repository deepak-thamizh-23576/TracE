import { AppColors } from "@/constants/colors";
import { FoodItem, MEAL_SECTIONS, MealType } from "@/constants/tasks";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import FoodCard from "./FoodCard";

interface FoodListProps {
  items: FoodItem[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onEdit?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
}

export default function FoodList({ items, refreshing, onRefresh, onEdit, onDelete }: FoodListProps) {
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
      {MEAL_SECTIONS.map((meal) => {
        const mealItems = items.filter((i) => i.meal === meal);
        if (mealItems.length === 0) return null;

        return (
          <View key={meal} style={styles.section}>
            <Text style={styles.sectionTitle}>{meal}</Text>
            <View style={styles.cardList}>
              {mealItems.map((item) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  onEdit={onEdit ? (newTitle) => onEdit(item.id, newTitle) : undefined}
                  onDelete={onDelete ? () => onDelete(item.id) : undefined}
                />
              ))}
            </View>
          </View>
        );
      })}

      {items.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No food logged for this day</Text>
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
  cardList: {
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.gray400,
    fontWeight: "500",
  },
});
