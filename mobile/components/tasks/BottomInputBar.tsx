import { AppColors } from "@/constants/colors";
import {
  parseReminderDateTime,
  parseNaturalReminder,
  Priority,
  RecurrenceType,
} from "@/constants/tasks";
import { Entypo, Feather, Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIORITY_OPTIONS: { value: Priority; color: string }[] = [
  { value: "high", color: AppColors.priorityHigh },
  { value: "medium", color: AppColors.priorityMedium },
  { value: "low", color: AppColors.priorityLow },
];

interface BottomInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onAttach?: () => void;
  placeholder?: string;
  showPriority?: boolean;
  selectedPriority?: Priority;
  onPriorityChange?: (priority: Priority) => void;
  /** Generic chip selector (used for Meal type, Workout type, etc.) */
  selectorOptions?: string[];
  selectedOption?: string;
  onOptionChange?: (option: string) => void;
  selectorLabel?: string;
  /** Reminder-specific props */
  showReminder?: boolean;
  selectedRecurrence?: RecurrenceType;
  onRecurrenceChange?: (r: RecurrenceType) => void;
  reminderDateTime?: string;
  onReminderDateTimeChange?: (dt: string) => void;
}

const RECURRENCE_LABELS: { value: RecurrenceType; label: string }[] = [
  { value: "once", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const LOCAL_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
export default function BottomInputBar({
  value,
  onChangeText,
  onSubmit,
  onAttach,
  placeholder = "Type something...",
  showPriority = false,
  selectedPriority = "medium",
  onPriorityChange,
  selectorOptions,
  selectedOption,
  onOptionChange,
  selectorLabel,
  showReminder = false,
  selectedRecurrence = "once",
  onRecurrenceChange,
  reminderDateTime = "",
  onReminderDateTimeChange,
}: BottomInputBarProps) {
  const isFocusedRef = useRef(false);
  const bottomOffset = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // Live NLP parse — recomputed from the current input value
  const parsedReminder = showReminder ? parseNaturalReminder(value) : null;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (e) => {
      if (isFocusedRef.current) {
        Animated.timing(bottomOffset, {
          toValue: e.endCoordinates.height - (Platform.OS === "ios" ? insets.bottom : 10),
          duration: Platform.OS === "ios" ? e.duration || 250 : 250,
          useNativeDriver: false,
        }).start();
      }
    });

    const onHide = Keyboard.addListener(hideEvent, () => {
      Animated.timing(bottomOffset, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // (calendar picker helpers removed — using NLP parsing instead)

  return (
    <Animated.View style={[styles.wrapper, { paddingBottom: Animated.add((insets.bottom || 8) + 12, bottomOffset) }]}>
      <View style={styles.container}>
        {/* ── Reminder controls ── */}
        {showReminder && (
          <>
            {/* Recurrence chips */}
            <View style={styles.reminderRecurrenceRow}>
              {RECURRENCE_LABELS.map(({ value: r, label }) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.recurrenceChip, selectedRecurrence === r && styles.recurrenceChipActive]}
                  onPress={() => onRecurrenceChange?.(r)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.recurrenceChipText, selectedRecurrence === r && styles.recurrenceChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Live NLP parse preview */}
            {parsedReminder?.preview ? (
              <View style={styles.parsePreviewRow}>
                <Ionicons name="alarm-outline" size={13} color={AppColors.primarySolid} />
                <Text style={styles.parsePreviewText}>
                  <Text style={styles.parsePreviewLabel}>{parsedReminder.title || value.trim()}</Text>
                  {"  ·  "}
                  {parsedReminder.preview}
                </Text>
              </View>
            ) : value.trim().length > 0 ? (
              <Text style={styles.parseHintText}>
                Tip: include a date &amp; time — e.g. “buy milk today 7pm”
              </Text>
            ) : null}
          </>
        )}

        {showPriority && (
          <View style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>Priority</Text>
            <View style={styles.priorityDots}>
              {PRIORITY_OPTIONS.map(({ value: p, color }) => {
                const isSelected = p === selectedPriority;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityDot,
                      { backgroundColor: color },
                      isSelected && styles.priorityDotSelected,
                      isSelected && { borderColor: color },
                    ]}
                    onPress={() => onPriorityChange?.(p)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  />
                );
              })}
            </View>
          </View>
        )}

        {selectorOptions && selectorOptions.length > 0 && (
          <View style={styles.selectorRow}>
            {selectorLabel && (
              <Text style={styles.selectorLabel}>{selectorLabel}</Text>
            )}
            <View style={styles.selectorChips}>
              {selectorOptions.map((option) => {
                const isActive = option === selectedOption;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.selectorChip, isActive && styles.selectorChipActive]}
                    onPress={() => onOptionChange?.(option)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.selectorChipText,
                        isActive && styles.selectorChipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onAttach}
            activeOpacity={0.7}
          >
            <Entypo name="attachment" size={20} color={AppColors.gray400} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={AppColors.gray400}
            value={value}
            onChangeText={onChangeText}
            returnKeyType="send"
            onSubmitEditing={onSubmit}
            blurOnSubmit={false}
            onFocus={() => { isFocusedRef.current = true; }}
            onBlur={() => { isFocusedRef.current = false; }}
          />

          <TouchableOpacity
            style={[styles.iconButton, styles.submitButton]}
            onPress={onSubmit}
            activeOpacity={0.7}
          >
            <Text style={styles.submitIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  container: {
    maxWidth: 448,
    alignSelf: "center",
    width: "100%",
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: AppColors.gray400,
  },
  priorityDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priorityDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  priorityDotSelected: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    backgroundColor: "transparent",
  },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: AppColors.gray400,
  },
  selectorChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  selectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: AppColors.gray50,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  selectorChipActive: {
    backgroundColor: AppColors.primarySolid,
    borderColor: AppColors.primarySolid,
  },
  selectorChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  selectorChipTextActive: {
    color: AppColors.textPrimary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
  },
  attachIcon: {
    fontSize: 20,
    color: AppColors.gray400,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 10,
    color: AppColors.textPrimary,
  },
  submitButton: {
    backgroundColor: AppColors.primarySolid,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  submitIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  homeIndicator: {
    alignSelf: "center",
    width: 128,
    height: 4,
    backgroundColor: AppColors.gray200,
    borderRadius: 9999,
    marginTop: 8,
  },
  // ── Reminder recurrence chips ──
  reminderRecurrenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  recurrenceChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: AppColors.gray50,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  recurrenceChipActive: {
    backgroundColor: AppColors.primarySolid,
    borderColor: AppColors.primarySolid,
  },
  recurrenceChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: AppColors.textSecondary,
  },
  recurrenceChipTextActive: {
    color: AppColors.textPrimary,
  },
  // ── Parse preview (NLP reminder) ──
  parsePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6,
    backgroundColor: "rgba(var(--primary-rgb), 0.06)",
  },
  parsePreviewText: {
    flex: 1,
    fontSize: 12,
    color: AppColors.textSecondary,
    flexShrink: 1,
  },
  parsePreviewLabel: {
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  parseHintText: {
    fontSize: 11,
    color: AppColors.gray400,
    paddingHorizontal: 4,
    marginBottom: 6,
    fontStyle: "italic",
  },
  // ── Date picker trigger button (kept for style ref, no longer rendered) ──
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: AppColors.gray50,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 12,
    marginBottom: 8,
  },
  datePickerButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: AppColors.gray400,
  },
  // ── Date/Time picker modal ──
  dtOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dtCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: 340,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  dtMonthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dtMonthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  dtWeekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dtWeekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: AppColors.gray400,
    textTransform: "uppercase",
  },
  dtGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dtCellEmpty: {
    width: "14.28%",
    aspectRatio: 1,
  },
  dtCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dtCellSelected: {
    backgroundColor: AppColors.primarySolid,
    borderRadius: 999,
  },
  dtCellToday: {
    borderWidth: 1.5,
    borderColor: AppColors.primarySolid,
    borderRadius: 999,
  },
  dtCellText: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  dtCellTextSelected: {
    fontWeight: "700",
    color: "#000",
  },
  dtTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  dtMinLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.gray400,
    width: 28,
  },
  dtTimeScroll: {
    flexGrow: 0,
  },
  dtTimeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: AppColors.gray50,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  dtTimeChipActive: {
    backgroundColor: AppColors.primarySolid,
    borderColor: AppColors.primarySolid,
  },
  dtTimeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  dtTimeChipTextActive: {
    color: "#000",
    fontWeight: "700",
  },
  dtConfirmBtn: {
    marginTop: 16,
    backgroundColor: AppColors.primarySolid,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  dtConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
});
