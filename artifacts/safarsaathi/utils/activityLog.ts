// utils/activityLog.ts
/**
 * In-memory activity log for displaying events in the UI demo.
 * Persists for the app session.
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: "info" | "warning" | "danger" | "success";
}

const MAX_ENTRIES = 20;
let _log: LogEntry[] = [];
let _listeners: Array<(log: LogEntry[]) => void> = [];

function notify() {
  _listeners.forEach((fn) => fn([..._log]));
}

export function addLogEntry(message: string, type: LogEntry["type"] = "info") {
  const entry: LogEntry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    message,
    type,
  };
  _log = [entry, ..._log].slice(0, MAX_ENTRIES);
  notify();
}

export function clearLog() {
  _log = [];
  notify();
}

export function subscribeToLog(fn: (log: LogEntry[]) => void): () => void {
  _listeners.push(fn);
  fn([..._log]); // emit current state immediately
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

export function getLog(): LogEntry[] {
  return [..._log];
}
