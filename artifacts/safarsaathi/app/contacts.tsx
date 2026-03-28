// app/contacts.tsx
/**
 * Contacts screen — trusted contacts stored in Firestore via TripContext.
 * addContact is async so we show a saving indicator.
 */

import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { Contact, useTripContext } from "@/context/TripContext";

function ContactCard({ contact, onRemove }: { contact: Contact; onRemove: () => void }) {
  const avatarColors = ["#1E3A8A", "#065F46", "#7C2D12", "#4C1D95", "#1E40AF"];
  const colorIndex = contact.name.charCodeAt(0) % avatarColors.length;

  return (
    <View style={styles.contactCard}>
      <View style={[styles.avatar, { backgroundColor: avatarColors[colorIndex] }]}>
        <Text style={styles.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactPhone}>{contact.phone}</Text>
        {/* Firebase sync indicator */}
        <View style={styles.syncRow}>
          <View style={styles.syncDot} />
          <Text style={styles.syncText}>Synced to cloud</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onRemove();
        }}
        style={styles.removeBtn}
      >
        <Text style={styles.removeBtnText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const { contacts, addContact, removeContact, isFirebaseReady } = useTripContext();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // addContact is async — show loading while saving to Firestore
  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Please enter both name and phone number.");
      return;
    }
    setSaving(true);
    try {
      await addContact(name.trim(), phone.trim());
      setName("");
      setPhone("");
      setShowForm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not save contact. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (id: string, contactName: string) => {
    Alert.alert(
      "Remove Contact",
      `Remove ${contactName} from trusted contacts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeContact(id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad + 16 }]}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Trusted Contacts</Text>
            {/* Firebase status pill */}
            <View style={[styles.firebasePill, { backgroundColor: isFirebaseReady ? "#DCFCE7" : "#FEF3C7" }]}>
              <View style={[styles.firebaseDot, { backgroundColor: isFirebaseReady ? Colors.safe : "#F59E0B" }]} />
              <Text style={[styles.firebasePillText, { color: isFirebaseReady ? Colors.safe : "#92400E" }]}>
                {isFirebaseReady ? "Firestore" : "Local only"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setShowForm(!showForm); }}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>{showForm ? "×" : "+"}</Text>
          </TouchableOpacity>
        </View>

        {/* ADD CONTACT FORM */}
        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Add Trusted Contact</Text>
            <Text style={styles.formSubtitle}>
              This contact will be alerted via Firestore when you trigger an emergency.
            </Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputEmoji}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Contact name"
                placeholderTextColor={Colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!saving}
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputEmoji}>📞</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor={Colors.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!saving}
              />
            </View>
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelFormBtn}
                onPress={() => { setShowForm(false); setName(""); setPhone(""); }}
                disabled={saving}
              >
                <Text style={styles.cancelFormText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>💾 Save to Cloud</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* INFO BAR */}
        <View style={styles.infoBar}>
          <Text style={styles.infoBarEmoji}>🛡</Text>
          <Text style={styles.infoBarText}>
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} will be alerted in any emergency.
            {isFirebaseReady ? " Data saved to Firestore." : " Saved locally."}
          </Text>
        </View>

        {/* CONTACTS LIST */}
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ContactCard
              contact={item}
              onRemove={() => handleRemove(item.id, item.name)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyTitle}>No Contacts Yet</Text>
              <Text style={styles.emptySubtitle}>
                Add trusted contacts who should be notified in emergencies.
                They'll be stored securely in Firestore.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setShowForm(true)}
              >
                <Text style={styles.emptyAddBtnText}>+ Add First Contact</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center",
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary, fontFamily: "Inter_500Medium" },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: Colors.textPrimary },
  firebasePill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, gap: 4,
  },
  firebaseDot: { width: 5, height: 5, borderRadius: 2.5 },
  firebasePillText: { fontFamily: "Inter_500Medium", fontSize: 10 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primaryLight ?? Colors.primary + "15",
    alignItems: "center", justifyContent: "center",
  },
  addBtnText: { fontSize: 22, color: Colors.primary, fontFamily: "Inter_500Medium", lineHeight: 26 },

  // Form
  form: {
    backgroundColor: "#fff", margin: 16, borderRadius: 16, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.textPrimary, marginBottom: 4 },
  formSubtitle: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.textSecondary, marginBottom: 14, lineHeight: 17,
  },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputEmoji: { fontSize: 16 },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textPrimary },
  formActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelFormBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  cancelFormText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  saveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: "center",
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },

  // Info bar
  infoBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primaryLight ?? Colors.primary + "15",
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  infoBarEmoji: { fontSize: 14 },
  infoBarText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 17 },

  // List
  listContent: { padding: 16, flexGrow: 1 },
  contactCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 16, padding: 14, marginBottom: 10, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  contactInfo: { flex: 1 },
  contactName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary },
  contactPhone: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  syncDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.safe },
  syncText: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.safe },
  removeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.dangerLight ?? Colors.danger + "15",
    alignItems: "center", justifyContent: "center",
  },
  removeBtnText: { fontSize: 16 },

  // Empty state
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 10, paddingBottom: 60, paddingTop: 60,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 4 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.textPrimary, marginTop: 8 },
  emptySubtitle: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", maxWidth: 260, lineHeight: 20,
  },
  emptyAddBtn: {
    marginTop: 12, backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  emptyAddBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
});