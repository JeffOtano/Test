// Simple localStorage-based storage.
// No database, no auth server - just browser state.

export const STORAGE_KEY = 'goodbye-shortcut';
export const STORAGE_STATE_CHANGE_EVENT = 'goodbye-shortcut:state-change';

const MAX_SYNC_EVENTS = 400;
const MAX_MIGRATION_HISTORY = 120;

export interface StoredLinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface StoredShortcutTeam {
  id: string;
  name: string;
}

export type StoredMigrationMode = 'ONE_SHOT' | 'TEAM_BY_TEAM';

export interface MigrationSettings {
  shortcutTeamId?: string;
  linearTeamId?: string;
  mode: StoredMigrationMode;
  includeComments: boolean;
  includeAttachments: boolean;
  dryRun: boolean;
}

export interface StoredEntityStats {
  attempted: number;
  created: number;
  reused: number;
  failed: number;
}

export interface MigrationHistoryRecord {
  id: string;
  mode: StoredMigrationMode;
  shortcutTeamId?: string;
  linearTeamId?: string;
  includeComments: boolean;
  includeAttachments: boolean;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  stats: {
    labels: StoredEntityStats;
    projects: StoredEntityStats;
    cycles: StoredEntityStats;
    issues: StoredEntityStats;
    comments: StoredEntityStats;
    attachments: StoredEntityStats;
  };
  errors: string[];
  warnings: string[];
}

export type StoredSyncDirection =
  | 'SHORTCUT_TO_LINEAR'
  | 'LINEAR_TO_SHORTCUT'
  | 'BIDIRECTIONAL';

export type StoredSyncConflictPolicy =
  | 'SHORTCUT_WINS'
  | 'LINEAR_WINS'
  | 'NEWEST_WINS'
  | 'MANUAL';

export type StoredSyncStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';

export interface SyncSettings {
  enabled: boolean;
  direction: StoredSyncDirection;
  shortcutTeamId?: string;
  linearTeamId?: string;
  pollIntervalSeconds: number;
  conflictPolicy: StoredSyncConflictPolicy;
  includeComments: boolean;
  includeAttachments: boolean;
}

export interface SyncCursorState {
  shortcutUpdatedAt?: string;
  linearUpdatedAt?: string;
}

export interface SyncStats {
  cyclesRun: number;
  storiesScanned: number;
  issuesScanned: number;
  createdInLinear: number;
  updatedInLinear: number;
  createdInShortcut: number;
  updatedInShortcut: number;
  conflicts: number;
  errors: number;
  lastRunAt?: string;
  lastRunDurationMs?: number;
  lastError?: string;
}

export type SyncEventLevel = 'INFO' | 'WARN' | 'ERROR';

export interface SyncEventRecord {
  id: string;
  timestamp: string;
  level: SyncEventLevel;
  source: 'shortcut' | 'linear' | 'system';
  action:
    | 'start'
    | 'pause'
    | 'resume'
    | 'cycle'
    | 'create'
    | 'update'
    | 'conflict'
    | 'error'
    | 'noop';
  entityType: 'story' | 'issue' | 'sync';
  entityId: string;
  message: string;
  details?: string;
}

export interface AppState {
  shortcutToken?: string;
  linearToken?: string;
  shortcutWorkspace?: string;
  linearWorkspace?: string;
  shortcutUserName?: string;
  linearUserName?: string;
  shortcutTeams?: StoredShortcutTeam[];
  shortcutTeamId?: string;
  linearTeams?: StoredLinearTeam[];
  linearTeamId?: string;
  migrationMode?: StoredMigrationMode;
  includeComments?: boolean;
  includeAttachments?: boolean;
  dryRun?: boolean;
  lastValidatedAt?: string;
  migrationHistory?: MigrationHistoryRecord[];
  syncSettings?: Partial<SyncSettings>;
  syncStatus?: StoredSyncStatus;
  syncCursors?: SyncCursorState;
  syncStats?: Partial<SyncStats>;
  syncEvents?: SyncEventRecord[];
}

const DEFAULT_MIGRATION_SETTINGS: MigrationSettings = {
  mode: 'ONE_SHOT',
  includeComments: true,
  includeAttachments: true,
  dryRun: false,
};

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: false,
  direction: 'BIDIRECTIONAL',
  pollIntervalSeconds: 30,
  conflictPolicy: 'NEWEST_WINS',
  includeComments: true,
  includeAttachments: false,
};

