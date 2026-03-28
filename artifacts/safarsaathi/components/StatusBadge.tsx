// components/StatusBadge.tsx
/**
 * StatusBadge — displays current risk level with animated pulsing dot.
 * Shows score and trigger reasons when available.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import type { RiskLevel } from "@/context/TripContext";

interface StatusBadgeProps {
  level: RiskLevel;
  score?: number;
  triggers?: string[];   // NEW: show what caused the risk
  size?: "sm" | "md" | "lg";
}

const levelConfig = {
  safe: {
    label: "SAFE",
    color: Colors.safe,
    bg: Colors.safeLight,
    dot: Colors.safe,
  },
  warning: {
    label: "WARNING",
    color: Colors.warning,
    bg: Colors.warningLight,
    dot: Colors.warning,
  },
  danger: {
    label: "DANGER",
    color: Colors.danger,
    bg: Colors.dangerLight,
    dot: Colors.danger,
  },
};

function PulsingDot({ color, active }: { color: string; active: boolean }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(withTiming(1.5, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1,
        false
      );
    } else {
      scale.value = withTiming(1);
      opacity.value = withTiming(1);
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, animStyle]} />
  );
}

export default function StatusBadge({
  level,
  score,
  triggers,
  size = "md",
}: StatusBadgeProps) {
  const config = levelConfig[level];
  const isAlert = level !== "safe";

  const textSize =
    size === "sm" ? 10 : size === "lg" ? 14 : 12;
  const padding =
    size === "sm"
      ? { paddingHorizontal: 8, paddingVertical: 4 }
      : size === "lg"
      ? { paddingHorizontal: 16, paddingVertical: 8 }
      : { paddingHorizontal: 12, paddingVertical: 6 };

  return (
    <View>
      {/* Main badge pill */}
      <View style={[styles.container, { backgroundColor: config.bg }, padding]}>
        <PulsingDot color={config.dot} active={isAlert} />
        <Text style={[styles.label, { color: config.color, fontSize: textSize }]}>
          {config.label}
        </Text>
        {score !== undefined && (
          <Text style={[styles.score, { color: config.color, fontSize: textSize - 1 }]}>
            {score}
          </Text>
        )}
      </View>

      {/* Trigger reasons shown below badge when in warning/danger */}
      {isAlert && triggers && triggers.length > 0 && (
        <View style={styles.triggersContainer}>
          {triggers.map((trigger, i) => (
            <View key={i} style={styles.triggerRow}>
              <View style={[styles.triggerDot, { backgroundColor: config.color }]} />
              <Text style={[styles.triggerText, { color: config.color }]}>
                {trigger}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    gap: 6,
    alignSelf: "flex-start",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  score: {
    fontFamily: "Inter_600SemiBold",
    opacity: 0.7,
  },
  triggersContainer: {
    marginTop: 4,
    paddingHorizontal: 4,
    gap: 2,
  },
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  triggerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  triggerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 14,
  },
});