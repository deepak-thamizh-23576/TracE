import { AppColors } from "@/constants/colors";
import {
  FoodItem,
  Goal,
  ReminderItem,
  Task,
} from "@/constants/tasks";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PriorityDot from "./PriorityDot";

type SearchSection = "Task" | "Food" | "Reminder" | "Goal";

const SECTIONS: SearchSection[] = ["Task", "Food", "Reminder", "Goal"];

// ─────────────────────────────────────────
//  Result item types
// ─────────────────────────────────────────

interface TaskResult {
  kind: "Task";
  item: Task;
  matchedDelay?: string; // the delay reason that matched
}
interface FoodResult {
  kind: "Food";
  item: FoodItem;
}
interface ReminderResult {
  kind: "Reminder";
  item: ReminderItem;
}
interface GoalResult {
  kind: "Goal";
  item: Goal;
  matchedDelay?: string;
}

type SearchResult = TaskResult | FoodResult | ReminderResult | GoalResult;

// ─────────────────────────────────────────
//  Props
// ─────────────────────────────────────────

interface SearchOverlayProps {
  visible: boolean;
  initialSection: SearchSection;
  tasks: Task[];
  foodItems: FoodItem[];
  reminderItems: ReminderItem[];
  goals: Goal[];
  onClose: () => void;
  onSelectTask: (task: Task) => void;
  onSelectFood: (item: FoodItem) => void;
  onSelectReminder: (item: ReminderItem) => void;
  onSelectGoal: (goal: Goal) => void;
}

// ─────────────────────────────────────────
//  Search helpers
// ─────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function buildResults(
  query: string,
  section: SearchSection,
  tasks: Task[],
  foodItems: FoodItem[],
  exerciseItems: ReminderItem[],
  goals: Goal[]
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  switch (section) {
    case "Task": {
      const results: TaskResult[] = [];
      for (const task of tasks) {
        const titleMatch = normalize(task.title).includes(q);
        const delayMatch = task.delays.find((d) =>
          normalize(d.reason).includes(q)
        );
        if (titleMatch || delayMatch) {
          results.push({
            kind: "Task",
            item: task,
            matchedDelay: delayMatch?.reason,
          });
        }
      }
      return results;
    }
    case "Food":
      return foodItems
        .filter((f) => normalize(f.title).includes(q))
        .map((item) => ({ kind: "Food" as const, item }));
    case "Reminder":
      return exerciseItems
        .filter((e) => normalize(e.title).includes(q))
        .map((item) => ({ kind: "Reminder" as const, item }));
    case "Goal": {
      const results: GoalResult[] = [];
      for (const goal of goals) {
        const titleMatch = normalize(goal.title).includes(q);
        const delayMatch = goal.delays.find((d) =>
          normalize(d.reason).includes(q)
        );
        if (titleMatch || delayMatch) {
          results.push({
            kind: "Goal",
            item: goal,
            matchedDelay: delayMatch?.reason,
          });
        }
      }
      return results;
    }
  }
}

// ─────────────────────────────────────────
//  Result card components
// ─────────────────────────────────────────

function TaskResultCard({
  result,
  onPress,
}: {
  result: TaskResult;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultCardInner}>
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {result.item.title}
          </Text>
          <Text style={styles.resultMeta}>{result.item.date}</Text>
          {result.matchedDelay && (
            <View style={styles.delayMatchRow}>
              <View style={styles.delayMatchDot} />
              <Text style={styles.delayMatchText} numberOfLines={2}>
                Delay: {result.matchedDelay}
              </Text>
            </View>
          )}
        </View>
        <PriorityDot priority={result.item.priority} />
      </View>
    </TouchableOpacity>
  );
}

