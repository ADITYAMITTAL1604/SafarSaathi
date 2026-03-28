// utils/riskEngine.ts
/**
 * SafarSaathi Risk Engine
 * Rule-based scoring with time validation and cooldown.
 */

export type RiskLevel = "safe" | "warning" | "danger";

export interface RiskInput {
  routeDeviation: boolean;
  unusualStop: boolean;
  noResponse: boolean;
  unsafeZone: boolean;
}

export interface RiskOutput {
  score: number;
  level: RiskLevel;
  triggers: string[];
}

// Scoring weights
const WEIGHTS = {
  deviation: 30,
  stop: 25,
  unsafeZone: 20,
  noResponse: 40,
} as const;

// Thresholds
const DANGER_THRESHOLD = 61;
const WARNING_THRESHOLD = 31;

/**
 * Compute risk score from boolean inputs.
 * Returns score, level, and human-readable trigger reasons.
 */
export function computeRisk(input: RiskInput): RiskOutput {
  const triggers: string[] = [];
  let score = 0;

  if (input.routeDeviation) {
    score += WEIGHTS.deviation;
    triggers.push("Route deviation detected");
  }
  if (input.unusualStop) {
    score += WEIGHTS.stop;
    triggers.push("Unusual stop detected");
  }
  if (input.unsafeZone) {
    score += WEIGHTS.unsafeZone;
    triggers.push("Entered unsafe zone");
  }
  if (input.noResponse) {
    score += WEIGHTS.noResponse;
    triggers.push("No response from user");
  }

  let level: RiskLevel = "safe";
  if (score >= DANGER_THRESHOLD) level = "danger";
  else if (score >= WARNING_THRESHOLD) level = "warning";

  return { score, level, triggers };
}

// ─── Haversine helpers ────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distance from point P to line segment AB (in km).
 * Uses planar projection — accurate enough for distances < 50km.
 */
export function distanceFromSegmentKm(
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dAB = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  if (dAB < 0.001) {
    return haversineKm(a.latitude, a.longitude, p.latitude, p.longitude);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.latitude - a.latitude) * (b.latitude - a.latitude) +
        (p.longitude - a.longitude) * (b.longitude - a.longitude)) /
        ((b.latitude - a.latitude) ** 2 + (b.longitude - a.longitude) ** 2)
    )
  );
  const projLat = a.latitude + t * (b.latitude - a.latitude);
  const projLon = a.longitude + t * (b.longitude - a.longitude);
  return haversineKm(p.latitude, p.longitude, projLat, projLon);
}

/**
 * Minimum distance from point to any segment of the route polyline (in km).
 */
export function distanceFromRouteKm(
  point: { latitude: number; longitude: number },
  route: { latitude: number; longitude: number }[]
): number {
  if (route.length < 2) return 0;
  let minDist = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = distanceFromSegmentKm(point, route[i], route[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// DEVIATION_THRESHOLD_KM — trigger if user is more than this far from route
export const DEVIATION_THRESHOLD_KM = 0.3; // 300 meters

// STOP_THRESHOLD_KM — user is considered "stopped" if moved less than this
export const STOP_THRESHOLD_KM = 0.05; // 50 meters

// STOP_TIME_MS — must be stopped this long before flagging
export const STOP_TIME_MS = 5 * 60 * 1000; // 5 minutes

// ALERT_COOLDOWN_MS — don't re-trigger alerts more than once per this period
export const ALERT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