const DEFAULT_SYNC_STATS: SyncStats = {
  cyclesRun: 0,
  storiesScanned: 0,
  issuesScanned: 0,
  createdInLinear: 0,
  updatedInLinear: 0,
  createdInShortcut: 0,
  updatedInShortcut: 0,
  conflicts: 0,
  errors: 0,
};

let cachedSerializedState: string | null | undefined;
let cachedState: AppState = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function normalizeIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeNonNegativeInt(value: unknown): number | undefined {
  const parsed = normalizeNumber(value);
  if (parsed === undefined) return undefined;
  const int = Math.trunc(parsed);
  return int >= 0 ? int : undefined;
}

function normalizeEntityStats(value: unknown): StoredEntityStats {
  const record = isRecord(value) ? value : {};
  return {
    attempted: normalizeNonNegativeInt(record.attempted) ?? 0,
    created: normalizeNonNegativeInt(record.created) ?? 0,
    reused: normalizeNonNegativeInt(record.reused) ?? 0,
    failed: normalizeNonNegativeInt(record.failed) ?? 0,
  };
}

function normalizeMigrationMode(value: unknown): StoredMigrationMode | undefined {
  return value === 'ONE_SHOT' || value === 'TEAM_BY_TEAM' ? value : undefined;
}

function normalizeSyncDirection(value: unknown): StoredSyncDirection | undefined {
  return value === 'SHORTCUT_TO_LINEAR' ||
    value === 'LINEAR_TO_SHORTCUT' ||
    value === 'BIDIRECTIONAL'
    ? value
    : undefined;
}

function normalizeSyncConflictPolicy(
  value: unknown
): StoredSyncConflictPolicy | undefined {
  return value === 'SHORTCUT_WINS' ||
    value === 'LINEAR_WINS' ||
    value === 'NEWEST_WINS' ||
    value === 'MANUAL'
    ? value
    : undefined;
}

function normalizeSyncStatus(value: unknown): StoredSyncStatus | undefined {
  return value === 'IDLE' || value === 'RUNNING' || value === 'PAUSED' || value === 'ERROR'
    ? value
    : undefined;
}

function normalizeSyncSettings(value: unknown): Partial<SyncSettings> | undefined {
  if (!isRecord(value)) return undefined;

  const pollIntervalSeconds = normalizeNonNegativeInt(value.pollIntervalSeconds);

  return {
    enabled: normalizeBoolean(value.enabled),
    direction: normalizeSyncDirection(value.direction),
    shortcutTeamId: normalizeString(value.shortcutTeamId),
    linearTeamId: normalizeString(value.linearTeamId),
    pollIntervalSeconds:
      pollIntervalSeconds !== undefined
        ? Math.min(Math.max(pollIntervalSeconds, 5), 3600)
        : undefined,
    conflictPolicy: normalizeSyncConflictPolicy(value.conflictPolicy),
    includeComments: normalizeBoolean(value.includeComments),
    includeAttachments: normalizeBoolean(value.includeAttachments),
  };
}

function normalizeSyncStats(value: unknown): Partial<SyncStats> | undefined {
  if (!isRecord(value)) return undefined;

  return {
    cyclesRun: normalizeNonNegativeInt(value.cyclesRun),
    storiesScanned: normalizeNonNegativeInt(value.storiesScanned),
    issuesScanned: normalizeNonNegativeInt(value.issuesScanned),
    createdInLinear: normalizeNonNegativeInt(value.createdInLinear),
    updatedInLinear: normalizeNonNegativeInt(value.updatedInLinear),
    createdInShortcut: normalizeNonNegativeInt(value.createdInShortcut),
    updatedInShortcut: normalizeNonNegativeInt(value.updatedInShortcut),
    conflicts: normalizeNonNegativeInt(value.conflicts),
    errors: normalizeNonNegativeInt(value.errors),
    lastRunAt: normalizeIsoDate(value.lastRunAt),
    lastRunDurationMs: normalizeNonNegativeInt(value.lastRunDurationMs),
    lastError: normalizeString(value.lastError),
  };
}

function normalizeSyncCursors(value: unknown): SyncCursorState | undefined {
  if (!isRecord(value)) return undefined;
  return {
    shortcutUpdatedAt: normalizeIsoDate(value.shortcutUpdatedAt),
    linearUpdatedAt: normalizeIsoDate(value.linearUpdatedAt),
  };
}

