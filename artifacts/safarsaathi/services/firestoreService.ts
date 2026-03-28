// services/firestoreService.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { Contact, Trip, TripPoint } from "@/context/TripContext";

// ─── TRIPS ────────────────────────────────────────────────────────────────────

export async function saveTrip(
  trip: Trip,
  routePolyline: string,
  routeCoords: TripPoint[],
  userId: string
) {
  await setDoc(doc(db, "trips", trip.id), {
    userId,
    destination: trip.destination,
    eta: trip.eta,
    startTime: Timestamp.fromMillis(trip.startTime),
    status: trip.status,
    routePolyline,
    routeCoords,
    lastLocation: null,
    createdAt: serverTimestamp(),
  });
}

export async function updateTripStatus(
  tripId: string,
  status: string,
  lastLocation?: TripPoint | null
) {
  const ref = doc(db, "trips", tripId);
  const update: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (lastLocation) update.lastLocation = lastLocation;
  await updateDoc(ref, update);
}

export async function updateTripLocation(tripId: string, location: TripPoint) {
  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, {
    lastLocation: location,
    updatedAt: serverTimestamp(),
  });
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────

export interface AlertPayload {
  tripId: string;
  triggerType: "deviation" | "stop" | "no_response" | "sos" | "watch_me_expired";
  riskScore: number;
  location: TripPoint | null;
  userId: string;
}

export async function createAlert(payload: AlertPayload): Promise<string> {
  const ref = await addDoc(collection(db, "alerts"), {
    ...payload,
    timestamp: serverTimestamp(),
    notifiedContacts: false,
    simulatedNotification: true,
  });
  return ref.id;
}

// ─── CONTACTS ─────────────────────────────────────────────────────────────────

export async function saveContactsToFirestore(
  contacts: Contact[],
  userId: string
) {
  await setDoc(
    doc(db, "users", userId),
    { contacts, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function loadContactsFromFirestore(
  userId: string
): Promise<Contact[]> {
  const snap = await getDoc(doc(db, "users", userId));
  if (snap.exists()) {
    return snap.data().contacts ?? [];
  }
  return [];
}