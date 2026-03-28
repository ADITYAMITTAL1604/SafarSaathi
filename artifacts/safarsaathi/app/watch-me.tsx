import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useTripContext } from "@/context/TripContext";

const TIMER_OPTIONS = [15, 30, 45, 60];

function CountdownTimer({ endTime }: { endTime: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const rem = Math.max(0, endTime - Date.now());
      setRemaining(rem);
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <View style={timerStyles.container}>
      <Text style={timerStyles.number}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </Text>
      <Text style={timerStyles.label}>remaining</Text>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  container: { alignItems: "center" },
  number: { fontFamily: "Inter_700Bold", fontSize: 56, color: Colors.primary, letterSpacing: -2 },
  label: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, marginTop: -4 },
});

export default function WatchMeScreen() {
  const insets = useSafeAreaInsets();
  const { watchMeStatus, watchMeEndTime, startWatchMe, cancelWatchMe, confirmWatchMe } = useTripContext();
  const [selected, setSelected] = useState(30);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (watchMeStatus === "expired") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [watchMeStatus]);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startWatchMe(selected);
  };

  const handleConfirmSafe = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    confirmWatchMe();
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad + 16 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch Me</Text>
        <View style={{ width: 40 }} />
      </View>

      {watchMeStatus === "idle" && (
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroEmoji}>👁</Text>
            </View>
            <Text style={styles.heroTitle}>Set a Safety Timer</Text>
            <Text style={styles.heroSubtitle}>
              If you don't confirm you're safe before the timer ends, your contacts will be alerted automatically.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.timerGrid}>
            {TIMER_OPTIONS.map((min) => (
              <TouchableOpacity
                key={min}
                style={[styles.timerOption, selected === min && styles.timerOptionActive]}
                onPress={() => { Haptics.selectionAsync(); setSelected(min); }}
              >
                <Text style={[styles.timerOptionText, selected === min && styles.timerOptionTextActive]}>
                  {min}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startBtnEmoji}>⏰</Text>
            <Text style={styles.startBtnText}>Start Watch Me</Text>
          </TouchableOpacity>
        </View>
      )}

      {watchMeStatus === "active" && watchMeEndTime && (
        <View style={styles.activeContent}>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>Watch Me Active</Text>
          </View>

          <CountdownTimer endTime={watchMeEndTime} />

          <Text style={styles.activeHint}>
            Tap below before the timer expires or your contacts will be alerted.
          </Text>

          <TouchableOpacity style={styles.safeBtn} onPress={handleConfirmSafe} activeOpacity={0.85}>
            <Text style={styles.safeBtnEmoji}>✅</Text>
            <Text style={styles.safeBtnText}>I'm Safe</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={cancelWatchMe}>
            <Text style={styles.cancelBtnText}>Cancel Watch Me</Text>
          </TouchableOpacity>
        </View>
      )}

      {watchMeStatus === "expired" && (
        <View style={styles.expiredContent}>
          <Animated.View style={[styles.expiredIcon, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.expiredEmoji}>⚠️</Text>
          </Animated.View>
          <Text style={styles.expiredTitle}>Timer Expired!</Text>
          <Text style={styles.expiredSubtitle}>
            Your safety timer has expired. Your emergency contacts have been alerted.
          </Text>
          <TouchableOpacity
            style={styles.safeBtn}
            onPress={handleConfirmSafe}
            activeOpacity={0.85}
          >
            <Text style={styles.safeBtnEmoji}>✅</Text>
            <Text style={styles.safeBtnText}>I'm Safe — Stop Alerts</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary, fontFamily: "Inter_500Medium" },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.textPrimary },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  hero: {
    alignItems: "center",
    marginBottom: 36,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.safeLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  heroSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timerGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 32,
  },
  timerOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  timerOptionActive: { borderColor: Colors.primary, backgroundColor: "#EEF2FF" },
  timerOptionText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textSecondary },
  timerOptionTextActive: { color: Colors.primary },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  startBtnEmoji: { fontSize: 20 },
  startBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  activeContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: "center",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.safeLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 32,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.safe },
  activeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.safe },
  activeHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  safeBtn: {
    width: "100%",
    backgroundColor: Colors.safe,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: Colors.safe,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  safeBtnEmoji: { fontSize: 20 },
  safeBtnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff" },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  expiredContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
  expiredIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 32,
  },
  expiredEmoji: { fontSize: 48 },
  expiredTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.danger,
    textAlign: "center",
    marginBottom: 12,
  },
  expiredSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
});