function normalizeSyncEvents(value: unknown): SyncEventRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const events = value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const level =
        entry.level === 'INFO' || entry.level === 'WARN' || entry.level === 'ERROR'
          ? entry.level
          : 'INFO';

      const source =
        entry.source === 'shortcut' || entry.source === 'linear' || entry.source === 'system'
          ? entry.source
          : 'system';

      const action =
        entry.action === 'start' ||
        entry.action === 'pause' ||
        entry.action === 'resume' ||
        entry.action === 'cycle' ||
        entry.action === 'create' ||
        entry.action === 'update' ||
        entry.action === 'conflict' ||
        entry.action === 'error' ||
        entry.action === 'noop'
          ? entry.action
          : 'noop';

      const entityType =
        entry.entityType === 'story' || entry.entityType === 'issue' || entry.entityType === 'sync'
          ? entry.entityType
          : 'sync';

      const timestamp = normalizeIsoDate(entry.timestamp) ?? new Date().toISOString();

      return {
        id: normalizeString(entry.id) ?? crypto.randomUUID(),
        timestamp,
        level,
        source,
        action,
        entityType,
        entityId: normalizeString(entry.entityId) ?? 'unknown',
        message: normalizeString(entry.message) ?? 'Event',
        details: normalizeString(entry.details),
      } satisfies SyncEventRecord;
    });

  return events.slice(-MAX_SYNC_EVENTS);
}

function normalizeMigrationHistory(value: unknown): MigrationHistoryRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const history = value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const mode = normalizeMigrationMode(entry.mode) ?? DEFAULT_MIGRATION_SETTINGS.mode;
      const statsRecord = isRecord(entry.stats) ? entry.stats : {};

      return {
        id: normalizeString(entry.id) ?? crypto.randomUUID(),
        mode,
        shortcutTeamId: normalizeString(entry.shortcutTeamId),
        linearTeamId: normalizeString(entry.linearTeamId),
        includeComments: normalizeBoolean(entry.includeComments) ?? true,
        includeAttachments: normalizeBoolean(entry.includeAttachments) ?? true,
        dryRun: normalizeBoolean(entry.dryRun) ?? false,
        startedAt: normalizeIsoDate(entry.startedAt) ?? new Date().toISOString(),
        completedAt: normalizeIsoDate(entry.completedAt) ?? new Date().toISOString(),
        durationMs: normalizeNonNegativeInt(entry.durationMs) ?? 0,
        success: normalizeBoolean(entry.success) ?? false,
        stats: {
          labels: normalizeEntityStats(statsRecord.labels),
          projects: normalizeEntityStats(statsRecord.projects),
          cycles: normalizeEntityStats(statsRecord.cycles),
          issues: normalizeEntityStats(statsRecord.issues),
          comments: normalizeEntityStats(statsRecord.comments),
          attachments: normalizeEntityStats(statsRecord.attachments),
        },
        errors: Array.isArray(entry.errors)
          ? entry.errors
              .map((error) => normalizeString(error))
              .filter((error): error is string => Boolean(error))
          : [],
        warnings: Array.isArray(entry.warnings)
          ? entry.warnings
              .map((warning) => normalizeString(warning))
              .filter((warning): warning is string => Boolean(warning))
          : [],
      } satisfies MigrationHistoryRecord;
    });

  return history
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, MAX_MIGRATION_HISTORY);
}

function normalizeState(value: unknown): AppState {
  if (!isRecord(value)) return {};

  const linearTeams = Array.isArray(value.linearTeams)
    ? value.linearTeams
        .filter((team): team is Record<string, unknown> => isRecord(team))
        .map((team) => ({
          id: String(team.id ?? ''),
          key: String(team.key ?? ''),
          name: String(team.name ?? ''),
        }))
        .filter((team) => team.id && team.name)
    : undefined;

  const shortcutTeams = Array.isArray(value.shortcutTeams)
    ? value.shortcutTeams
        .filter((team): team is Record<string, unknown> => isRecord(team))
        .map((team) => ({
          id: String(team.id ?? ''),
          name: String(team.name ?? ''),
        }))
        .filter((team) => team.id && team.name)
    : undefined;

  const migrationMode = normalizeMigrationMode(value.migrationMode);

  return {
    shortcutToken: normalizeString(value.shortcutToken),
    linearToken: normalizeString(value.linearToken),
    shortcutWorkspace: normalizeString(value.shortcutWorkspace),
    linearWorkspace: normalizeString(value.linearWorkspace),
    shortcutUserName: normalizeString(value.shortcutUserName),
    linearUserName: normalizeString(value.linearUserName),
    shortcutTeams,
    shortcutTeamId: normalizeString(value.shortcutTeamId),
    linearTeams,
    linearTeamId: normalizeString(value.linearTeamId),
    migrationMode,
    includeComments: normalizeBoolean(value.includeComments),
    includeAttachments: normalizeBoolean(value.includeAttachments),
    dryRun: normalizeBoolean(value.dryRun),
    lastValidatedAt: normalizeIsoDate(value.lastValidatedAt),
    migrationHistory: normalizeMigrationHistory(value.migrationHistory),
    syncSettings: normalizeSyncSettings(value.syncSettings),
    syncStatus: normalizeSyncStatus(value.syncStatus),
    syncCursors: normalizeSyncCursors(value.syncCursors),
    syncStats: normalizeSyncStats(value.syncStats),
    syncEvents: normalizeSyncEvents(value.syncEvents),
  };
}

