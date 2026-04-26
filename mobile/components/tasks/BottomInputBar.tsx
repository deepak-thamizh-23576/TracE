import { AppColors } from "@/constants/colors";
import { Priority, RecurrenceType } from "@/constants/tasks";
import { Entypo, Feather } from "@expo/vector-icons";
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Parse current reminderDateTime or default to 1 hour from now
  const parsedDt = reminderDateTime ? new Date(reminderDateTime) : null;
  const now = new Date();
  const defaultDt = new Date(now.getTime() + 3600_000);
  const activeDt = parsedDt && !isNaN(parsedDt.getTime()) ? parsedDt : defaultDt;

  const [pickerYear, setPickerYear] = useState(activeDt.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(activeDt.getMonth());
  const [pickerDay, setPickerDay] = useState(activeDt.getDate());
  const [pickerHour, setPickerHour] = useState(activeDt.getHours());
  const [pickerMinute, setPickerMinute] = useState(activeDt.getMinutes());

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

  const confirmDatePicker = () => {
    const d = new Date(pickerYear, pickerMonth, pickerDay, pickerHour, pickerMinute);
    onReminderDateTimeChange?.(d.toISOString().substring(0, 16));
    setDatePickerOpen(false);
  };

  const openDatePicker = () => {
    // Sync picker state with current value
    setPickerYear(activeDt.getFullYear());
    setPickerMonth(activeDt.getMonth());
    setPickerDay(activeDt.getDate());
    setPickerHour(activeDt.getHours());
    setPickerMinute(activeDt.getMinutes());
    setDatePickerOpen(true);
  };

  const formatDisplayDate = () => {
    if (!reminderDateTime) return "Set date & time";
    const d = new Date(reminderDateTime);
    if (isNaN(d.getTime())) return "Set date & time";
    return d.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
  const firstDayOfWeek = new Date(pickerYear, pickerMonth, 1).getDay();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  return (
    <Animated.View style={[styles.wrapper, { paddingBottom: Animated.add((insets.bottom || 8) + 12, bottomOffset) }]}>
      <View style={styles.container}>
        {/* ── Reminder controls ── */}
        {showReminder && (
          <>
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
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={openDatePicker}
              activeOpacity={0.7}
            >
              <Feather name="calendar" size={16} color={reminderDateTime ? AppColors.primarySolid : AppColors.gray400} />
              <Text style={[styles.datePickerButtonText, reminderDateTime ? { color: AppColors.textPrimary } : undefined]}>
                {formatDisplayDate()}
              </Text>
              <Feather name="chevron-down" size={14} color={AppColors.gray400} />
            </TouchableOpacity>
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

      {/* ── Custom Date/Time Picker Modal ── */}
      {showReminder && (
        <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
          <TouchableOpacity style={styles.dtOverlay} activeOpacity={1} onPress={() => setDatePickerOpen(false)}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.dtCard}>
                {/* Month/Year nav */}
                <View style={styles.dtMonthNav}>
                  <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(pickerYear - 1); } else setPickerMonth(pickerMonth - 1); }} activeOpacity={0.6}>
                    <Feather name="chevron-left" size={20} color={AppColors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.dtMonthLabel}>{MONTHS[pickerMonth]} {pickerYear}</Text>
                  <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(pickerYear + 1); } else setPickerMonth(pickerMonth + 1); }} activeOpacity={0.6}>
                    <Feather name="chevron-right" size={20} color={AppColors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Day-of-week headers */}
                <View style={styles.dtWeekRow}>
                  {DAYS_OF_WEEK.map((d) => (
                    <Text key={d} style={styles.dtWeekDay}>{d}</Text>
                  ))}
                </View>

                {/* Calendar grid */}
                <View style={styles.dtGrid}>
                  {calendarCells.map((day, i) => {
                    if (day === null) return <View key={`e${i}`} style={styles.dtCellEmpty} />;
                    const isSelected = day === pickerDay;
                    const isToday = `${pickerYear}-${pickerMonth}-${day}` === todayKey;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dtCell, isSelected && styles.dtCellSelected, isToday && !isSelected && styles.dtCellToday]}
                        onPress={() => setPickerDay(day)}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.dtCellText, isSelected && styles.dtCellTextSelected]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Time picker row */}
                <View style={styles.dtTimeRow}>
                  <Feather name="clock" size={16} color={AppColors.gray400} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dtTimeScroll} contentContainerStyle={{ gap: 4 }}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.dtTimeChip, pickerHour === h && styles.dtTimeChipActive]}
                        onPress={() => setPickerHour(h)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dtTimeChipText, pickerHour === h && styles.dtTimeChipTextActive]}>
                          {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.dtTimeRow}>
                  <Text style={styles.dtMinLabel}>Min</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dtTimeScroll} contentContainerStyle={{ gap: 4 }}>
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.dtTimeChip, pickerMinute === m && styles.dtTimeChipActive]}
                        onPress={() => setPickerMinute(m)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dtTimeChipText, pickerMinute === m && styles.dtTimeChipTextActive]}>
                          :{m.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Confirm */}
                <TouchableOpacity style={styles.dtConfirmBtn} onPress={confirmDatePicker} activeOpacity={0.7}>
                  <Text style={styles.dtConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
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
  // ── Date picker trigger button ──
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
