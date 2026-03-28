// context/TripContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { auth } from "@/config/firebase";
import {
  saveTrip,
  updateTripStatus,
  updateTripLocation,
  createAlert,
  saveContactsToFirestore,
  loadContactsFromFirestore,
} from "@/services/firestoreService";
import {
  computeRisk,
  distanceFromRouteKm,
  haversineKm,
  DEVIATION_THRESHOLD_KM,
  STOP_THRESHOLD_KM,
  STOP_TIME_MS,
  ALERT_COOLDOWN_MS,
} from "@/utils/riskEngine";
import { addLogEntry, clearLog } from "@/utils/activityLog";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "safe" | "warning" | "danger";
export type TripStatus = "idle" | "active" | "emergency" | "completed";

export interface Contact {
  id: string;
  name: string;
  phone: string;
}

export interface TripPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface Trip {
  id: string;
  destination: string;
  eta: string;
  startTime: number;
  endTime?: number;
  status: TripStatus;
  points: TripPoint[];
}

export interface RiskState {
  level: RiskLevel;
  score: number;
  routeDeviation: boolean;
  unusualStop: boolean;
  noResponse: boolean;
  unsafeZone: boolean;
  triggers: string[];
  lastChecked: number;
}

export type WatchMeStatus = "idle" | "active" | "expired";
export type DemoScenario = "deviation" | "stop" | "emergency";

// ─── Context Interface ────────────────────────────────────────────────────────

interface TripContextValue {
  currentTrip: Trip | null;
  riskState: RiskState;
  contacts: Contact[];
  watchMeStatus: WatchMeStatus;
  watchMeMinutes: number;
  watchMeEndTime: number | null;
  userLocation: TripPoint | null;
  routeCoords: TripPoint[];
  routePolyline: string;
  isFirebaseReady: boolean;

