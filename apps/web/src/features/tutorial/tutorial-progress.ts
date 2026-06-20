const STORAGE_KEY = 'anc-tutorial-progress';

export function getCompletedTourIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markTourCompleted(id: string): void {
  const set = new Set(getCompletedTourIds());
  set.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function isTourCompleted(id: string): boolean {
  return getCompletedTourIds().includes(id);
}

export function resetTutorialProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}
