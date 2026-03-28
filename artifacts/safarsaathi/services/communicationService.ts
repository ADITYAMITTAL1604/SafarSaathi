// services/communicationService.ts
/**
 * Real communication via OS intents.
 * Opens SMS app with prefilled emergency message.
 * Opens dialer for phone call.
 * No silent SMS — uses Expo Linking (works on all devices).
 */

import { Linking } from "react-native";
import { addLogEntry } from "@/utils/activityLog";
import type { Contact, TripPoint } from "@/context/TripContext";

/**
 * Build the emergency SMS message body.
 */
function buildEmergencyMessage(
  location: TripPoint | null,
  triggerReason: string,
  userName?: string
): string {
  const name = userName ?? "A SafarSaathi user";
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const locationText = location
    ? `https://maps.google.com/?q=${location.latitude},${location.longitude}`
    : "Location unavailable";

  return (
    `🚨 EMERGENCY ALERT 🚨\n\n` +
    `${name} may be in danger.\n\n` +
    `📍 Location:\n${locationText}\n\n` +
    `🕒 Time: ${time}\n\n` +
    `⚠️ Trigger:\n${triggerReason}\n\n` +
    `Please check immediately.\n\n` +
    `— SafarSaathi Safety App`
  );
}

/**
 * Open SMS app with prefilled emergency message for a contact.
 */
async function sendSMSToContact(
  contact: Contact,
  message: string
): Promise<void> {
  const phone = contact.phone.replace(/\s+/g, "");
  const encoded = encodeURIComponent(message);

  // Android uses ?body=, iOS uses &body=
  const smsUrl = `sms:${phone}${
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent ?? "")
      ? "?body=" + encoded
      : "&body=" + encoded
  }`;

  const canOpen = await Linking.canOpenURL(smsUrl);
  if (canOpen) {
    await Linking.openURL(smsUrl);
    addLogEntry(`📲 SMS opened for ${contact.name}`, "success");
  } else {
    addLogEntry(`⚠️ Could not open SMS for ${contact.name}`, "warning");
  }
}

/**
 * Open dialer to call a contact.
 */
async function callContact(contact: Contact): Promise<void> {
  const phone = contact.phone.replace(/\s+/g, "");
  const callUrl = `tel:${phone}`;
  const canOpen = await Linking.canOpenURL(callUrl);
  if (canOpen) {
    await Linking.openURL(callUrl);
    addLogEntry(`📞 Calling ${contact.name}...`, "danger");
  } else {
    addLogEntry(`⚠️ Could not call ${contact.name}`, "warning");
  }
}

/**
 * Full emergency communication flow:
 * 1. Send SMS to all contacts
 * 2. Call the first (primary) contact
 */
export async function triggerEmergencyCommunication(
  contacts: Contact[],
  location: TripPoint | null,
  triggerReason: string,
  userName?: string
): Promise<void> {
  if (contacts.length === 0) {
    addLogEntry("⚠️ No contacts to notify", "warning");
    return;
  }

  const message = buildEmergencyMessage(location, triggerReason, userName);
  addLogEntry(`🚨 Sending emergency alerts to ${contacts.length} contact(s)`, "danger");

  // Send SMS to each contact one by one
  for (const contact of contacts) {
    try {
      await sendSMSToContact(contact, message);
      // Small delay between opens to avoid overwhelming the OS
      await new Promise((r) => setTimeout(r, 800));
    } catch {
      addLogEntry(`⚠️ SMS failed for ${contact.name}`, "warning");
    }
  }

  // Call primary contact (first in list)
  try {
    await callContact(contacts[0]);
  } catch {
    addLogEntry("⚠️ Call trigger failed", "warning");
  }
}

/**
 * Quick single SMS — used for Watch Me expiry.
 */
export async function sendWatchMeAlert(
  contacts: Contact[],
  location: TripPoint | null
): Promise<void> {
  if (contacts.length === 0) return;

  const time = new Date().toLocaleTimeString("en-IN");
  const locationText = location
    ? `https://maps.google.com/?q=${location.latitude},${location.longitude}`
    : "Location unavailable";

  const message =
    `⏰ WATCH ME ALERT\n\n` +
    `A SafarSaathi user's safety timer expired with no response.\n\n` +
    `📍 Last Location:\n${locationText}\n\n` +
    `🕒 Time: ${time}\n\n` +
    `Please check on them immediately.\n\n` +
    `— SafarSaathi Safety App`;

  for (const contact of contacts) {
    try {
      const phone = contact.phone.replace(/\s+/g, "");
      const encoded = encodeURIComponent(message);
      await Linking.openURL(`sms:${phone}&body=${encoded}`);
      addLogEntry(`📲 Watch Me SMS opened for ${contact.name}`, "danger");
      await new Promise((r) => setTimeout(r, 800));
    } catch {}
  }
}