// services/routeService.ts
/**
 * Fetches a real driving route from Google Directions API.
 * Decodes the polyline into coordinate array.
 */

import Constants from "expo-constants";
import type { TripPoint } from "@/context/TripContext";

const API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey ?? "";

export interface RouteResult {
  encodedPolyline: string;
  coordinates: TripPoint[];
  distanceKm: number;
  durationMin: number;
  summary: string;
}

/**
 * Decode a Google encoded polyline string into lat/lng pairs.
 * We inline this to avoid a native module dependency.
 */
function decodePolyline(encoded: string): TripPoint[] {
  const coords: TripPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
      timestamp: 0,
    });
  }
  return coords;
}

export async function fetchRoute(
  origin: { latitude: number; longitude: number },
  destination: string
): Promise<RouteResult | null> {
  if (!API_KEY) {
    console.warn("[RouteService] No Google Maps API key — using mock route");
    return getMockRoute(origin);
  }

  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      originStr
    )}&destination=${encodeURIComponent(destination)}&mode=driving&key=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.routes?.length) {
      console.warn("[RouteService] Directions API error:", data.status);
      return getMockRoute(origin);
    }

    const route = data.routes[0];
    const leg = route.legs[0];
    const encodedPolyline = route.overview_polyline.points;

    return {
      encodedPolyline,
      coordinates: decodePolyline(encodedPolyline),
      distanceKm: leg.distance.value / 1000,
      durationMin: Math.ceil(leg.duration.value / 60),
      summary: route.summary ?? destination,
    };
  } catch (err) {
    console.error("[RouteService] Fetch error:", err);
    return getMockRoute(origin);
  }
}

/** Fallback when no API key is available — creates a straight-line mock route */
function getMockRoute(origin: { latitude: number; longitude: number }): RouteResult {
  // Simulate a route 2km north-east of current location
  const coords: TripPoint[] = Array.from({ length: 20 }, (_, i) => ({
    latitude: origin.latitude + i * 0.001,
    longitude: origin.longitude + i * 0.001,
    timestamp: 0,
  }));
  return {
    encodedPolyline: "",
    coordinates: coords,
    distanceKm: 2.8,
    durationMin: 12,
    summary: "Mock Route (no API key)",
  };
}

