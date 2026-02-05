// Simple in-memory/localStorage based storage for the open-source version
// No database required - everything runs client-side

export interface StoredTokens {
  shortcut?: {
    accessToken: string;
    workspaceId?: string;
    workspaceName?: string;
  };
  linear?: {
    accessToken: string;
    workspaceId?: string;
    workspaceName?: string;
  };
}

export interface MigrationRecord {
  id: string;
  mode: 'ONE_SHOT' | 'TEAM_BY_TEAM' | 'REAL_TIME_SYNC';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  config: Record<string, unknown>;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  startedAt: string;
  completedAt?: string;
  logs: Array<{
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
  }>;
}

// Storage keys
const TOKENS_KEY = 'goodbye-shortcut-tokens';
const MIGRATIONS_KEY = 'goodbye-shortcut-migrations';

// Token storage (uses localStorage in browser)
export function getStoredTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(TOKENS_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function setStoredTokens(tokens: StoredTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKENS_KEY);
}

// Migration records storage
export function getMigrations(): MigrationRecord[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(MIGRATIONS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveMigration(migration: MigrationRecord): void {
  if (typeof window === 'undefined') return;
  const migrations = getMigrations();
  const existingIndex = migrations.findIndex((m) => m.id === migration.id);
  if (existingIndex >= 0) {
    migrations[existingIndex] = migration;
  } else {
    migrations.push(migration);
  }
  localStorage.setItem(MIGRATIONS_KEY, JSON.stringify(migrations));
}

export function getMigration(id: string): MigrationRecord | null {
  const migrations = getMigrations();
  return migrations.find((m) => m.id === id) || null;
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
