import { AppColors } from "@/constants/colors";
import { RecurrenceType, ReminderItem } from "@/constants/tasks";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  once: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const RECURRENCE_ICONS: Record<RecurrenceType, string> = {
  once: "time-outline",
  daily: "today-outline",
  weekly: "calendar-outline",
  monthly: "calendar-number-outline",
};

interface ReminderCardProps {
  item: ReminderItem;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSnooze?: (id: string, minutes: number) => void;
}

function formatReminderTime(dateTimeStr: string): string {
  if (!dateTimeStr) return "";
  const d = new Date(dateTimeStr);
  if (isNaN(d.getTime())) return dateTimeStr;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isOverdue(dateTimeStr: string): boolean {
  if (!dateTimeStr) return false;
  const d = new Date(dateTimeStr);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

export default function ReminderCard({
  item,
  onComplete,
  onDelete,
  onSnooze,
}: ReminderCardProps) {
  const overdue = !item.completed && isOverdue(item.reminderDateTime);
  const [showSnooze, setShowSnooze] = React.useState(false);

  const handleDelete = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Delete this reminder?")) {
        onDelete?.(item.id);
      }
    } else {
      const { Alert } = require("react-native");
      Alert.alert("Delete Reminder", "Delete this reminder?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete?.(item.id) },
      ]);
    }
  };

  return (
    <View style={[styles.card, item.completed && styles.cardCompleted, overdue && styles.cardOverdue]}>
      {/* Checkbox */}
      <TouchableOpacity
        style={[styles.checkbox, item.completed && styles.checkboxDone]}
        onPress={() => onComplete?.(item.id)}
        activeOpacity={0.7}
      >
        {item.completed && (
          <Ionicons name="checkmark" size={12} color={AppColors.white} />
        )}
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, item.completed && styles.titleDone]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons
            name={RECURRENCE_ICONS[item.recurrence] as any}
            size={11}
            color={overdue ? AppColors.red500 : AppColors.gray400}
          />
          <Text style={[styles.metaText, overdue && styles.metaOverdue]}>
            {formatReminderTime(item.reminderDateTime)}
          </Text>
          <View style={[styles.recurrenceBadge, item.recurrence !== "once" && styles.recurrenceBadgeRecurring]}>
            <Text style={[styles.recurrenceText, item.recurrence !== "once" && styles.recurrenceTextRecurring]}>
              {RECURRENCE_LABELS[item.recurrence]}
            </Text>
          </View>
        </View>

        {/* Snooze options */}
        {showSnooze && !item.completed && (
          <View style={styles.snoozeRow}>
            {[5, 10, 30, 60].map((min) => (
              <TouchableOpacity
                key={min}
                style={styles.snoozeChip}
                onPress={() => {
                  setShowSnooze(false);
                  onSnooze?.(item.id, min);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.snoozeChipText}>
                  {min < 60 ? `${min}m` : `${min / 60}h`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!item.completed && (
          <TouchableOpacity
            onPress={() => setShowSnooze(!showSnooze)}
            activeOpacity={0.7}
            style={styles.actionBtn}
          >
            <MaterialIcons name="snooze" size={16} color={AppColors.gray400} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.7}
          style={styles.actionBtn}
        >
          <MaterialIcons name="delete-outline" size={16} color={AppColors.gray400} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardCompleted: {
    opacity: 0.55,
  },
  cardOverdue: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: AppColors.gray300,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.text,
    lineHeight: 20,
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: AppColors.gray400,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 11,
    color: AppColors.gray400,
  },
  metaOverdue: {
    color: AppColors.red500,
    fontWeight: "600",
  },
  recurrenceBadge: {
    backgroundColor: AppColors.gray100,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recurrenceBadgeRecurring: {
    backgroundColor: "#EDE9FE",
  },
  recurrenceText: {
    fontSize: 9,
    fontWeight: "700",
    color: AppColors.gray400,
    textTransform: "uppercase",
  },
  recurrenceTextRecurring: {
    color: "#7C3AED",
  },
  snoozeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  snoozeChip: {
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  snoozeChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },
  actions: {
    flexDirection: "row",
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },
});