function FoodResultCard({
  result,
  onPress,
}: {
  result: FoodResult;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultCardInner}>
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {result.item.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.sectionPill}>
              <Text style={styles.sectionPillText}>{result.item.meal}</Text>
            </View>
            <Text style={styles.resultMeta}>{result.item.date}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ReminderResultCard({
  result,
  onPress,
}: {
  result: ReminderResult;
  onPress: () => void;
}) {
  const RECURRENCE_LABELS: Record<string, string> = {
    once: "One-time", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  };
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultCardInner}>
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {result.item.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.sectionPill}>
              <Text style={styles.sectionPillText}>{RECURRENCE_LABELS[result.item.recurrence] || result.item.recurrence}</Text>
            </View>
            <Text style={styles.resultMeta}>{result.item.date}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GoalResultCard({
  result,
  onPress,
}: {
  result: GoalResult;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultCardInner}>
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {result.item.title}
          </Text>
          <Text style={styles.resultMeta}>{result.item.date}</Text>
          {result.matchedDelay && (
            <View style={styles.delayMatchRow}>
              <View style={styles.delayMatchDot} />
              <Text style={styles.delayMatchText} numberOfLines={2}>
                Delay: {result.matchedDelay}
              </Text>
            </View>
          )}
        </View>
        <PriorityDot priority={result.item.priority} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────

export default function SearchOverlay({
  visible,
  initialSection,
  tasks,
  foodItems,
  reminderItems,
  goals,
  onClose,
  onSelectTask,
  onSelectFood,
  onSelectReminder,
  onSelectGoal,
}: SearchOverlayProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SearchSection>(initialSection);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Sync section when overlay opens with a new initial section
  useEffect(() => {
    if (visible) {
      setSection(initialSection);
      setQuery("");
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, initialSection]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setQuery("");
    onClose();
  }, [onClose]);

  const results = buildResults(query, section, tasks, foodItems, reminderItems, goals);

  const renderResult = useCallback(
    ({ item }: { item: SearchResult }) => {
      switch (item.kind) {
        case "Task":
          return (
            <TaskResultCard
              result={item}
              onPress={() => {
                handleClose();
                onSelectTask(item.item);
              }}
            />
          );
        case "Food":
          return (
            <FoodResultCard
              result={item}
              onPress={() => {
                handleClose();
                onSelectFood(item.item);
              }}
            />
          );
        case "Reminder":
          return (
            <ReminderResultCard
              result={item}
              onPress={() => {
                handleClose();
                onSelectReminder(item.item);
              }}
            />
          );
        case "Goal":
          return (
            <GoalResultCard
              result={item}
              onPress={() => {
                handleClose();
                onSelectGoal(item.item);
              }}
            />
          );
      }
    },
    [handleClose, onSelectTask, onSelectFood, onSelectReminder, onSelectGoal]
  );

  const keyExtractor = useCallback((item: SearchResult) => {
    return `${item.kind}-${item.item.id}`;
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <KeyboardAvoidingView
          style={styles.panel}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {/* Search input row */}
          <View style={[styles.inputRow, { paddingTop: insets.top + 14 }]}>
            <View style={styles.inputWrapper}>
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                color={AppColors.gray400}
                style={styles.searchIcon}
              />
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${section.toLowerCase()}s…`}
                placeholderTextColor={AppColors.gray400}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={16}
                    color={AppColors.gray400}
                  />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Section tabs */}
          <View style={styles.sectionRow}>
            {SECTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sectionBtn, section === s && styles.sectionBtnActive]}
                onPress={() => setSection(s)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sectionBtnText,
                    section === s && styles.sectionBtnTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Results or empty state */}
          {query.trim().length === 0 ? (
            <View style={styles.emptyContainer}>
              <HugeiconsIcon
                icon={Search01Icon}
                size={40}
                color={AppColors.gray200}
              />
              <Text style={styles.emptyTitle}>Search {section}s</Text>
              <Text style={styles.emptyHint}>
                {section === "Task" || section === "Goal"
                  ? `Type a keyword to find ${section.toLowerCase()}s or their delay notes`
                  : `Type a keyword to find ${section.toLowerCase()} entries`}
              </Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyHint}>
                No {section.toLowerCase()}s match "{query}"
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              renderItem={renderResult}
              keyExtractor={keyExtractor}
              contentContainerStyle={[
                styles.resultsList,
                { paddingBottom: insets.bottom + 16 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: AppColors.white,
  },
  panel: {
    flex: 1,
  },
  // ── Search input row ──
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchIcon: {
    marginTop: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: AppColors.textPrimary,
    paddingVertical: 0,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "500",
    color: AppColors.textSecondary,
  },
  // ── Section tabs ──
  sectionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  sectionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: AppColors.gray100,
  },
  sectionBtnActive: {
    backgroundColor: AppColors.primarySolid,
  },
  sectionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.gray400,
  },
  sectionBtnTextActive: {
    color: AppColors.textPrimary,
  },
  // ── Empty / hint state ──
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: AppColors.textPrimary,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: AppColors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  // ── Results list ──
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  resultCard: {
    backgroundColor: AppColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.gray100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 8,
  },
  resultCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  resultContent: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  resultMeta: {
    fontSize: 11,
    color: AppColors.gray400,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionPill: {
    backgroundColor: AppColors.primarySolid,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  // ── Delay match indicator ──
  delayMatchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 2,
  },
  delayMatchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.priorityMedium,
    marginTop: 4,
  },
  delayMatchText: {
    flex: 1,
    fontSize: 11,
    color: AppColors.textSecondary,
    fontStyle: "italic",
  },
});
