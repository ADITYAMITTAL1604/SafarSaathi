import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import ActivityLog from "@/components/ActivityLog";
import RiskAlertDialog from "@/components/RiskAlertDialog";
import SOSButton from "@/components/SOSButton";
import StatusBadge from "@/components/StatusBadge";
import { useTripContext, type DemoScenario } from "@/context/TripContext";

export default function LiveTrackingScreen() {
  const insets = useSafeAreaInsets();
  const {
    currentTrip,
    riskState,
    userLocation,
    routeCoords,
    simulateScenario,
    endTrip,
    triggerEmergency,
    respondSafe,
    updateUserLocation,
    isFirebaseReady,
  } = useTripContext();

  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [showLog, setShowLog] = useState(false);
  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(120)).current;
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const alertShownForLevelRef = useRef<string>("safe");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 120 }).start();
    if (Platform.OS !== "web") {
      startRealTimeTracking();
    }
    return () => {
      locationSubRef.current?.remove();
    };
  }, []);

  const startRealTimeTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      updateUserLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        timestamp: Date.now(),
      });

      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 20 },
        (loc) => {
          updateUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: Date.now(),
          });
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
              800
            );
          }
        }
      );
    } catch {}
  };

  // Show alert dialog when risk level escalates
  useEffect(() => {
    if (
      (riskState.level === "warning" || riskState.level === "danger") &&
      !showAlert &&
      alertShownForLevelRef.current !== riskState.level
    ) {
      alertShownForLevelRef.current = riskState.level;
      const triggers = riskState.triggers ?? [];
      const msg = triggers.length > 0
        ? triggers.join(". ") + ". Are you safe?"
        : "Risk detected on your journey. Are you safe?";
      setAlertMessage(msg);
      setShowAlert(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    if (riskState.level === "safe") {
      alertShownForLevelRef.current = "safe";
    }
  }, [riskState.level, riskState.score]);

  const handleSafe = () => {
    setShowAlert(false);
    respondSafe();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAlert = () => {
    setShowAlert(false);
    triggerEmergency();
    router.replace("/emergency");
  };

  const handleEndTrip = async () => {
    locationSubRef.current?.remove();
    await endTrip();
    router.replace("/");
  };

  const centerLat = userLocation?.latitude ?? 19.076;
  const centerLon = userLocation?.longitude ?? 72.8777;
  const destCoord = routeCoords.length >= 2 ? routeCoords[routeCoords.length - 1] : null;

  const riskColor =
    riskState.level === "safe" ? Colors.safe :
    riskState.level === "warning" ? "#F59E0B" : Colors.danger;

  return (
    <View style={styles.container}>
      {/* MAP */}
      {Platform.OS !== "web" && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={{ latitude: centerLat, longitude: centerLon, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {userLocation && (
            <Marker coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}>
              <View style={[styles.locationMarker, { borderColor: riskColor }]}>
                <View style={[styles.locationDot, { backgroundColor: riskColor }]} />
              </View>
            </Marker>
          )}
          {/* Real route polyline from Google Directions */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeColor={Colors.primary}
              strokeWidth={4}
            />
          )}
          {destCoord && (
            <Marker coordinate={{ latitude: destCoord.latitude, longitude: destCoord.longitude }}>
              <View style={styles.destMarkerContainer}>
                <Text style={styles.destMarkerPin}>📍</Text>
              </View>
            </Marker>
          )}
        </MapView>
      )}

      {Platform.OS === "web" && (
        <View style={styles.webMap}>
          <Text style={styles.webMapText}>🗺 Live map on mobile</Text>
        </View>
      )}

      {/* TOP BAR */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={handleEndTrip} style={styles.iconBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <StatusBadge level={riskState.level} score={riskState.score} />

        <View style={styles.topRightBtns}>
          {/* Firebase status dot */}
          <View style={[styles.firebaseDot, { backgroundColor: isFirebaseReady ? Colors.safe : "#F59E0B" }]} />
          <TouchableOpacity
            onPress={() => {
              if (mapRef.current && userLocation && Platform.OS !== "web") {
                mapRef.current.animateToRegion(
                  { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                  500
                );
              }
            }}
            style={styles.iconBtn}
          >
            <Text style={styles.locateIcon}>⊕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BOTTOM PANEL */}
      <Animated.View style={[styles.bottomPanel, { paddingBottom: bottomPad + 8, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* Trip Info Row */}
          <View style={styles.tripInfo}>
            <View style={styles.tripInfoItem}>
              <Text style={styles.tripInfoEmoji}>🧭</Text>
              <Text style={styles.tripInfoLabel}>Destination</Text>
              <Text style={styles.tripInfoValue} numberOfLines={1}>{currentTrip?.destination || "—"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.tripInfoItem}>
              <Text style={styles.tripInfoEmoji}>⏱</Text>
              <Text style={styles.tripInfoLabel}>ETA</Text>
              <Text style={styles.tripInfoValue}>{currentTrip?.eta || "—"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.tripInfoItem}>
              <Text style={styles.tripInfoEmoji}>📊</Text>
              <Text style={styles.tripInfoLabel}>Risk Score</Text>
              <Text style={[styles.tripInfoValue, { color: riskColor }]}>{riskState.score}/100</Text>
            </View>
          </View>

          {/* ── DEMO SCENARIOS PANEL ── */}
          <View style={styles.demoPanel}>
            <View style={styles.demoPanelHeader}>
              <Text style={styles.demoPanelTitle}>🔧 Demo Scenarios</Text>
              <Text style={styles.demoPanelSub}>Tap to simulate for judges</Text>
            </View>
            <View style={styles.demoRow}>
              <TouchableOpacity
                style={[styles.demoBtn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B40" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  simulateScenario("deviation");
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.demoBtnIcon}>📍</Text>
                <Text style={[styles.demoBtnText, { color: "#92400E" }]}>Deviation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoBtn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B40" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  simulateScenario("stop");
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.demoBtnIcon}>⏸</Text>
                <Text style={[styles.demoBtnText, { color: "#92400E" }]}>Stop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoBtn, { backgroundColor: "#FEE2E2", borderColor: Colors.danger + "40" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  simulateScenario("emergency");
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.demoBtnIcon}>🆘</Text>
                <Text style={[styles.demoBtnText, { color: Colors.danger }]}>Emergency</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Activity Log toggle */}
          <TouchableOpacity
            style={styles.logToggle}
            onPress={() => setShowLog((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.logToggleText}>
              {showLog ? "▲ Hide Activity Log" : "▼ Show Activity Log"}
            </Text>
          </TouchableOpacity>

          {showLog && <ActivityLog />}

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.endBtn} onPress={handleEndTrip}>
              <Text style={styles.endBtnEmoji}>⏹</Text>
              <Text style={styles.endBtnText}>End Trip</Text>
            </TouchableOpacity>

            <SOSButton
              onPress={() => { triggerEmergency(); router.push("/emergency"); }}
              size={64}
              pulsing={riskState.level === "danger"}
            />

            <TouchableOpacity style={styles.contactsBtn} onPress={() => router.push("/contacts")}>
              <Text style={styles.contactsBtnEmoji}>👥</Text>
              <Text style={styles.contactsBtnText}>Contacts</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>

      <RiskAlertDialog
        visible={showAlert}
        message={alertMessage}
        onSafe={handleSafe}
        onAlert={handleAlert}
        timeoutSeconds={15}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webMap: { flex: 1, backgroundColor: "#E8EFF8", alignItems: "center", justifyContent: "center" },
  webMapText: { fontSize: 18, fontFamily: "Inter_500Medium", color: Colors.primary },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  topRightBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  firebaseDot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  backArrow: { fontSize: 20, color: Colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  locateIcon: { fontSize: 18, color: Colors.primary },
  locationMarker: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff",
    borderWidth: 3, alignItems: "center", justifyContent: "center",
  },
  locationDot: { width: 10, height: 10, borderRadius: 5 },
  destMarkerContainer: { alignItems: "center" },
  destMarkerPin: { fontSize: 28 },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20, maxHeight: "62%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  tripInfo: { flexDirection: "row", marginBottom: 14 },
  tripInfoItem: { flex: 1, alignItems: "center", gap: 3 },
  tripInfoEmoji: { fontSize: 14 },
  tripInfoLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  tripInfoValue: {
    fontFamily: "Inter_600SemiBold", fontSize: 13,
    color: Colors.textPrimary, textAlign: "center", maxWidth: 80,
  },
  divider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Demo panel
  demoPanel: {
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.primary + "18",
  },
  demoPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  demoPanelTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textPrimary },
  demoPanelSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  demoRow: { flexDirection: "row", gap: 8 },
  demoBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: "center", gap: 4, borderWidth: 1,
  },
  demoBtnIcon: { fontSize: 16 },
  demoBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  // Log toggle
  logToggle: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 4,
  },
  logToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primary,
  },

  bottomActions: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingTop: 8, paddingBottom: 4,
  },
  endBtn: { alignItems: "center", gap: 4 },
  endBtnEmoji: { fontSize: 18 },
  endBtnText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.textSecondary },
  contactsBtn: { alignItems: "center", gap: 4 },
  contactsBtnEmoji: { fontSize: 18 },
  contactsBtnText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.primary },
});