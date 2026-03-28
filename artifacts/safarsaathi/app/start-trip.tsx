import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useTripContext } from "@/context/TripContext";
import { fetchRoute } from "@/services/routeService";

interface LocationResult {
  latitude: number;
  longitude: number;
  name: string;
}

interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16`,
      { headers: { "Accept-Language": "en", "User-Agent": "SafarSaathi/1.0" } }
    );
    const data = await res.json();
    if (data?.display_name) {
      return data.display_name.split(", ").slice(0, 3).join(", ");
    }
  } catch {}
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

async function searchPlaces(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "SafarSaathi/1.0" } }
    );
    return await res.json();
  } catch {
    return [];
  }
}

function formatDisplayName(displayName: string): { main: string; sub: string } {
  const parts = displayName.split(", ");
  return { main: parts[0], sub: parts.slice(1, 4).join(", ") };
}

export default function StartTripScreen() {
  const insets = useSafeAreaInsets();
  const { startTrip } = useTripContext();
  const mapRef = useRef<MapView>(null);

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destination, setDestination] = useState<LocationResult | null>(null);
  const [routePreview, setRoutePreview] = useState<{ latitude: number; longitude: number }[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  const fetchCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setLoadingLocation(false);
          return;
        }
      }
    } catch {}
    // Fallback: New Delhi
    setCurrentLocation({ latitude: 28.6139, longitude: 77.209 });
    setLoadingLocation(false);
  };

  // After destination is selected, fetch real route from Google Directions
  const fetchRoutePreview = useCallback(async (dest: LocationResult, origin: { latitude: number; longitude: number }) => {
    setLoadingRoute(true);
    try {
      const result = await fetchRoute(origin, dest.name);
      if (result) {
        setRoutePreview(result.coordinates.map(c => ({ latitude: c.latitude, longitude: c.longitude })));
        setDistanceKm(result.distanceKm);
        setEta(result.durationMin + " min");

        // Fit map to show entire route
        if (mapRef.current && Platform.OS !== "web" && result.coordinates.length > 0) {
          mapRef.current.fitToCoordinates(
            result.coordinates.map(c => ({ latitude: c.latitude, longitude: c.longitude })),
            { edgePadding: { top: 180, right: 40, bottom: 280, left: 40 }, animated: true }
          );
        }
      } else {
        // Fallback: straight line
        setRoutePreview([
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: dest.latitude, longitude: dest.longitude },
        ]);
        setDistanceKm(null);
        setEta("~");
      }
    } catch {
      setRoutePreview([]);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  const applyDestination = useCallback(
    async (lat: number, lon: number, name: string) => {
      if (!currentLocation) return;
      const dest: LocationResult = { latitude: lat, longitude: lon, name };
      setDestination(dest);
      setShowResults(false);
      setSearchQuery(name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchRoutePreview(dest, currentLocation);
    },
    [currentLocation, fetchRoutePreview]
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowResults(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(text);
      setSearchResults(results);
      setShowResults(results.length > 0);
      setSearching(false);
    }, 500);
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const { main } = formatDisplayName(result.display_name);
    applyDestination(parseFloat(result.lat), parseFloat(result.lon), main);
  };

  const handleMapPress = async (event: any) => {
    const { coordinate } = event.nativeEvent;
    if (!coordinate || !currentLocation) return;
    setGeocoding(true);
    setShowResults(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const name = await reverseGeocode(coordinate.latitude, coordinate.longitude);
    await applyDestination(coordinate.latitude, coordinate.longitude, name);
    setGeocoding(false);
  };

  // THE KEY CHANGE: calls real route service and passes polyline to context
  const handleStart = async () => {
    if (!destination || !currentLocation) return;
    setStartingTrip(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result = await fetchRoute(currentLocation, destination.name);

      if (result) {
        // Pass real polyline and decoded coordinates to context → saved to Firestore
        await startTrip(destination.name, result.durationMin + " min", result.encodedPolyline, result.coordinates);
      } else {
        // Fallback with straight-line route
        const fallbackCoords = [
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude, timestamp: Date.now() },
          { latitude: destination.latitude, longitude: destination.longitude, timestamp: Date.now() + 1000 },
        ];
        await startTrip(destination.name, eta ?? "~", "", fallbackCoords);
      }

      router.replace("/live-tracking");
    } catch (err) {
      Alert.alert("Error", "Could not start trip. Please try again.");
    } finally {
      setStartingTrip(false);
    }
  };

  const region = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }
    : { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  return (
    <View style={styles.container}>
      {/* MAP */}
      {!isWeb ? (
        <View style={[styles.mapContainer, { paddingTop: topPad + 116 }]}>
          {loadingLocation ? (
            <View style={styles.mapLoader}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.mapLoaderText}>Getting your location...</Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_DEFAULT}
              initialRegion={region}
              onPress={handleMapPress}
              onMapReady={() => setMapReady(true)}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {/* Real route polyline preview */}
              {routePreview.length > 1 && (
                <Polyline
                  coordinates={routePreview}
                  strokeColor={Colors.primary}
                  strokeWidth={4}
                />
              )}
              {destination && (
                <Marker
                  coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
                  title={destination.name}
                  pinColor={Colors.danger}
                />
              )}
            </MapView>
          )}
          {/* Route loading overlay */}
          {loadingRoute && (
            <View style={styles.routeLoadingOverlay}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.geocodingText}>Fetching real route...</Text>
            </View>
          )}
          {mapReady && !destination && !geocoding && !loadingRoute && (
            <View style={styles.tapHint}>
              <Text style={styles.tapHintEmoji}>👆</Text>
              <Text style={styles.tapHintText}>Or tap the map to pin destination</Text>
            </View>
          )}
          {geocoding && (
            <View style={styles.geocodingOverlay}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.geocodingText}>Finding location...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.webMapFallback, { marginTop: topPad + 116 }]}>
          <Text style={styles.webMapEmoji}>🗺</Text>
          <Text style={styles.webFallbackTitle}>Map available on mobile</Text>
          <Text style={styles.webFallbackSub}>Scan the QR code to use the full app on your phone</Text>
        </View>
      )}

      {/* TOP BAR + SEARCH */}
      <View style={[styles.topArea, { paddingTop: topPad + 8 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.titleBox}>
            <Text style={styles.headerTitle}>Start Safe Trip</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            {searching ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 10 }} />
            ) : (
              <Text style={styles.searchEmoji}>🔍</Text>
            )}
            <TextInput
              style={styles.searchInput}
              placeholder="Search destination..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowResults(false);
                  setDestination(null);
                  setEta(null);
                  setDistanceKm(null);
                  setRoutePreview([]);
                }}
              >
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          {showResults && searchResults.length > 0 && (
            <View style={styles.resultsDropdown}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.place_id}
                keyboardShouldPersistTaps="always"
                scrollEnabled={false}
                renderItem={({ item, index }) => {
                  const { main, sub } = formatDisplayName(item.display_name);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.resultItem,
                        index < searchResults.length - 1 && styles.resultItemBorder,
                      ]}
                      onPress={() => handleSelectSearchResult(item)}
                    >
                      <Text style={styles.resultEmoji}>📍</Text>
                      <View style={styles.resultText}>
                        <Text style={styles.resultMain} numberOfLines={1}>{main}</Text>
                        <Text style={styles.resultSub} numberOfLines={1}>{sub}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}
        </View>
      </View>

      {/* BOTTOM PANEL */}
      <View style={[styles.bottomPanel, { paddingBottom: bottomPad + 16 }]}>
        {destination ? (
          <>
            <View style={styles.destinationCard}>
              <View style={styles.destIconRow}>
                <View style={styles.destDotFrom} />
                <View style={styles.destLine} />
                <View style={styles.destDotTo} />
              </View>
              <View style={styles.destDetails}>
                <View>
                  <Text style={styles.destLabel}>From</Text>
                  <Text style={styles.destValue}>Your current location</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.destLabel}>To</Text>
                  <Text style={styles.destValue} numberOfLines={2}>{destination.name}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>📏</Text>
                <Text style={styles.statValue}>
                  {loadingRoute ? "..." : distanceKm ? distanceKm.toFixed(1) + " km" : "~"}
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>⏱</Text>
                <Text style={styles.statValue}>{loadingRoute ? "..." : eta ?? "~"}</Text>
                <Text style={styles.statLabel}>Est. Time</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🛣</Text>
                <Text style={styles.statValue}>{loadingRoute ? "..." : "Real"}</Text>
                <Text style={styles.statLabel}>Route</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.startBtn, (startingTrip || loadingRoute) && { opacity: 0.7 }]}
              onPress={handleStart}
              activeOpacity={0.85}
              disabled={startingTrip || loadingRoute}
            >
              {startingTrip ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.startBtnEmoji}>🧭</Text>
              )}
              <Text style={styles.startBtnText}>
                {startingTrip ? "Starting..." : "Start Safe Trip"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelTitle}>Choose Destination</Text>
            <Text style={styles.emptyPanelSub}>
              {isWeb
                ? "Search above or open on mobile to tap the map"
                : "Search above or tap anywhere on the map to set your destination"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  titleBox: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary },
  searchWrapper: { position: "relative", zIndex: 30 },
  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: Platform.OS === "android" ? 6 : 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textPrimary },
  resultsDropdown: {
    backgroundColor: "#fff", borderRadius: 14, marginTop: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 8, overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  resultItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultText: { flex: 1 },
  resultMain: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  resultSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  mapContainer: { flex: 1, overflow: "hidden" },
  mapLoader: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#E8EFF8", gap: 12,
  },
  mapLoaderText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  tapHint: {
    position: "absolute", bottom: 16, alignSelf: "center",
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  tapHintText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  geocodingOverlay: {
    position: "absolute", top: 12, alignSelf: "center",
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  routeLoadingOverlay: {
    position: "absolute", top: 12, alignSelf: "center",
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  geocodingText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  webMapFallback: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#E8EFF8", gap: 10,
  },
  webFallbackTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.primary },
  webFallbackSub: {
    fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary,
    textAlign: "center", paddingHorizontal: 32,
  },
  bottomPanel: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 16,
  },
  emptyPanel: { paddingBottom: 8 },
  emptyPanelTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.textPrimary, marginBottom: 6 },
  emptyPanelSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  destinationCard: { flexDirection: "row", gap: 14, marginBottom: 16 },
  destIconRow: { alignItems: "center", paddingTop: 4 },
  destDotFrom: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.safe, borderWidth: 2, borderColor: Colors.safe },
  destLine: { width: 2, height: 28, backgroundColor: Colors.border, marginVertical: 4 },
  destDotTo: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  destDetails: { flex: 1 },
  destLabel: {
    fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2,
  },
  destValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textPrimary, lineHeight: 18 },
  statsRow: {
    flexDirection: "row", backgroundColor: Colors.primary + "08",
    borderRadius: 14, padding: 14, marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.primary },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  startBtn: {
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  startBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  startBtnEmoji: { fontSize: 20 },
  backArrow: { fontSize: 20, color: Colors.textPrimary, fontFamily: "Inter_500Medium" },
  searchEmoji: { fontSize: 16, marginRight: 10 },
  clearText: { fontSize: 22, color: Colors.textSecondary, lineHeight: 26 },
  resultEmoji: { fontSize: 16 },
  statEmoji: { fontSize: 18 },
  webMapEmoji: { fontSize: 56 },
  tapHintEmoji: { fontSize: 16 },
});