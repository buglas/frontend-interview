const KEY = "yibotu-interview-lab-done";

export function loadDone(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveDone(ids: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(ids));
}
