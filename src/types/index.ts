// Migration Types
export type MigrationMode = 'ONE_SHOT' | 'TEAM_BY_TEAM' | 'REAL_TIME_SYNC';
export type MigrationStatus = 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED';
export type SyncDirection = 'SHORTCUT_TO_LINEAR' | 'LINEAR_TO_SHORTCUT' | 'BIDIRECTIONAL';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// Shortcut Types
export interface ShortcutWorkspace {
  id: string;
  name: string;
  url_slug: string;
}

export interface ShortcutTeam {
  id: number;
  name: string;
  description: string;
  workflow_ids: number[];
}

export interface ShortcutProject {
  id: number;
  name: string;
  description: string;
  team_id: number;
  color: string;
}

export interface ShortcutEpic {
  id: number;
  name: string;
  description: string;
  state: string;
  project_ids: number[];
}

export interface ShortcutIteration {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface ShortcutStory {
  id: number;
  name: string;
  description?: string | null;
  story_type: 'feature' | 'bug' | 'chore';
  workflow_state_id: number;
  epic_id?: number;
  iteration_id?: number;
  project_id?: number;
  labels: ShortcutLabel[];
  owner_ids: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  estimate?: number;
  external_links: Array<
    | string
    | {
        url?: string;
        title?: string;
        [key: string]: unknown;
      }
  >;
}

export interface ShortcutLabel {
  id: number;
  name: string;
  color: string;
}

export interface ShortcutWorkflowState {
  id: number;
  name: string;
  type: 'unstarted' | 'started' | 'done';
  position: number;
}

export interface ShortcutMember {
  id: string;
  profile: {
    email_address: string;
    name: string;
    display_icon?: {
      url: string;
    };
  };
  role: string;
}

export interface ShortcutComment {
  id: number;
  text: string;
  author_id: string;
  created_at: string;
  updated_at: string;
}

// Linear Types
export interface LinearWorkspace {
  id: string;
  name: string;
  urlKey: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  teamIds: string[];
}

export interface LinearCycle {
  id: string;
  name?: string;
  number: number;
  startsAt: string;
  endsAt: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: LinearWorkflowState;
  priority: number;
  estimate?: number;
  labels: LinearLabel[];
  assignee?: LinearUser;
  project?: LinearProject;
  cycle?: LinearCycle;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LinearAttachment {
  id: string;
  title?: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  position: number;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface LinearComment {
  id: string;
  body: string;
  user: LinearUser;
  createdAt: string;
  updatedAt: string;
}

// Mapping Types
export interface FieldMapping {
  shortcutField: string;
  linearField: string;
  transform?: (value: unknown) => unknown;
}

export interface WorkflowStateMapping {
  shortcutStateId: number;
  linearStateId: string;
}

export interface TeamMapping {
  shortcutTeamId: number;
  linearTeamId: string;
}

export interface MigrationConfig {
  mode: MigrationMode;
  shortcutWorkspaceId: string;
  linearWorkspaceId: string;
  teamMappings: TeamMapping[];
  workflowStateMappings: WorkflowStateMapping[];
  epicHandling: 'project' | 'label' | 'skip';
  includeComments: boolean;
  includeAttachments: boolean;
  dryRun: boolean;
}

export interface MigrationProgress {
  totalItems: number;
  processedItems: number;
  successCount: number;
  errorCount: number;
  currentPhase: 'teams' | 'projects' | 'labels' | 'epics' | 'iterations' | 'stories' | 'comments' | 'attachments';
  startedAt: string;
  estimatedCompletion?: string;
}

export interface MigrationLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Sync Types
export interface SyncConfig {
  id: string;
  shortcutWorkspaceId: string;
  linearWorkspaceId: string;
  direction: SyncDirection;
  enabled: boolean;
  teamIds: string[];
}

export interface SyncEvent {
  id: string;
  source: 'shortcut' | 'linear';
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  processedAt?: string;
  error?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  cursor?: string;
}
