// Simple localStorage-based storage.
// No database, no auth server - just browser state.

export const STORAGE_KEY = 'goodbye-shortcut';
export const STORAGE_STATE_CHANGE_EVENT = 'goodbye-shortcut:state-change';

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
}

const DEFAULT_MIGRATION_SETTINGS: MigrationSettings = {
  mode: 'ONE_SHOT',
  includeComments: true,
  includeAttachments: true,
  dryRun: false,
};

let cachedSerializedState: string | null | undefined;
let cachedState: AppState = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
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

  const mode = value.migrationMode;
  const migrationMode: StoredMigrationMode | undefined =
    mode === 'ONE_SHOT' || mode === 'TEAM_BY_TEAM' ? mode : undefined;

  const shortcutTeamId =
    typeof value.shortcutTeamId === 'string'
      ? value.shortcutTeamId
      : typeof value.shortcutTeamId === 'number'
        ? String(value.shortcutTeamId)
        : undefined;

  return {
    shortcutToken:
      typeof value.shortcutToken === 'string' ? value.shortcutToken : undefined,
    linearToken: typeof value.linearToken === 'string' ? value.linearToken : undefined,
    shortcutWorkspace:
      typeof value.shortcutWorkspace === 'string' ? value.shortcutWorkspace : undefined,
    linearWorkspace:
      typeof value.linearWorkspace === 'string' ? value.linearWorkspace : undefined,
    shortcutUserName:
      typeof value.shortcutUserName === 'string' ? value.shortcutUserName : undefined,
    linearUserName:
      typeof value.linearUserName === 'string' ? value.linearUserName : undefined,
    shortcutTeams,
    shortcutTeamId,
    linearTeams,
    linearTeamId: typeof value.linearTeamId === 'string' ? value.linearTeamId : undefined,
    migrationMode,
    includeComments:
      typeof value.includeComments === 'boolean' ? value.includeComments : undefined,
    includeAttachments:
      typeof value.includeAttachments === 'boolean'
        ? value.includeAttachments
        : undefined,
    dryRun: typeof value.dryRun === 'boolean' ? value.dryRun : undefined,
    lastValidatedAt:
      typeof value.lastValidatedAt === 'string' ? value.lastValidatedAt : undefined,
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
