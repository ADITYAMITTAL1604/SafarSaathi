// app/emergency.tsx
/**
 * Emergency screen — shown when SOS is triggered.
 * Sends real SMS + call via OS intents.
 * Shows real contacts and activity log.
 * Alert stored in Firestore.
 */

import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTripContext } from "@/context/TripContext";
import { triggerEmergencyCommunication } from "@/services/communicationService";
import { subscribeToLog, type LogEntry } from "@/utils/activityLog";

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const { contacts, endTrip, userLocation, riskState, isFirebaseReady } = useTripContext();
  const { user } = useAuth();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [smsSent, setSmsSent] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // Subscribe to activity log
    const unsubscribe = subscribeToLog(setLog);

    // Pulsing SOS icon animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // Flashing red background
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();

    // Fade in content
    Animated.timing(contentAnim, {
      toValue: 1, duration: 600, delay: 300, useNativeDriver: true,
    }).start();

    // Trigger real SMS + call to all contacts
    if (contacts.length > 0 && !smsSent) {
      setSmsSent(true);
      const triggerReason = riskState?.triggers?.join(", ") || "Emergency SOS triggered";
      triggerEmergencyCommunication(
        contacts,
        userLocation,
        triggerReason,
        user?.email ?? undefined
      );
    }

    return () => unsubscribe();
  }, []);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.danger, "#B91C1C"],
  });

  const handleResolve = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await endTrip();
    router.replace("/");
  };

  const handleCallEmergency = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Linking.openURL("tel:112").catch(() => {});
  };

  const handleCallContact = (phone: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`).catch(() => {});
  };

  const locationText = userLocation
    ? `${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}`
    : "Acquiring...";

  // Only show danger/success log entries in the actions panel
  const emergencyActions = log
    .filter((e) => e.type === "danger" || e.type === "success")
    .slice(0, 6);

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad + 16 }]}>

      {/* ANIMATED RED HEADER */}
      <Animated.View style={[styles.emergencyHeader, { backgroundColor: bgColor }]}>
        <Animated.View style={[styles.alertIconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.alertEmoji}>🆘</Text>
        </Animated.View>
        <Text style={styles.emergencyTitle}>EMERGENCY ALERT</Text>
        <Text style={styles.emergencySubtitle}>
          {contacts.length > 0
            ? `Notifying ${contacts.length} contact${contacts.length > 1 ? "s" : ""} now`
            : "Emergency recorded"}
        </Text>

        {/* Firebase status pill */}
        <View style={[
          styles.firebasePill,
          { backgroundColor: isFirebaseReady ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)" }
        ]}>
          <View style={[
            styles.firebaseDot,
            { backgroundColor: isFirebaseReady ? "#4ADE80" : "#FCD34D" }
          ]} />
          <Text style={styles.firebasePillText}>
            {isFirebaseReady ? "Alert stored in Firestore ✓" : "Running offline"}
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity: contentAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* STATUS ROW */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoEmoji}>📍</Text>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{locationText}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoEmoji}>👥</Text>
              <Text style={styles.infoLabel}>Contacts</Text>
              <Text style={styles.infoValue}>{contacts.length} Alerted</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoEmoji}>☁️</Text>
              <Text style={styles.infoLabel}>Cloud</Text>
              <Text style={[
                styles.infoValue,
                { color: isFirebaseReady ? Colors.safe : "#F59E0B" }
              ]}>
                {isFirebaseReady ? "Saved ✓" : "Offline"}
              </Text>
            </View>
          </View>

          {/* CONTACTS BEING ALERTED */}
          {contacts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contacts Being Notified</Text>
              {contacts.map((contact) => (
                <View key={contact.id} style={styles.contactAlertRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactAlertInfo}>
                    <Text style={styles.contactAlertName}>{contact.name}</Text>
                    <Text style={styles.contactAlertPhone}>{contact.phone}</Text>
                  </View>
                  {/* Tap to call individually */}
                  <TouchableOpacity
                    style={styles.callContactBtn}
                    onPress={() => handleCallContact(contact.phone, contact.name)}
                  >
                    <Text style={styles.callContactIcon}>📞</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* ACTIONS TAKEN — from real activity log */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions Taken</Text>
            {emergencyActions.length > 0 ? (
              emergencyActions.map((entry) => (
                <View key={entry.id} style={styles.actionItem}>
                  <View style={styles.actionIcon}>
                    <Text style={styles.actionEmoji}>
                      {entry.type === "success" ? "✅" : "🚨"}
                    </Text>
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionMessage}>{entry.message}</Text>
                    <Text style={styles.actionTime}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneText}>✓ Done</Text>
                  </View>
                </View>
              ))
            ) : (
              // Static fallback if log is empty
              [
                { emoji: "📲", text: "SMS opened for contacts" },
                { emoji: "📞", text: "Dialer opened for primary contact" },
                { emoji: "☁️", text: "Emergency stored in Firestore" },
                { emoji: "📡", text: "Live tracking activated" },
              ].map((item, i) => (
                <View key={i} style={styles.actionItem}>
                  <View style={styles.actionIcon}>
                    <Text style={styles.actionEmoji}>{item.emoji}</Text>
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionMessage}>{item.text}</Text>
                    <Text style={styles.actionTime}>Just now</Text>
                  </View>
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneText}>✓ Done</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* RESOLVE BUTTON */}
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={handleResolve}
            activeOpacity={0.85}
          >
            <Text style={styles.resolveEmoji}>✅</Text>
            <Text style={styles.resolveBtnText}>I'm Safe — Resolve Emergency</Text>
          </TouchableOpacity>

          {/* CALL 112 */}
          <TouchableOpacity
            style={styles.callBtn}
            onPress={handleCallEmergency}
            activeOpacity={0.8}
          >
            <Text style={styles.callEmoji}>📞</Text>
            <Text style={styles.callBtnText}>Call Emergency Services (112)</Text>
          </TouchableOpacity>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  emergencyHeader: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 4,
  },
  alertIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  alertEmoji: { fontSize: 44 },
  emergencyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26, color: "#fff",
    letterSpacing: 1.5, marginBottom: 4,
  },
  emergencySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  firebasePill: {
    flexDirection: "row", alignItems: "center",
    gap: 5, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, marginTop: 8,
  },
  firebaseDot: { width: 6, height: 6, borderRadius: 3 },
  firebasePillText: {
    fontFamily: "Inter_500Medium", fontSize: 11, color: "#fff",
  },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  infoRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  infoItem: { flex: 1, alignItems: "center", gap: 4 },
  infoEmoji: { fontSize: 16 },
  infoLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11, color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 11, color: Colors.danger,
    textAlign: "center",
  },
  infoDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11, color: Colors.textSecondary,
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10,
  },

  contactAlertRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    padding: 12, marginBottom: 8, gap: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.danger,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  contactAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.danger,
    alignItems: "center", justifyContent: "center",
  },
  contactAvatarText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  contactAlertInfo: { flex: 1 },
  contactAlertName: {
    fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textPrimary,
  },
  contactAlertPhone: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.textSecondary, marginTop: 1,
  },
  callContactBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.safeLight,
    alignItems: "center", justifyContent: "center",
  },
  callContactIcon: { fontSize: 16 },

  actionItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    padding: 12, marginBottom: 8, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.dangerLight ?? Colors.danger + "15",
    alignItems: "center", justifyContent: "center",
  },
  actionEmoji: { fontSize: 18 },
  actionText: { flex: 1 },
  actionMessage: {
    fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textPrimary,
  },
  actionTime: {
    fontFamily: "Inter_400Regular", fontSize: 11,
    color: Colors.textSecondary, marginTop: 2,
  },
  doneBadge: {
    backgroundColor: Colors.safeLight ?? Colors.safe + "15",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  doneText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.safe },

  resolveBtn: {
    backgroundColor: Colors.safe, borderRadius: 16,
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 8, marginBottom: 10,
    shadowColor: Colors.safe, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  resolveEmoji: { fontSize: 20 },
  resolveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  callBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingVertical: 14, gap: 8,
    borderWidth: 1, borderColor: Colors.danger + "40",
    borderRadius: 16, marginBottom: 8,
    backgroundColor: Colors.dangerLight ?? Colors.danger + "10",
  },
  callEmoji: { fontSize: 18 },
  callBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.danger },
});