import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

type RiskLevel = "high" | "medium" | "low";

interface RiskZone {
  id: string;
  latOffset: number;
  lonOffset: number;
  radius: number;
  risk: RiskLevel;
  label: string;
  reports: number;
}

const ZONE_TEMPLATES: RiskZone[] = [
  { id: "1", latOffset: 0.009, lonOffset: 0.004, radius: 350, risk: "high", label: "Theft reported area", reports: 12 },
  { id: "2", latOffset: -0.008, lonOffset: -0.011, radius: 280, risk: "medium", label: "Poor street lighting", reports: 5 },
  { id: "3", latOffset: 0.014, lonOffset: -0.006, radius: 300, risk: "low", label: "Patrolled safe zone", reports: 0 },
  { id: "4", latOffset: -0.004, lonOffset: 0.013, radius: 220, risk: "high", label: "Snatch incidents", reports: 8 },
  { id: "5", latOffset: 0.003, lonOffset: 0.017, radius: 260, risk: "medium", label: "Low visibility area", reports: 4 },
  { id: "6", latOffset: -0.013, lonOffset: 0.006, radius: 380, risk: "low", label: "CCTV covered area", reports: 1 },
  { id: "7", latOffset: 0.02, lonOffset: 0.001, radius: 240, risk: "high", label: "Harassment reports", reports: 9 },
];

const riskConfig = {
  high: { color: Colors.danger, label: "High Risk", fill: Colors.danger + "28" },
  medium: { color: Colors.warning, label: "Medium Risk", fill: Colors.warning + "28" },
  low: { color: Colors.safe, label: "Safe Zone", fill: Colors.safe + "28" },
};

interface Zone extends RiskZone {
  latitude: number;
  longitude: number;
}

export default function SafetyMapScreen() {
  const insets = useSafeAreaInsets();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    setLoading(true);
    let lat = 28.6139;
    let lon = 77.209;

    if (Platform.OS !== "web") {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }
      } catch {}
    }

    setUserLat(lat);
    setUserLon(lon);
    setZones(
      ZONE_TEMPLATES.map((t) => ({
        ...t,
        latitude: lat + t.latOffset,
        longitude: lon + t.lonOffset,
      }))
    );
    setLoading(false);
  };

  const region =
    userLat && userLon
      ? {
          latitude: userLat,
          longitude: userLon,
          latitudeDelta: 0.07,
          longitudeDelta: 0.07,
        }
      : undefined;

  return (
    <View style={[styles.container, isWeb && { paddingTop: topPad }]}>
      {!isWeb && !loading && region ? (
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {zones.map((zone) => (
            <React.Fragment key={zone.id}>
              <Circle
                center={{ latitude: zone.latitude, longitude: zone.longitude }}
                radius={zone.radius}
                fillColor={riskConfig[zone.risk].fill}
                strokeColor={riskConfig[zone.risk].color}
                strokeWidth={1.5}
              />
              <Marker
                coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedZone(zone);
                }}
              >
                <View style={[styles.zoneMarker, { backgroundColor: riskConfig[zone.risk].color }]}>
                  <Text style={styles.zoneMarkerEmoji}>
                    {zone.risk === "high" ? "⚠" : zone.risk === "medium" ? "!" : "✓"}
                  </Text>
                </View>
              </Marker>
            </React.Fragment>
          ))}
        </MapView>
      ) : !isWeb && loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loaderText}>Finding your location...</Text>
        </View>
      ) : null}

      {isWeb && (
        <ScrollView
          style={{ flex: 1, marginTop: 64 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 8 }}>
            {zones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                style={[
                  styles.webZoneItem,
                  selectedZone?.id === zone.id && { borderColor: Colors.primary },
                ]}
                onPress={() => setSelectedZone(selectedZone?.id === zone.id ? null : zone)}
              >
                <View style={[styles.webZoneDot, { backgroundColor: riskConfig[zone.risk].color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.webZoneLabel}>{zone.label}</Text>
                  <Text style={styles.webZoneRisk}>
                    {riskConfig[zone.risk].label} • {zone.reports} reports
                  </Text>
                </View>
                <View style={[styles.webZoneBadge, { backgroundColor: riskConfig[zone.risk].fill }]}>
                  <Text style={[styles.webZoneBadgeText, { color: riskConfig[zone.risk].color }]}>
                    {zone.radius}m
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* TOP BAR */}
      <View style={[styles.topBar, { paddingTop: isWeb ? 8 : topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.title}>Safety Map</Text>
          {userLat && !loading && (
            <Text style={styles.titleSub}>Near your location</Text>
          )}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchLocation}>
          <Text style={styles.refreshEmoji}>🔄</Text>
        </TouchableOpacity>
      </View>

      {!isWeb && !loading && (
        <View style={[styles.legend, { top: topPad + 72 }]}>
          {(["high", "medium", "low"] as const).map((risk) => (
            <View key={risk} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: riskConfig[risk].color }]} />
              <Text style={styles.legendText}>{riskConfig[risk].label}</Text>
            </View>
          ))}
        </View>
      )}

      {!isWeb && selectedZone && (
        <View style={[styles.detailCard, { bottom: bottomPad + 24 }]}>
          <View style={styles.detailHeader}>
            <View style={[styles.detailBadge, { backgroundColor: riskConfig[selectedZone.risk].fill }]}>
              <Text style={[styles.detailBadgeText, { color: riskConfig[selectedZone.risk].color }]}>
                {riskConfig[selectedZone.risk].label}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedZone(null)}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailLabel}>{selectedZone.label}</Text>
          <View style={styles.detailStats}>
            <View style={styles.detailStat}>
              <Text style={styles.detailStatEmoji}>📊</Text>
              <Text style={styles.detailStatText}>
                {selectedZone.reports} {selectedZone.reports === 1 ? "report" : "reports"}
              </Text>
            </View>
            <View style={styles.detailStat}>
              <Text style={styles.detailStatEmoji}>📐</Text>
              <Text style={styles.detailStatText}>{selectedZone.radius}m radius</Text>
            </View>
          </View>
        </View>
      )}

      {!isWeb && !selectedZone && !loading && (
        <View style={[styles.hintCard, { bottom: bottomPad + 24 }]}>
          <Text style={styles.hintEmoji}>📍</Text>
          <Text style={styles.hintText}>Tap a zone to see safety details</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8EFF8",
    gap: 12,
  },
  loaderText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  titleBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    alignItems: "center",
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  titleSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  legend: {
    position: "absolute",
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textPrimary,
  },
  zoneMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  detailCard: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  detailBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  detailLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  detailStats: {
    flexDirection: "row",
    gap: 16,
  },
  detailStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailStatText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  hintCard: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  webZoneItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  webZoneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  webZoneLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  webZoneRisk: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  webZoneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  webZoneBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  zoneMarkerEmoji: { fontSize: 9, color: "#fff", fontWeight: "700" },
  backArrow: { fontSize: 20, color: Colors.textPrimary, fontFamily: "Inter_500Medium" },
  refreshEmoji: { fontSize: 18 },
  closeText: { fontSize: 24, color: Colors.textSecondary, lineHeight: 28 },
  detailStatEmoji: { fontSize: 14 },
  hintEmoji: { fontSize: 16 },
});
