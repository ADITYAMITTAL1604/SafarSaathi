import { reloadAppAsync } from "expo";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "@/constants/colors";

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export default function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleReload = async () => {
    try {
      if (Platform.OS !== "web") {
        await reloadAppAsync();
      } else {
        resetError();
      }
    } catch {
      resetError();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>⚠️</Text>
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          An unexpected error occurred. Please reload the app to continue.
        </Text>

        <View style={styles.errorBox}>
          <Text style={styles.errorText} numberOfLines={3}>
            {error.message || "Unknown error"}
          </Text>
        </View>

        <TouchableOpacity style={styles.reloadBtn} onPress={handleReload} activeOpacity={0.85}>
          <Text style={styles.reloadBtnEmoji}>🔄</Text>
          <Text style={styles.reloadBtnText}>Reload App</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.detailsBtn} onPress={() => setShowDetails(true)}>
          <Text style={styles.detailsBtnText}>View Error Details</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDetails} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: "#fff" }]}>
            <View style={[styles.modalHeader, { borderBottomColor: Colors.border }]}>
              <Text style={[styles.modalTitle, { color: Colors.textPrimary }]}>Error Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetails(false)}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
              <View style={[styles.errorContainer, { backgroundColor: "#FEF2F2" }]}>
                <Text style={[styles.errorText, { color: Colors.danger }]}>
                  {error.stack || error.message}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  content: { width: "100%", alignItems: "center" },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 40 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    padding: 14,
    width: "100%",
    marginBottom: 24,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.danger,
  },
  reloadBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
    width: "100%",
  },
  reloadBtnEmoji: { fontSize: 18 },
  reloadBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  detailsBtn: { paddingVertical: 10 },
  detailsBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 28, color: Colors.textSecondary, lineHeight: 32 },
  modalScrollView: { flex: 1 },
  modalScrollContent: { padding: 16 },
  errorContainer: { width: "100%", borderRadius: 8, overflow: "hidden", padding: 16 },
});
