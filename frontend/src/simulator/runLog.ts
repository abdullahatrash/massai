import { useCallback, useState } from "react";

export type RunLogEntry = {
  id: string;
  level: "error" | "info" | "success";
  message: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  timestamp: string;
};

const MAX_ENTRIES = 500;

function storageKey(contractId: string) {
  return `sim-run-log:${contractId}`;
}

function readFromStorage(contractId: string): RunLogEntry[] {
  try {
    const raw = sessionStorage.getItem(storageKey(contractId));
    return raw ? (JSON.parse(raw) as RunLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeToStorage(contractId: string, entries: RunLogEntry[]) {
  try {
    sessionStorage.setItem(storageKey(contractId), JSON.stringify(entries));
  } catch {
    // sessionStorage full — ignore
  }
}

export function createRunLogEntry(
  level: RunLogEntry["level"],
  message: string,
  details?: {
    payload?: Record<string, unknown>;
    response?: Record<string, unknown>;
  },
): RunLogEntry {
  return {
    id: `${level}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message,
    payload: details?.payload,
    response: details?.response,
    timestamp: new Date().toISOString(),
  };
}

export function useRunLog(contractId: string) {
  const [entries, setEntries] = useState<RunLogEntry[]>(() =>
    readFromStorage(contractId),
  );

  const append = useCallback(
    (entry: RunLogEntry) => {
      setEntries((current) => {
        const next = [...current, entry].slice(-MAX_ENTRIES);
        writeToStorage(contractId, next);
        return next;
      });
    },
    [contractId],
  );

  const appendMultiple = useCallback(
    (newEntries: RunLogEntry[]) => {
      setEntries((current) => {
        const next = [...current, ...newEntries].slice(-MAX_ENTRIES);
        writeToStorage(contractId, next);
        return next;
      });
    },
    [contractId],
  );

  const clear = useCallback(() => {
    setEntries([]);
    writeToStorage(contractId, []);
  }, [contractId]);

  const reset = useCallback(
    (initial: RunLogEntry[]) => {
      const capped = initial.slice(-MAX_ENTRIES);
      setEntries(capped);
      writeToStorage(contractId, capped);
    },
    [contractId],
  );

  return { entries, append, appendMultiple, clear, reset };
}
