const PREFIX = "ota:";

export function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function writeList<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function clearAll() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}

export const KEYS = {
  employees: "employees",
  trains: "trains",
  dutysheets: "dutysheets",
  seeded: "seeded",
};