export function getState(): AppState {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === cachedSerializedState) {
      return cachedState;
    }

    if (!stored) {
      cachedSerializedState = null;
      cachedState = {};
      return cachedState;
    }

    cachedSerializedState = stored;
    cachedState = normalizeState(JSON.parse(stored));
    return cachedState;
  } catch {
    return {};
  }
}

export function getMigrationSettings(state: AppState = getState()): MigrationSettings {
  return {
    shortcutTeamId: state.shortcutTeamId,
    linearTeamId: state.linearTeamId,
    mode: state.migrationMode ?? DEFAULT_MIGRATION_SETTINGS.mode,
    includeComments: state.includeComments ?? DEFAULT_MIGRATION_SETTINGS.includeComments,
    includeAttachments:
      state.includeAttachments ?? DEFAULT_MIGRATION_SETTINGS.includeAttachments,
    dryRun: state.dryRun ?? DEFAULT_MIGRATION_SETTINGS.dryRun,
  };
}

export function setState(state: Partial<AppState>): void {
  if (typeof window === 'undefined') return;
  const current = getState();
  const nextState = normalizeState({ ...current, ...state });
  const serialized = JSON.stringify(nextState);
  localStorage.setItem(STORAGE_KEY, serialized);
  cachedSerializedState = serialized;
  cachedState = nextState;
  window.dispatchEvent(new Event(STORAGE_STATE_CHANGE_EVENT));
}

export function setMigrationSettings(settings: Partial<MigrationSettings>): void {
  const current = getMigrationSettings();
  setState({
    shortcutTeamId:
      'shortcutTeamId' in settings ? settings.shortcutTeamId : current.shortcutTeamId,
    linearTeamId:
      'linearTeamId' in settings ? settings.linearTeamId : current.linearTeamId,
    migrationMode: settings.mode ?? current.mode,
    includeComments: settings.includeComments ?? current.includeComments,
    includeAttachments:
      settings.includeAttachments ?? current.includeAttachments,
    dryRun: settings.dryRun ?? current.dryRun,
  });
}

export function getMigrationHistory(state: AppState = getState()): MigrationHistoryRecord[] {
  return state.migrationHistory ?? [];
}

export function appendMigrationHistory(record: MigrationHistoryRecord): void {
  const history = getMigrationHistory();
  const nextHistory = [record, ...history].slice(0, MAX_MIGRATION_HISTORY);
  setState({ migrationHistory: nextHistory });
}

export function getSyncSettings(state: AppState = getState()): SyncSettings {
  const settings = state.syncSettings ?? {};

  return {
    enabled: settings.enabled ?? DEFAULT_SYNC_SETTINGS.enabled,
    direction: settings.direction ?? DEFAULT_SYNC_SETTINGS.direction,
    shortcutTeamId: settings.shortcutTeamId,
    linearTeamId: settings.linearTeamId,
    pollIntervalSeconds:
      settings.pollIntervalSeconds ?? DEFAULT_SYNC_SETTINGS.pollIntervalSeconds,
    conflictPolicy: settings.conflictPolicy ?? DEFAULT_SYNC_SETTINGS.conflictPolicy,
    includeComments:
      settings.includeComments ?? DEFAULT_SYNC_SETTINGS.includeComments,
    includeAttachments:
      settings.includeAttachments ?? DEFAULT_SYNC_SETTINGS.includeAttachments,
  };
}

export function setSyncSettings(settings: Partial<SyncSettings>): void {
  const current = getSyncSettings();
  setState({
    syncSettings: {
      enabled: settings.enabled ?? current.enabled,
      direction: settings.direction ?? current.direction,
      shortcutTeamId:
        'shortcutTeamId' in settings ? settings.shortcutTeamId : current.shortcutTeamId,
      linearTeamId:
        'linearTeamId' in settings ? settings.linearTeamId : current.linearTeamId,
      pollIntervalSeconds:
        settings.pollIntervalSeconds ?? current.pollIntervalSeconds,
      conflictPolicy: settings.conflictPolicy ?? current.conflictPolicy,
      includeComments: settings.includeComments ?? current.includeComments,
      includeAttachments: settings.includeAttachments ?? current.includeAttachments,
    },
  });
}

