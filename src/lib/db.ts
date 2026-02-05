// Simple localStorage-based storage
// No database, no auth server - just tokens in the browser

const STORAGE_KEY = 'goodbye-shortcut';

export interface AppState {
  shortcutToken?: string;
  linearToken?: string;
  shortcutWorkspace?: string;
  linearWorkspace?: string;
}

export function getState(): AppState {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function setState(state: Partial<AppState>): void {
  if (typeof window === 'undefined') return;
  const current = getState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function hasTokens(): boolean {
  const state = getState();
  return !!(state.shortcutToken && state.linearToken);
}
