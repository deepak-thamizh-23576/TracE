import { AppColors } from "@/constants/colors";
import { dateToKey } from "@/constants/tasks";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarDropdownProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  pendingDates?: Set<string>; // Set of "YYYY-MM-DD" strings that have pending tasks
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarDropdown({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  pendingDates,
}: CalendarDropdownProps) {
  const slideAnim = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [displayMonth, setDisplayMonth] = useState(selectedDate.getMonth());
  const [displayYear, setDisplayYear] = useState(selectedDate.getFullYear());

  const today = new Date();

  useEffect(() => {
    if (visible) {
      setDisplayMonth(selectedDate.getMonth());
      setDisplayYear(selectedDate.getFullYear());
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const goToPrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const goToToday = () => {
    setDisplayMonth(today.getMonth());
    setDisplayYear(today.getFullYear());
    onSelectDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  };

  const daysInMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDay = getFirstDayOfMonth(displayYear, displayMonth);

  // Build calendar grid
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  // Fill remaining cells to complete last row
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) {
    weeks.push(calendarCells.slice(i, i + 7));
  }

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: fadeAnim }]}
        pointerEvents="auto"
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Calendar panel */}
      <Animated.View
        style={[
          styles.panelContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="auto"
      >
        <View style={styles.panel}>
          {/* Header row */}
          <View style={styles.calendarHeader}>
            <Text style={styles.monthYearText}>
              {MONTH_NAMES[displayMonth]} {displayYear}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.todayButton}
                onPress={goToToday}
                activeOpacity={0.7}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Month navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={goToPrevMonth}
              activeOpacity={0.7}
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={goToNextMonth}
              activeOpacity={0.7}
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day labels */}
          <View style={styles.dayLabelsRow}>
            {DAYS.map((day) => (
              <View key={day} style={styles.dayLabelCell}>
                <Text style={styles.dayLabelText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day === null) {
                  return <View key={di} style={styles.dayCell} />;
                }

                const cellDate = new Date(displayYear, displayMonth, day);
                const isSelected = isSameDay(cellDate, selectedDate);
                const isToday = isSameDay(cellDate, today);
                const hasPending = pendingDates?.has(dateToKey(cellDate)) ?? false;

                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      styles.dayCell,
                      isSelected && styles.selectedDayCell,
                      isToday && !isSelected && styles.todayDayCell,
                    ]}
                    onPress={() => onSelectDate(cellDate)}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.selectedDayText,
                        isToday && !isSelected && styles.todayDayText,
                      ]}
                    >
                      {day}
                    </Text>
                    {hasPending && (
                      <View
                        style={[
                          styles.pendingDot,
                          isSelected && styles.pendingDotSelected,
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Drag indicator */}
          <View style={styles.dragIndicator} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panelContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  panel: {
    width: "100%",
    backgroundColor: AppColors.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthYearText: {
    fontSize: 20,
    fontWeight: "700",
    color: AppColors.textPrimary,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayButton: {
    backgroundColor: AppColors.primarySolid,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: AppColors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.gray50,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonText: {
    fontSize: 22,
    fontWeight: "600",
    color: AppColors.textPrimary,
    marginTop: -2,
  },
  dayLabelsRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayLabelCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  dayLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: AppColors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    marginVertical: 1,
  },
  selectedDayCell: {
    backgroundColor: AppColors.primarySolid,
  },
  todayDayCell: {
    backgroundColor: AppColors.gray100,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  selectedDayText: {
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  todayDayText: {
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  dragIndicator: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 9999,
    backgroundColor: AppColors.gray200,
    marginTop: 12,
  },
  pendingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: AppColors.priorityHigh,
    marginTop: 2,
  },
  pendingDotSelected: {
    backgroundColor: AppColors.textPrimary,
  },
});
