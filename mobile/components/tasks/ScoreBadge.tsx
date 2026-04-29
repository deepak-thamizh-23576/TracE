import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

// ──────────── Tier colours ────────────
const TIER_COLORS: Record<string, string> = {
  "On Fire":    "#4CAF50",
  "Good":       "#FFD900",  // AppColors.primarySolid
  "Needs Work": "#FF9800",
  "Slipping":   "#F44336",
};

const DEFAULT_COLOR = "#D1D5DB"; // gray300 while loading

interface ScoreBadgeProps {
  score: number | null;
  tier: string | null;
  loading?: boolean;
}

export default function ScoreBadge({ score, tier, loading }: ScoreBadgeProps) {
  const color = tier ? (TIER_COLORS[tier] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
  const label = score !== null ? String(score) : "—";

  // Pulse animation when score changes
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevScore = useRef<number | null>(null);

  useEffect(() => {
    if (score !== null && score !== prevScore.current) {
      prevScore.current = score;
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.25, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [score, scaleAnim]);

  const handlePress = () => {
    if (score === null || !tier) return;
    Alert.alert(
      `Activity Score: ${score}`,
      `Status: ${tier}\n\nYour score reflects your last 7 days of activity — tasks completed, food logged, and goals achieved.`,
      [{ text: "OK" }]
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75}>
      <Animated.View
        style={[
          styles.badge,
          { borderColor: color, opacity: loading ? 0.5 : 1 },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={[styles.label, { color }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
});
