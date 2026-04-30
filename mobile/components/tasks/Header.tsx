import { AppColors } from "@/constants/colors";
import { CalendarMinus02Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScoreBadge from "./ScoreBadge";

const TABS = ["Task", "Food", "Reminder", "Goal"] as const;
export type TabName = (typeof TABS)[number];

interface HeaderProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  onCalendarPress?: () => void;
  onSearchPress?: () => void;
  selectedDate: Date;
  onLogoPress?: () => void;
  score?: number | null;
  tier?: string | null;
  scoreLoading?: boolean;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const TAB_TITLES: Record<TabName, string> = {
  Task: "Tasks",
  Food: "Food Log",
  Reminder: "Reminders",
  Goal: "Goals",
};

export default function Header({ activeTab, onTabChange, onCalendarPress, onSearchPress, selectedDate, onLogoPress, score, tier, scoreLoading }: HeaderProps) {
  const today = new Date();
  const isToday = isSameDay(selectedDate, today);
  const insets = useSafeAreaInsets();

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Goal tab is not date-filtered, so show a simpler title
  const showCalendar = activeTab !== "Goal";
  const titlePrefix = isToday && showCalendar ? "Today's " : "";
  const title = `${titlePrefix}${TAB_TITLES[activeTab]}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={onLogoPress} activeOpacity={0.75}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.titleTextContainer}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {showCalendar && <Text style={styles.subtitle}>{formattedDate}</Text>}
          </View>
        </View>
        <View style={styles.topRightButtons}>
          <ScoreBadge score={score ?? null} tier={tier ?? null} loading={scoreLoading} />
          {showCalendar && (
            <TouchableOpacity style={styles.calendarButton} activeOpacity={0.7} onPress={onCalendarPress}>
              <HugeiconsIcon icon={CalendarMinus02Icon} size={18} color={AppColors.textPrimary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7} onPress={onSearchPress}>
            <HugeiconsIcon icon={Search01Icon} size={18} color={AppColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab navigation */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => onTabChange(tab)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingBottom: 0,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  titleTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: AppColors.textPrimary,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  calendarButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
  },
  topRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabLabelActive: {
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  tabLabelInactive: {
    color: AppColors.gray400,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 32,
    height: 4,
    backgroundColor: AppColors.primarySolid,
    borderRadius: 9999,
  },
});
