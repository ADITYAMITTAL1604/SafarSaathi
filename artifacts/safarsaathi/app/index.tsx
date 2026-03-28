// app/index.tsx

import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
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

interface ActionButtonProps {
  emoji: string;
  label: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
  onPress: () => void;
  primary?: boolean;
}

function ActionButton({
  emoji,
  label,
  subtitle,
  accentColor,
  bgColor,
  onPress,
  primary,
}: ActionButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.actionButton,
          { backgroundColor: bgColor },
          primary && styles.primaryButton,
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: primary ? "rgba(255,255,255,0.2)" : accentColor + "18" }]}>
          <Text style={styles.iconEmoji}>{emoji}</Text>
        </View>
        <View style={styles.buttonTextContainer}>
          <Text style={[styles.buttonLabel, { color: primary ? "#fff" : Colors.textPrimary }]}>
            {label}
          </Text>
          <Text style={[styles.buttonSubtitle, { color: primary ? "rgba(255,255,255,0.75)" : Colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: primary ? "rgba(255,255,255,0.7)" : Colors.textSecondary }]}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { currentTrip, triggerEmergency } = useTripContext();
  const { user, logout } = useAuth();

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(40)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
    router.replace("/login");
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad + 16 }]}>

      {/* HEADER */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          },
        ]}
      >
        {/* Top row: title + shield + logout */}
        <View style={styles.headerTop}>
          <View style={styles.headerTitles}>
            <Text style={styles.appName}>SafarSaathi</Text>
            <Text style={styles.tagline}>Your safety companion on every journey</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.shieldContainer}>
              <Text style={styles.shieldEmoji}>🛡</Text>
            </View>
          </View>
        </View>

        {/* User email + logout */}
        <View style={styles.userRow}>
          <View style={styles.userInfo}>
            <View style={styles.userDot} />
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email ?? "Guest"}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Status bar */}
        <View style={[
          styles.statusBar,
          {
            backgroundColor: currentTrip?.status === "active"
              ? Colors.primary + "15"
              : Colors.safeLight,
          }
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: currentTrip?.status === "active" ? Colors.primary : Colors.safe }
          ]} />
          <Text style={[
            styles.statusText,
            { color: currentTrip?.status === "active" ? Colors.primary : Colors.safe }
          ]}>
            {currentTrip?.status === "active" ? "Trip in progress" : "Ready to protect you"}
          </Text>
        </View>
      </Animated.View>

      {/* CONTENT */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentAnim }],
          },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Active trip banner */}
          {currentTrip?.status === "active" && (
            <Pressable
              style={styles.activeTripBanner}
              onPress={() => router.push("/live-tracking")}
            >
              <View style={styles.activeTripLeft}>
                <View style={styles.activeTripDot} />
                <View>
                  <Text style={styles.activeTripLabel}>Trip Active</Text>
                  <Text style={styles.activeTripDest} numberOfLines={1}>
                    {currentTrip.destination}
                  </Text>
                </View>
              </View>
              <Text style={styles.activeTripAction}>View ›</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <ActionButton
            primary
            emoji="🧭"
            label="Start Safe Trip"
            subtitle="Route tracking & monitoring"
            accentColor={Colors.primary}
            bgColor={Colors.primary}
            onPress={() => router.push("/start-trip")}
          />

          <ActionButton
            emoji="👁"
            label="Watch Me"
            subtitle="Time-based safety check-in"
            accentColor={Colors.safe}
            bgColor="#fff"
            onPress={() => router.push("/watch-me")}
          />

          <ActionButton
            emoji="🗺"
            label="Safety Map"
            subtitle="View risk zones around you"
            accentColor={Colors.primary}
            bgColor="#fff"
            onPress={() => router.push("/safety-map")}
          />

          <ActionButton
            emoji="👥"
            label="Trusted Contacts"
            subtitle="Manage emergency contacts"
            accentColor={Colors.textSecondary}
            bgColor="#fff"
            onPress={() => router.push("/contacts")}
          />

          {/* SOS Row */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              triggerEmergency();
              router.push("/emergency");
            }}
            style={({ pressed }) => [styles.sosRow, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.sosEmoji}>🆘</Text>
            <Text style={styles.sosText}>Emergency SOS</Text>
            <Text style={[styles.chevron, { color: Colors.danger }]}>›</Text>
          </Pressable>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerTitles: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  appName: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    maxWidth: 220,
  },
  shieldContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  shieldEmoji: { fontSize: 28 },

  // User row
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  userDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.safe,
  },
  userEmail: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#fff",
  },
  logoutText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Status bar
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },

  // Content
  content: { flex: 1 },
  activeTripBanner: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  activeTripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  activeTripDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.safe,
  },
  activeTripLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  activeTripDest: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
    maxWidth: 200,
  },
  activeTripAction: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.safe,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButton: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 22 },
  buttonTextContainer: { flex: 1 },
  buttonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  buttonSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 24,
  },
  sosRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 4,
    gap: 8,
  },
  sosEmoji: { fontSize: 18 },
  sosText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.danger,
    flex: 1,
    textAlign: "center",
  },
});