  simulateScenario: (scenario: DemoScenario) => void;
  startTrip: (
    destination: string,
    eta: string,
    polyline: string,
    coords: TripPoint[]
  ) => Promise<void>;
  endTrip: () => Promise<void>;
  triggerEmergency: () => Promise<void>;
  respondSafe: () => void;
  startWatchMe: (minutes: number) => void;
  cancelWatchMe: () => void;
  confirmWatchMe: () => void;
  addContact: (name: string, phone: string) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  updateUserLocation: (point: TripPoint) => void;
  setRouteCoords: (coords: TripPoint[]) => void;
  reloadContacts: () => Promise<void>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultRisk: RiskState = {
  level: "safe",
  score: 0,
  routeDeviation: false,
  unusualStop: false,
  noResponse: false,
  unsafeZone: false,
  triggers: [],
  lastChecked: Date.now(),
};

const CONTACTS_KEY = "safarsaathi_contacts";

const TripContext = createContext<TripContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TripProvider({ children }: { children: React.ReactNode }) {
  // Always start with EMPTY contacts — loaded from Firestore per user
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [riskState, setRiskState] = useState<RiskState>(defaultRisk);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [watchMeStatus, setWatchMeStatus] = useState<WatchMeStatus>("idle");
  const [watchMeMinutes, setWatchMeMinutes] = useState(15);
  const [watchMeEndTime, setWatchMeEndTime] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<TripPoint | null>(null);
  const [routeCoords, setRouteCoords] = useState<TripPoint[]>([]);
  const [routePolyline, setRoutePolyline] = useState<string>("");
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  // Refs to avoid stale closures
  const riskStateRef = useRef(riskState);
  const currentTripRef = useRef(currentTrip);
  const routeCoordsRef = useRef(routeCoords);
  const userLocationRef = useRef(userLocation);
  const lastMoveRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const watchMeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviationStartRef = useRef<number | null>(null);

  useEffect(() => { riskStateRef.current = riskState; }, [riskState]);
  useEffect(() => { currentTripRef.current = currentTrip; }, [currentTrip]);
  useEffect(() => { routeCoordsRef.current = routeCoords; }, [routeCoords]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  // ─── Helper: get current user ID ──────────────────────────────────────────

  const getUserId = (): string | null => {
    return auth.currentUser?.uid ?? null;
  };

  // ─── Load contacts for a specific user ────────────────────────────────────

  const loadContactsForUser = async (userId: string) => {
    try {
      // Try Firestore first
      const firestoreContacts = await loadContactsFromFirestore(userId);
      if (firestoreContacts.length > 0) {
        setContacts(firestoreContacts);
        addLogEntry(
          `📋 Loaded ${firestoreContacts.length} contact(s) from Firestore`,
          "info"
        );
        return;
      }
    } catch (err) {
      console.warn("[TripContext] Firestore contacts load failed:", err);
    }

    // Fallback: user-scoped AsyncStorage key
    try {
      const stored = await AsyncStorage.getItem(`${CONTACTS_KEY}_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setContacts(parsed);
        addLogEntry(`📋 Loaded ${parsed.length} contact(s) from local storage`, "info");
      } else {
        // Brand new user — start with empty contacts
        setContacts([]);
        addLogEntry("👤 New user — no contacts yet", "info");
      }
    } catch {
      setContacts([]);
    }
  };

  // ─── Firebase Init — runs once on mount ───────────────────────────────────

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;

    // Poll for auth.currentUser — it may not be set immediately on mount
    const waitForAuth = async () => {
      const tryInit = async () => {
        const currentUser = auth.currentUser;

        if (currentUser) {
          setIsFirebaseReady(true);
          addLogEntry("🔥 Firebase connected", "success");
          addLogEntry(`👤 Signed in: ${currentUser.email}`, "info");
          await loadContactsForUser(currentUser.uid);
          return true;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          console.warn("[TripContext] No auth user after polling — offline mode");
          setIsFirebaseReady(false);
          setContacts([]);
          return true; // stop polling
        }

        return false;
      };

      // Try immediately
      const done = await tryInit();
      if (!done) {
        // Poll every 300ms until user is available
        const interval = setInterval(async () => {
          const finished = await tryInit();
          if (finished) clearInterval(interval);
        }, 300);
      }
    };

    waitForAuth();
  }, []);

  // ─── Export: reload contacts (call after login) ────────────────────────────

  const reloadContacts = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setContacts([]);
      return;
    }
    setContacts([]); // clear first
    await loadContactsForUser(userId);
  }, []);

  // ─── Real-Time Risk Detection ──────────────────────────────────────────────

  useEffect(() => {
    const trip = currentTripRef.current;
    if (!trip || trip.status !== "active" || !userLocation) return;

    const coords = routeCoordsRef.current;
    const current = riskStateRef.current;
    const now = Date.now();

    // 1. Route deviation — check distance from full polyline
    let routeDeviation = current.routeDeviation;
    if (coords.length >= 2) {
      const distKm = distanceFromRouteKm(userLocation, coords);
      const isDeviating = distKm > DEVIATION_THRESHOLD_KM;

      if (isDeviating) {
        if (!deviationStartRef.current) deviationStartRef.current = now;
        routeDeviation = now - deviationStartRef.current > 30_000;
      } else {
        deviationStartRef.current = null;
        routeDeviation = false;
      }
    }

    // 2. Unusual stop — no movement > 50m for 5 minutes
    let unusualStop = current.unusualStop;
    if (!lastMoveRef.current) {
      lastMoveRef.current = {
        lat: userLocation.latitude,
        lon: userLocation.longitude,
        time: now,
      };
    } else {
      const movedKm = haversineKm(
        lastMoveRef.current.lat,
        lastMoveRef.current.lon,
        userLocation.latitude,
        userLocation.longitude
      );
      if (movedKm > STOP_THRESHOLD_KM) {
        lastMoveRef.current = {
          lat: userLocation.latitude,
          lon: userLocation.longitude,
          time: now,
        };
        unusualStop = false;
      } else {
        unusualStop = now - lastMoveRef.current.time > STOP_TIME_MS;
      }
    }

    const newRisk = computeRisk({
      routeDeviation,
      unusualStop,
      noResponse: current.noResponse,
      unsafeZone: current.unsafeZone,
    });

    const updatedRiskState: RiskState = {
      ...newRisk,
      routeDeviation,
      unusualStop,
      noResponse: current.noResponse,
      unsafeZone: current.unsafeZone,
      lastChecked: now,
    };

    setRiskState(updatedRiskState);

    // Log level changes
    if (newRisk.level !== current.level) {
      const emoji =
        newRisk.level === "danger" ? "🔴" :
        newRisk.level === "warning" ? "🟡" : "🟢";
      addLogEntry(
        `${emoji} Risk: ${newRisk.level.toUpperCase()} (score: ${newRisk.score})`,
        newRisk.level
      );
    }

    if (routeDeviation && !current.routeDeviation) {
      addLogEntry("⚠️ Route deviation detected (>300m from route)", "warning");
    }
    if (unusualStop && !current.unusualStop) {
      addLogEntry("⏸️ Unusual stop detected (5+ min stationary)", "warning");
    }

    // Store alert in Firestore with cooldown
    const userId = getUserId();
    const shouldAlert =
      (newRisk.level === "warning" || newRisk.level === "danger") &&
      now - lastAlertTimeRef.current > ALERT_COOLDOWN_MS &&
      isFirebaseReady &&
      userId;

    if (shouldAlert && trip.id) {
      lastAlertTimeRef.current = now;
      const triggerType =
        current.noResponse ? "no_response" :
        routeDeviation ? "deviation" : "stop";

      createAlert({
        tripId: trip.id,
        triggerType,
        riskScore: newRisk.score,
        location: userLocation,
        userId: userId!,
      })
        .then((alertId) => {
          addLogEntry(
            `📡 Alert stored in Firestore (${alertId.slice(0, 6)}...)`,
            "warning"
          );
        })
        .catch(() => {});
    }

    // Update location in Firestore
    if (isFirebaseReady && trip.id) {
      updateTripLocation(trip.id, userLocation).catch(() => {});
    }
  }, [userLocation, isFirebaseReady]);

  // ─── Trip Actions ──────────────────────────────────────────────────────────

  const startTrip = useCallback(
    async (
      destination: string,
      eta: string,
      polyline: string,
      coords: TripPoint[]
    ) => {
      lastMoveRef.current = null;
      deviationStartRef.current = null;
      clearLog();

      const trip: Trip = {
        id: `trip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        destination,
        eta,
        startTime: Date.now(),
        status: "active",
        points: [],
      };

      setCurrentTrip(trip);
      setRiskState(defaultRisk);
      setRouteCoords(coords);
      setRoutePolyline(polyline);

      addLogEntry(`🚀 Trip started → ${destination}`, "success");

      const userId = getUserId();
      if (isFirebaseReady && userId) {
        try {
          await saveTrip(trip, polyline, coords, userId);
          addLogEntry("📦 Trip saved to Firestore", "info");
        } catch (err) {
          console.warn("[TripContext] Trip save failed:", err);
        }
      }
    },
    [isFirebaseReady]
  );

  const endTrip = useCallback(async () => {
    lastMoveRef.current = null;
    deviationStartRef.current = null;

    const trip = currentTripRef.current;
    addLogEntry("✅ Trip ended safely", "success");

    setCurrentTrip((t) =>
      t ? { ...t, status: "completed", endTime: Date.now() } : null
    );
    setRiskState(defaultRisk);
    setRouteCoords([]);
    setRoutePolyline("");

    if (isFirebaseReady && trip?.id) {
      updateTripStatus(trip.id, "completed").catch(() => {});
    }

    setTimeout(() => setCurrentTrip(null), 1500);
  }, [isFirebaseReady]);

  const triggerEmergency = useCallback(async () => {
    const trip = currentTripRef.current;
    const location = userLocationRef.current;
    const userId = getUserId();

    setCurrentTrip((t) => (t ? { ...t, status: "emergency" } : null));
    setRiskState((r) => ({
      ...r,
      noResponse: true,
      level: "danger",
      score: 95,
      triggers: ["Emergency SOS triggered"],
      lastChecked: Date.now(),
    }));

    addLogEntry("🆘 Emergency SOS triggered!", "danger");
    addLogEntry("📲 Opening SMS for all contacts...", "danger");

    if (isFirebaseReady && userId) {
      try {
        await createAlert({
          tripId: trip?.id ?? "sos_no_trip",
          triggerType: "sos",
          riskScore: 95,
          location,
          userId,
        });
        if (trip?.id) {
          await updateTripStatus(trip.id, "emergency", location);
        }
        addLogEntry("📡 Emergency alert stored in Firestore", "danger");
      } catch {}
    }
  }, [isFirebaseReady]);

  const respondSafe = useCallback(() => {
    setRiskState((r) => ({
      ...r,
      noResponse: false,
      level:
        r.score - 40 >= 61 ? "danger" :
        r.score - 40 >= 31 ? "warning" : "safe",
      score: Math.max(0, r.score - 40),
      triggers: r.triggers.filter((t) => !t.includes("response")),
    }));
    addLogEntry("✅ User confirmed safe", "success");
  }, []);

  // ─── Demo Scenarios ────────────────────────────────────────────────────────

  const simulateScenario = useCallback(
    (scenario: DemoScenario) => {
      const userId = getUserId();

      switch (scenario) {
        case "deviation":
          setRiskState({
            ...computeRisk({
              routeDeviation: true,
              unusualStop: false,
              noResponse: false,
              unsafeZone: false,
            }),
            routeDeviation: true,
            unusualStop: false,
            noResponse: false,
            unsafeZone: false,
            lastChecked: Date.now(),
          });
          addLogEntry("🔧 [DEMO] Route deviation triggered", "warning");
          break;

        case "stop":
          setRiskState({
            ...computeRisk({
              routeDeviation: false,
              unusualStop: true,
              noResponse: false,
              unsafeZone: false,
            }),
            routeDeviation: false,
            unusualStop: true,
            noResponse: false,
            unsafeZone: false,
            lastChecked: Date.now(),
          });
          addLogEntry("🔧 [DEMO] Unusual stop triggered", "warning");
          break;

        case "emergency":
          setRiskState({
            ...computeRisk({
              routeDeviation: true,
              unusualStop: true,
              noResponse: true,
              unsafeZone: false,
            }),
            routeDeviation: true,
            unusualStop: true,
            noResponse: true,
            unsafeZone: false,
            level: "danger",
            score: 95,
            lastChecked: Date.now(),
          });
          addLogEntry("🔧 [DEMO] Full emergency triggered", "danger");
          addLogEntry("📲 Simulated alert sent to contacts", "danger");

          const trip = currentTripRef.current;
          const location = userLocationRef.current;
          if (isFirebaseReady && userId) {
            createAlert({
              tripId: trip?.id ?? "demo_emergency",
              triggerType: "sos",
              riskScore: 95,
              location,
              userId,
            }).catch(() => {});
          }
          break;
      }
    },
    [isFirebaseReady]
  );

  // ─── Watch Me ──────────────────────────────────────────────────────────────

  const startWatchMe = useCallback(
    (minutes: number) => {
      setWatchMeMinutes(minutes);
      setWatchMeStatus("active");
      const end = Date.now() + minutes * 60 * 1000;
      setWatchMeEndTime(end);
      addLogEntry(`👁 Watch Me started — ${minutes} min`, "info");

      if (watchMeTimerRef.current) clearTimeout(watchMeTimerRef.current);
      watchMeTimerRef.current = setTimeout(async () => {
        setWatchMeStatus("expired");
        setWatchMeEndTime(null);
        addLogEntry("⏰ Watch Me expired — alerting contacts!", "danger");

        const userId = getUserId();
        if (isFirebaseReady && userId) {
          try {
            await createAlert({
              tripId: currentTripRef.current?.id ?? "watch_me",
              triggerType: "watch_me_expired",
              riskScore: 40,
              location: userLocationRef.current,
              userId,
            });
            addLogEntry("📡 Watch Me alert stored in Firestore", "danger");
          } catch {}
        }
      }, minutes * 60 * 1000);
    },
    [isFirebaseReady]
  );

  const cancelWatchMe = useCallback(() => {
    if (watchMeTimerRef.current) clearTimeout(watchMeTimerRef.current);
    setWatchMeStatus("idle");
    setWatchMeEndTime(null);
    addLogEntry("Watch Me cancelled", "info");
  }, []);

  const confirmWatchMe = useCallback(() => {
    if (watchMeTimerRef.current) clearTimeout(watchMeTimerRef.current);
    setWatchMeStatus("idle");
    setWatchMeEndTime(null);
    addLogEntry("✅ Watch Me confirmed safe", "success");
  }, []);

  // ─── Contacts ─────────────────────────────────────────────────────────────

  const addContact = useCallback(
    async (name: string, phone: string) => {
      const userId = getUserId();

      const newContact: Contact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        phone,
      };

      // Use functional update to get latest contacts
      let updatedContacts: Contact[] = [];
      setContacts((prev) => {
        updatedContacts = [...prev, newContact];
        return updatedContacts;
      });

      addLogEntry(`➕ Contact added: ${name}`, "info");

      if (!userId) {
        console.warn("[TripContext] No userId — cannot save contact");
        return;
      }

      // Save to user-scoped local storage
      await AsyncStorage.setItem(
        `${CONTACTS_KEY}_${userId}`,
        JSON.stringify([...contacts, newContact])
      ).catch(() => {});

      // Save to Firestore under this user's document
      if (isFirebaseReady) {
        saveContactsToFirestore([...contacts, newContact], userId)
          .then(() => addLogEntry("☁️ Contact synced to Firestore", "success"))
          .catch((err) =>
            console.warn("[TripContext] Contact Firestore save failed:", err)
          );
      }
    },
    [contacts, isFirebaseReady]
  );

  const removeContact = useCallback(
    async (id: string) => {
      const userId = getUserId();
      const updated = contacts.filter((c) => c.id !== id);
      setContacts(updated);

      if (!userId) return;

      await AsyncStorage.setItem(
        `${CONTACTS_KEY}_${userId}`,
        JSON.stringify(updated)
      ).catch(() => {});

      if (isFirebaseReady) {
        saveContactsToFirestore(updated, userId).catch(() => {});
      }
    },
    [contacts, isFirebaseReady]
  );

  const updateUserLocation = useCallback((point: TripPoint) => {
    setUserLocation(point);
    setCurrentTrip((t) =>
      t ? { ...t, points: [...t.points.slice(-50), point] } : t
    );
  }, []);

  const setRouteCoordsCallback = useCallback((coords: TripPoint[]) => {
    setRouteCoords(coords);
  }, []);

  // ─── Provider ──────────────────────────────────────────────────────────────

  return (
    <TripContext.Provider
      value={{
        currentTrip,
        riskState,
        contacts,
        watchMeStatus,
        watchMeMinutes,
        watchMeEndTime,
        userLocation,
        routeCoords,
        routePolyline,
        isFirebaseReady,
        simulateScenario,
        startTrip,
        endTrip,
        triggerEmergency,
        respondSafe,
        startWatchMe,
        cancelWatchMe,
        confirmWatchMe,
        addContact,
        removeContact,
        updateUserLocation,
        setRouteCoords: setRouteCoordsCallback,
        reloadContacts,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTripContext must be used inside TripProvider");
  return ctx;
}