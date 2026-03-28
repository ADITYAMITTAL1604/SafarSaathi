import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "@/constants/colors";

interface RiskAlertDialogProps {
  visible: boolean;
  message: string;
  onSafe: () => void;
  onAlert: () => void;
  timeoutSeconds?: number;
}

export default function RiskAlertDialog({
  visible,
  message,
  onSafe,
  onAlert,
  timeoutSeconds = 15,
}: RiskAlertDialogProps) {
  const [countdown, setCountdown] = useState(timeoutSeconds);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef(timeoutSeconds);

  useEffect(() => {
    if (visible) {
      countdownRef.current = timeoutSeconds;
      setCountdown(timeoutSeconds);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      timerRef.current = setInterval(() => {
        countdownRef.current -= 1;
        setCountdown(countdownRef.current);
        if (countdownRef.current <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          onAlert();
        }
      }, 1000);
    } else {
      Animated.spring(scaleAnim, { toValue: 0, useNativeDriver: true }).start();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible]);

  const progress = countdown / timeoutSeconds;
  const circleColor = countdown > 10 ? Colors.warning : Colors.danger;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={[styles.dialog, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.warningLight }]}>
            <Text style={styles.iconEmoji}>⚠️</Text>
          </View>

          <Text style={styles.title}>Are you safe?</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.countdownContainer}>
            <View style={[styles.countdownRing, { borderColor: circleColor }]}>
              <Text style={[styles.countdownNumber, { color: circleColor }]}>{countdown}</Text>
              <Text style={styles.countdownLabel}>sec</Text>
            </View>
            <Text style={styles.countdownHint}>Alert will auto-send if no response</Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: circleColor }]}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.alertButton]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onAlert(); }}
            >
              <Text style={styles.alertBtnEmoji}>🚨</Text>
              <Text style={[styles.buttonText, { color: Colors.danger }]}>Send Alert</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.safeButton]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSafe(); }}
            >
              <Text style={styles.safeBtnEmoji}>✅</Text>
              <Text style={[styles.buttonText, { color: "#fff" }]}>I'm Safe</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 36 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  countdownContainer: { alignItems: "center", marginBottom: 20 },
  countdownRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  countdownNumber: { fontFamily: "Inter_700Bold", fontSize: 28 },
  countdownLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  countdownHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, textAlign: "center" },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: { height: "100%", borderRadius: 2 },
  actions: { flexDirection: "row", gap: 12, width: "100%" },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  alertButton: { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: Colors.danger + "40" },
  safeButton: { backgroundColor: Colors.safe },
  alertBtnEmoji: { fontSize: 16 },
  safeBtnEmoji: { fontSize: 16 },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
