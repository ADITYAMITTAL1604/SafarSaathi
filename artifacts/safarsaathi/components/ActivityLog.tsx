// components/ActivityLog.tsx
/**
 * Live activity log — shows real-time safety events during the trip.
 * Subscribes to the in-memory activityLog utility and re-renders on updates.
 * Makes the demo feel like a real monitoring system.
 */

import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "@/constants/colors";
import { subscribeToLog, clearLog, type LogEntry } from "@/utils/activityLog";

// Color map for each log entry type
const TYPE_COLORS: Record<LogEntry["type"], string> = {
  info: Colors.textSecondary,
  success: Colors.safe,
  warning: "#F59E0B",
  danger: Colors.danger,
};

// Background tint for each log entry type
const TYPE_BG: Record<LogEntry["type"], string> = {
  info: "transparent",
  success: "#F0FFF4",
  warning: "#FFFBEB",
  danger: "#FFF5F5",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function ActivityLog() {
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Subscribe to the global activity log — updates on every new entry
    const unsubscribe = subscribeToLog(setLog);
    return unsubscribe;
  }, []);

  if (log.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No activity yet — start a trip or trigger a demo scenario</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header row with clear button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.headerTitle}>ACTIVITY LOG</Text>
        </View>
        <TouchableOpacity onPress={clearLog} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable log entries */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {log.map((entry) => (
          <View
            key={entry.id}
            style={[styles.entry, { backgroundColor: TYPE_BG[entry.type] }]}
          >
            <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
            <Text style={[styles.entryMessage, { color: TYPE_COLORS[entry.type] }]}>
              {entry.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E2530",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2530",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.safe,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#8B949E",
    letterSpacing: 1.2,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  clearBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#8B949E",
  },
  scroll: {
    maxHeight: 180,
  },
  entry: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#161B22",
  },
  entryTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "#484F58",
    width: 64,
    paddingTop: 1,
    flexShrink: 0,
  },
  entryMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  empty: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E2530",
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#484F58",
    textAlign: "center",
    lineHeight: 18,
  },
});