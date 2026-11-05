// Thin wrappers around localStorage that never throw. Storage can be unavailable
// (private browsing, disabled storage, quota errors) and callers fall back to
// in-memory state plus a visible notice when that happens.

export function probeStorageAvailable(): boolean {
  try {
    const key = "__meeting-assistant.probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredValue(key: string, value: string): boolean {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function removeStoredValue(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