export function getSyncStatus(state: AppState = getState()): StoredSyncStatus {
  return state.syncStatus ?? 'IDLE';
}

export function setSyncStatus(status: StoredSyncStatus): void {
  setState({ syncStatus: status });
}

export function getSyncCursors(state: AppState = getState()): SyncCursorState {
  return {
    shortcutUpdatedAt: state.syncCursors?.shortcutUpdatedAt,
    linearUpdatedAt: state.syncCursors?.linearUpdatedAt,
  };
}

export function setSyncCursors(cursors: Partial<SyncCursorState>): void {
  const current = getSyncCursors();
  setState({
    syncCursors: {
      shortcutUpdatedAt:
        'shortcutUpdatedAt' in cursors
          ? cursors.shortcutUpdatedAt
          : current.shortcutUpdatedAt,
      linearUpdatedAt:
        'linearUpdatedAt' in cursors
          ? cursors.linearUpdatedAt
          : current.linearUpdatedAt,
    },
  });
}

export function getSyncStats(state: AppState = getState()): SyncStats {
  const stats = state.syncStats ?? {};
  return {
    cyclesRun: stats.cyclesRun ?? DEFAULT_SYNC_STATS.cyclesRun,
    storiesScanned: stats.storiesScanned ?? DEFAULT_SYNC_STATS.storiesScanned,
    issuesScanned: stats.issuesScanned ?? DEFAULT_SYNC_STATS.issuesScanned,
    createdInLinear: stats.createdInLinear ?? DEFAULT_SYNC_STATS.createdInLinear,
    updatedInLinear: stats.updatedInLinear ?? DEFAULT_SYNC_STATS.updatedInLinear,
    createdInShortcut: stats.createdInShortcut ?? DEFAULT_SYNC_STATS.createdInShortcut,
    updatedInShortcut: stats.updatedInShortcut ?? DEFAULT_SYNC_STATS.updatedInShortcut,
    conflicts: stats.conflicts ?? DEFAULT_SYNC_STATS.conflicts,
    errors: stats.errors ?? DEFAULT_SYNC_STATS.errors,
    lastRunAt: stats.lastRunAt,
    lastRunDurationMs: stats.lastRunDurationMs,
    lastError: stats.lastError,
  };
}

export function setSyncStats(stats: Partial<SyncStats>): void {
  const current = getSyncStats();
  setState({
    syncStats: {
      cyclesRun: stats.cyclesRun ?? current.cyclesRun,
      storiesScanned: stats.storiesScanned ?? current.storiesScanned,
      issuesScanned: stats.issuesScanned ?? current.issuesScanned,
      createdInLinear: stats.createdInLinear ?? current.createdInLinear,
      updatedInLinear: stats.updatedInLinear ?? current.updatedInLinear,
      createdInShortcut: stats.createdInShortcut ?? current.createdInShortcut,
      updatedInShortcut: stats.updatedInShortcut ?? current.updatedInShortcut,
      conflicts: stats.conflicts ?? current.conflicts,
      errors: stats.errors ?? current.errors,
      lastRunAt: 'lastRunAt' in stats ? stats.lastRunAt : current.lastRunAt,
      lastRunDurationMs:
        'lastRunDurationMs' in stats
          ? stats.lastRunDurationMs
          : current.lastRunDurationMs,
      lastError: 'lastError' in stats ? stats.lastError : current.lastError,
    },
  });
}

export function getSyncEvents(state: AppState = getState()): SyncEventRecord[] {
  return state.syncEvents ?? [];
}

export function appendSyncEvents(events: SyncEventRecord | SyncEventRecord[]): void {
  const entries = Array.isArray(events) ? events : [events];
  if (entries.length === 0) return;

  const existing = getSyncEvents();
  const merged = [...entries, ...existing]
    .slice(0, MAX_SYNC_EVENTS)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  setState({ syncEvents: merged });
}

export function clearSyncState(): void {
  setState({
    syncSettings: DEFAULT_SYNC_SETTINGS,
    syncStatus: 'IDLE',
    syncCursors: {},
    syncStats: DEFAULT_SYNC_STATS,
    syncEvents: [],
  });
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  cachedSerializedState = null;
  cachedState = {};
  window.dispatchEvent(new Event(STORAGE_STATE_CHANGE_EVENT));
}

export function hasTokens(): boolean {
  const state = getState();
  return Boolean(state.shortcutToken && state.linearToken);
}
