import {
  appendSyncEvents,
  getState,
  getSyncCursors,
  getSyncSettings,
  getSyncStats,
  setSyncCursors,
  setSyncSettings,
  setSyncStats,
  setSyncStatus,
  StoredSyncConflictPolicy,
  StoredSyncDirection,
  SyncCursorState,
  SyncEventRecord,
  SyncStats,
} from '../db';
import { LinearClient } from '../linear/client';
import { ShortcutClient } from '../shortcut/client';
import {
  buildLinearStateIdByShortcutType,
  buildShortcutStateIdByType,
  buildShortcutStateTypeById,
  mapIssueToShortcutStateId,
  mapStoryToLinearStateId,
} from '../workflow-state-mapping';
import { LinearComment, LinearIssue, ShortcutComment, ShortcutStory } from '@/types';

const SYNC_METADATA_MARKER = 'Synced by Goodbye Shortcut';

interface SyncEngineConfig {
  direction: StoredSyncDirection;
  conflictPolicy: StoredSyncConflictPolicy;
  shortcutTeamId?: string;
  linearTeamId: string;
  includeComments: boolean;
  includeAttachments: boolean;
}

interface RunSyncCycleInput {
  shortcutToken: string;
  linearToken: string;
  config: SyncEngineConfig;
  cursors?: SyncCursorState;
  triggerSource?: 'shortcut' | 'linear' | 'system';
  triggerReason?: string;
}

interface SyncDeltaStats {
  storiesScanned: number;
  issuesScanned: number;
  createdInLinear: number;
  updatedInLinear: number;
  createdInShortcut: number;
  updatedInShortcut: number;
  conflicts: number;
  errors: number;
}

export interface SyncCycleResult {
  cursors: SyncCursorState;
  delta: SyncDeltaStats;
  events: SyncEventRecord[];
  durationMs: number;
}

let syncIntervalHandle: ReturnType<typeof setInterval> | null = null;
let syncCycleInFlight = false;

function nowIso(): string {
  return new Date().toISOString();
}

function createEvent(params: {
  level: SyncEventRecord['level'];
  source: SyncEventRecord['source'];
  action: SyncEventRecord['action'];
  entityType: SyncEventRecord['entityType'];
  entityId: string;
  message: string;
  details?: string;
}): SyncEventRecord {
  return {
    id: crypto.randomUUID(),
    timestamp: nowIso(),
    level: params.level,
    source: params.source,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    message: params.message,
    details: params.details,
  };
}

function extractShortcutStoryIdFromIssue(issue: Pick<LinearIssue, 'description'>): number | undefined {
  const description = issue.description ?? '';
  const match = description.match(/Shortcut Story ID:\s*(\d+)/i);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractLinearIssueIdFromStory(story: Pick<ShortcutStory, 'description'>): string | undefined {
  const description = story.description ?? '';
  const match = description.match(/Linear Issue ID:\s*([A-Za-z0-9\-_]+)/i);
  if (!match) return undefined;
  return match[1];
}

function extractShortcutCommentIdFromLinearComment(
  comment: Pick<LinearComment, 'body'>
): number | undefined {
  const match = comment.body.match(/Shortcut Comment ID:\s*(\d+)/i);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractLinearCommentIdFromShortcutComment(
  comment: Pick<ShortcutComment, 'text'>
): string | undefined {
  const match = comment.text.match(/Linear Comment ID:\s*([A-Za-z0-9\-_]+)/i);
  if (!match) return undefined;
  return match[1];
}

function stripSyncMetadata(text: string | undefined | null): string {
  const value = (text ?? '').trim();
  const markerIndex = value.indexOf(`---\n${SYNC_METADATA_MARKER}`);
  if (markerIndex >= 0) {
    return value.slice(0, markerIndex).trim();
  }
  return value;
}

function mapStoryTypeFromIssue(issue: LinearIssue): ShortcutStory['story_type'] {
  if (issue.priority <= 2) return 'bug';
  if (issue.priority <= 3) return 'feature';
  return 'chore';
}

function mapIssuePriorityFromStory(story: ShortcutStory): number {
  switch (story.story_type) {
    case 'bug':
      return 2;
    case 'feature':
      return 3;
    case 'chore':
    default:
      return 4;
  }
}

function toShortcutDescription(issue: LinearIssue): string {
  const description = stripSyncMetadata(issue.description);
  const metadata = [
    '---',
    SYNC_METADATA_MARKER,
    `Linear Issue ID: ${issue.id}`,
    `Linear Issue Identifier: ${issue.identifier}`,
    `Linear Issue URL: https://linear.app/issue/${issue.identifier}`,
    `Linear Updated At: ${issue.updatedAt}`,
  ];

  return description ? `${description}\n\n${metadata.join('\n')}` : metadata.join('\n');
}

function toLinearDescription(story: ShortcutStory): string {
  const description = stripSyncMetadata(story.description);
  const metadata = [
    '---',
    SYNC_METADATA_MARKER,
    `Shortcut Story ID: ${story.id}`,
    `Shortcut Story URL: https://app.shortcut.com/story/${story.id}`,
    `Shortcut Story Type: ${story.story_type}`,
    `Shortcut Updated At: ${story.updated_at}`,
  ];

  return description ? `${description}\n\n${metadata.join('\n')}` : metadata.join('\n');
}

function toLinearCommentBody(comment: ShortcutComment): string {
  const body = comment.text.trim();
  const metadata = [
    '---',
    SYNC_METADATA_MARKER,
    `Shortcut Comment ID: ${comment.id}`,
    `Shortcut Comment Author ID: ${comment.author_id}`,
    `Shortcut Comment Created At: ${comment.created_at}`,
    `Shortcut Comment Updated At: ${comment.updated_at}`,
  ];

  return body ? `${body}\n\n${metadata.join('\n')}` : metadata.join('\n');
}

function toShortcutCommentText(comment: LinearComment): string {
  const body = comment.body.trim();
  const metadata = [
    '---',
    SYNC_METADATA_MARKER,
    `Linear Comment ID: ${comment.id}`,
    `Linear Comment Author ID: ${comment.user.id}`,
    `Linear Comment Created At: ${comment.createdAt}`,
    `Linear Comment Updated At: ${comment.updatedAt}`,
  ];

  return body ? `${body}\n\n${metadata.join('\n')}` : metadata.join('\n');
}

function parseDateMs(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldTreatAsChanged(updatedAt: string, cursor?: string): boolean {
  if (!cursor) return true;
  return parseDateMs(updatedAt) > parseDateMs(cursor);
}

function resolveConflict(params: {
  conflictPolicy: StoredSyncConflictPolicy;
  source: 'shortcut' | 'linear';
  sourceUpdatedAt: string;
  destinationUpdatedAt?: string;
}): 'APPLY_SOURCE' | 'KEEP_DESTINATION' | 'MANUAL' {
  const { conflictPolicy, source, sourceUpdatedAt, destinationUpdatedAt } = params;

  switch (conflictPolicy) {
    case 'SHORTCUT_WINS':
      return source === 'shortcut' ? 'APPLY_SOURCE' : 'KEEP_DESTINATION';
    case 'LINEAR_WINS':
      return source === 'linear' ? 'APPLY_SOURCE' : 'KEEP_DESTINATION';
    case 'MANUAL':
      return 'MANUAL';
    case 'NEWEST_WINS':
    default: {
      const sourceMs = parseDateMs(sourceUpdatedAt);
      const destinationMs = parseDateMs(destinationUpdatedAt);
      return sourceMs >= destinationMs ? 'APPLY_SOURCE' : 'KEEP_DESTINATION';
    }
  }
}

function maxUpdatedAt(values: string[], fallback?: string): string | undefined {
  const all = [...values];
  if (fallback) all.push(fallback);
  if (all.length === 0) return fallback;

  return all.reduce((latest, current) =>
    parseDateMs(current) > parseDateMs(latest) ? current : latest
  );
}

function isLinearIssueEquivalentToStory(
  issue: LinearIssue,
  story: ShortcutStory,
  expectedDescription: string,
  expectedStateId?: string
): boolean {
  return (
    issue.title.trim() === story.name.trim() &&
    stripSyncMetadata(issue.description) === stripSyncMetadata(expectedDescription) &&
    issue.priority === mapIssuePriorityFromStory(story) &&
    (issue.estimate ?? undefined) === (story.estimate ?? undefined) &&
    (expectedStateId === undefined || issue.state.id === expectedStateId)
  );
}

function isShortcutStoryEquivalentToIssue(
  story: ShortcutStory,
  issue: LinearIssue,
  expectedDescription: string,
  expectedWorkflowStateId?: number
): boolean {
  return (
    story.name.trim() === issue.title.trim() &&
    stripSyncMetadata(story.description) === stripSyncMetadata(expectedDescription) &&
    story.story_type === mapStoryTypeFromIssue(issue) &&
    (story.estimate ?? undefined) === (issue.estimate ?? undefined) &&
    (expectedWorkflowStateId === undefined ||
      story.workflow_state_id === expectedWorkflowStateId)
  );
}

async function syncShortcutCommentsToLinearIssue(params: {
  shortcutClient: ShortcutClient;
  linearClient: LinearClient;
  story: ShortcutStory;
  issueId: string;
}): Promise<number> {
  const sourceComments = await params.shortcutClient.getStoryComments(params.story.id);
  const linearComments = await params.linearClient.getIssueComments(params.issueId, {
    includeAllPages: true,
  });

  const existingShortcutCommentIds = new Set<number>();
  for (const comment of linearComments) {
    const shortcutCommentId = extractShortcutCommentIdFromLinearComment(comment);
    if (shortcutCommentId !== undefined) {
      existingShortcutCommentIds.add(shortcutCommentId);
    }
  }

  let created = 0;
  for (const comment of sourceComments) {
    if (extractLinearCommentIdFromShortcutComment(comment)) {
      continue;
    }

    if (existingShortcutCommentIds.has(comment.id)) {
      continue;
    }

    await params.linearClient.createComment(params.issueId, toLinearCommentBody(comment));
    created += 1;
  }

  return created;
}

async function syncLinearCommentsToShortcutStory(params: {
  shortcutClient: ShortcutClient;
  linearClient: LinearClient;
  issue: LinearIssue;
  storyId: number;
}): Promise<number> {
  const sourceComments = await params.linearClient.getIssueComments(params.issue.id, {
    includeAllPages: true,
  });
  const shortcutComments = await params.shortcutClient.getStoryComments(params.storyId);

  const existingLinearCommentIds = new Set<string>();
  for (const comment of shortcutComments) {
    const linearCommentId = extractLinearCommentIdFromShortcutComment(comment);
    if (linearCommentId) {
      existingLinearCommentIds.add(linearCommentId);
    }
  }

  let created = 0;
  for (const comment of sourceComments) {
    if (extractShortcutCommentIdFromLinearComment(comment) !== undefined) {
      continue;
    }

    if (existingLinearCommentIds.has(comment.id)) {
      continue;
    }

    await params.shortcutClient.createStoryComment(params.storyId, {
      text: toShortcutCommentText(comment),
      created_at: comment.createdAt,
      updated_at: comment.updatedAt,
    });
    created += 1;
  }

  return created;
}

function defaultDelta(): SyncDeltaStats {
  return {
    storiesScanned: 0,
    issuesScanned: 0,
    createdInLinear: 0,
    updatedInLinear: 0,
    createdInShortcut: 0,
    updatedInShortcut: 0,
    conflicts: 0,
    errors: 0,
  };
}

export async function runSyncCycle(input: RunSyncCycleInput): Promise<SyncCycleResult> {
  const startedAt = Date.now();

  if (!input.config.linearTeamId) {
    throw new Error('Sync requires a target Linear team');
  }

  const shortcutClient = new ShortcutClient(input.shortcutToken);
  const linearClient = new LinearClient(input.linearToken);

  const sourceLabel = input.triggerSource ?? 'system';
  const reasonLabel = input.triggerReason ?? 'scheduled cycle';
  const events: SyncEventRecord[] = [
    createEvent({
      level: 'INFO',
      source: sourceLabel,
      action: 'cycle',
      entityType: 'sync',
      entityId: 'cycle',
      message: `Starting sync cycle (${reasonLabel})`,
    }),
  ];

  const previousCursors = input.cursors ?? {};
  const delta = defaultDelta();

  const storiesPromise = input.config.shortcutTeamId
    ? shortcutClient.getStoriesForTeam(input.config.shortcutTeamId)
    : shortcutClient.getAllStories();

  const issuesPromise = linearClient.getIssues(input.config.linearTeamId, {
    includeAllPages: true,
  });

  const shortcutWorkflowsPromise = shortcutClient.getWorkflows();
  const linearWorkflowStatesPromise =
    input.config.direction === 'LINEAR_TO_SHORTCUT'
      ? Promise.resolve([])
      : linearClient.getWorkflowStates(input.config.linearTeamId);

  const [stories, issues, shortcutWorkflows, linearWorkflowStates] = await Promise.all([
    storiesPromise,
    issuesPromise,
    shortcutWorkflowsPromise,
    linearWorkflowStatesPromise,
  ]);

  const shortcutStateTypeById = buildShortcutStateTypeById(shortcutWorkflows);
  const shortcutStateIdByType = buildShortcutStateIdByType(shortcutWorkflows);
  const linearStateIdByShortcutType =
    input.config.direction === 'LINEAR_TO_SHORTCUT'
      ? undefined
      : buildLinearStateIdByShortcutType(linearWorkflowStates);
  const fallbackShortcutWorkflowStateId =
    shortcutStateIdByType.unstarted ??
    shortcutStateIdByType.started ??
    shortcutStateIdByType.done;

  delta.storiesScanned = stories.length;
  delta.issuesScanned = issues.length;

  const storyById = new Map<number, ShortcutStory>();
  stories.forEach((story) => storyById.set(story.id, story));

  const issueById = new Map<string, LinearIssue>();
  issues.forEach((issue) => issueById.set(issue.id, issue));

  const issueIdByStoryId = new Map<number, string>();
  for (const issue of issues) {
    const storyId = extractShortcutStoryIdFromIssue(issue);
    if (storyId !== undefined) {
      issueIdByStoryId.set(storyId, issue.id);
    }
  }

  const storyIdByIssueId = new Map<string, number>();
  for (const story of stories) {
    const issueId = extractLinearIssueIdFromStory(story);
    if (issueId) {
      storyIdByIssueId.set(issueId, story.id);
    }
  }

  const changedStories = stories
    .filter((story) => shouldTreatAsChanged(story.updated_at, previousCursors.shortcutUpdatedAt))
    .sort((a, b) => parseDateMs(a.updated_at) - parseDateMs(b.updated_at));

  const changedIssues = issues
    .filter((issue) => shouldTreatAsChanged(issue.updatedAt, previousCursors.linearUpdatedAt))
    .sort((a, b) => parseDateMs(a.updatedAt) - parseDateMs(b.updatedAt));

  if (input.config.direction === 'SHORTCUT_TO_LINEAR' || input.config.direction === 'BIDIRECTIONAL') {
    for (const story of changedStories) {
      const existingIssueId = issueIdByStoryId.get(story.id);
      const existingIssue = existingIssueId ? issueById.get(existingIssueId) : undefined;

      const linearAlsoChanged =
        existingIssue !== undefined &&
        shouldTreatAsChanged(existingIssue.updatedAt, previousCursors.linearUpdatedAt);

      if (linearAlsoChanged) {
        const decision = resolveConflict({
          conflictPolicy: input.config.conflictPolicy,
          source: 'shortcut',
          sourceUpdatedAt: story.updated_at,
          destinationUpdatedAt: existingIssue?.updatedAt,
        });

        if (decision === 'MANUAL') {
          delta.conflicts += 1;
          events.push(
            createEvent({
              level: 'WARN',
              source: 'shortcut',
              action: 'conflict',
              entityType: 'story',
              entityId: String(story.id),
              message: `Conflict detected for Shortcut story ${story.id}; manual resolution required`,
            })
          );
          continue;
        }

        if (decision === 'KEEP_DESTINATION') {
          events.push(
            createEvent({
              level: 'INFO',
              source: 'shortcut',
              action: 'noop',
              entityType: 'story',
              entityId: String(story.id),
              message: `Conflict resolved by keeping Linear issue ${existingIssue?.identifier ?? existingIssue?.id}`,
            })
          );
          continue;
        }
      }

      const nextDescription = toLinearDescription(story);
      const nextStateId = linearStateIdByShortcutType
        ? mapStoryToLinearStateId(
            story,
            shortcutStateTypeById,
            linearStateIdByShortcutType
          )
        : undefined;

      try {
        let targetIssue: LinearIssue | undefined;

        if (existingIssue) {
          if (
            isLinearIssueEquivalentToStory(
              existingIssue,
              story,
              nextDescription,
              nextStateId
            )
          ) {
            events.push(
              createEvent({
                level: 'INFO',
                source: 'shortcut',
                action: 'noop',
                entityType: 'issue',
                entityId: existingIssue.id,
                message: `No changes needed for Linear issue ${existingIssue.identifier}`,
              })
            );
            targetIssue = existingIssue;
          } else {
            const updated = await linearClient.updateIssue(existingIssue.id, {
              title: story.name,
              description: nextDescription,
              stateId: nextStateId,
              priority: mapIssuePriorityFromStory(story),
              estimate: story.estimate,
            });
            issueById.set(updated.id, updated);
            delta.updatedInLinear += 1;
            events.push(
              createEvent({
                level: 'INFO',
                source: 'shortcut',
                action: 'update',
                entityType: 'issue',
                entityId: updated.id,
                message: `Updated Linear issue ${updated.identifier} from Shortcut story ${story.id}`,
              })
            );
            targetIssue = updated;
          }
        } else {
          const created = await linearClient.createIssue({
            teamId: input.config.linearTeamId,
            title: story.name,
            description: nextDescription,
            stateId: nextStateId,
            priority: mapIssuePriorityFromStory(story),
            estimate: story.estimate,
          });
          issueById.set(created.id, created);
          issueIdByStoryId.set(story.id, created.id);
          delta.createdInLinear += 1;
          events.push(
            createEvent({
              level: 'INFO',
              source: 'shortcut',
              action: 'create',
              entityType: 'issue',
              entityId: created.id,
              message: `Created Linear issue ${created.identifier} from Shortcut story ${story.id}`,
            })
          );
          targetIssue = created;
        }

        if (input.config.includeComments && targetIssue) {
          const createdComments = await syncShortcutCommentsToLinearIssue({
            shortcutClient,
            linearClient,
            story,
            issueId: targetIssue.id,
          });

          if (createdComments > 0) {
            events.push(
              createEvent({
                level: 'INFO',
                source: 'shortcut',
                action: 'create',
                entityType: 'issue',
                entityId: targetIssue.id,
                message: `Created ${createdComments} comment(s) on Linear issue ${targetIssue.identifier} from Shortcut story ${story.id}`,
              })
            );
          }
        }
      } catch (error) {
        delta.errors += 1;
        events.push(
          createEvent({
            level: 'ERROR',
            source: 'shortcut',
            action: 'error',
            entityType: 'story',
            entityId: String(story.id),
            message: `Failed syncing Shortcut story ${story.id} to Linear`,
            details: error instanceof Error ? error.message : 'Unknown error',
          })
        );
      }
    }
  }

  if (input.config.direction === 'LINEAR_TO_SHORTCUT' || input.config.direction === 'BIDIRECTIONAL') {
    for (const issue of changedIssues) {
      const existingStoryId = storyIdByIssueId.get(issue.id);
      const existingStory =
        existingStoryId !== undefined ? storyById.get(existingStoryId) : undefined;

      const shortcutAlsoChanged =
        existingStory !== undefined &&
        shouldTreatAsChanged(existingStory.updated_at, previousCursors.shortcutUpdatedAt);

      if (shortcutAlsoChanged) {
        const decision = resolveConflict({
          conflictPolicy: input.config.conflictPolicy,
          source: 'linear',
          sourceUpdatedAt: issue.updatedAt,
          destinationUpdatedAt: existingStory?.updated_at,
        });

        if (decision === 'MANUAL') {
          delta.conflicts += 1;
          events.push(
            createEvent({
              level: 'WARN',
              source: 'linear',
              action: 'conflict',
              entityType: 'issue',
              entityId: issue.id,
              message: `Conflict detected for Linear issue ${issue.identifier}; manual resolution required`,
            })
          );
          continue;
        }

        if (decision === 'KEEP_DESTINATION') {
          events.push(
            createEvent({
              level: 'INFO',
              source: 'linear',
              action: 'noop',
              entityType: 'issue',
              entityId: issue.id,
              message: `Conflict resolved by keeping Shortcut story ${existingStory?.id}`,
            })
          );
          continue;
        }
      }

      const nextDescription = toShortcutDescription(issue);
      const nextWorkflowStateId =
        mapIssueToShortcutStateId(issue, shortcutStateIdByType) ??
        fallbackShortcutWorkflowStateId;

      try {
        let targetStory: ShortcutStory | undefined;

        if (existingStory) {
          if (
            isShortcutStoryEquivalentToIssue(
              existingStory,
              issue,
              nextDescription,
              nextWorkflowStateId
            )
          ) {
            events.push(
              createEvent({
                level: 'INFO',
                source: 'linear',
                action: 'noop',
                entityType: 'story',
                entityId: String(existingStory.id),
                message: `No changes needed for Shortcut story ${existingStory.id}`,
              })
            );
            targetStory = existingStory;
          } else {
            const updated = await shortcutClient.updateStory(existingStory.id, {
              name: issue.title,
              description: nextDescription,
              story_type: mapStoryTypeFromIssue(issue),
              workflow_state_id: nextWorkflowStateId,
              estimate: issue.estimate,
            });
            storyById.set(updated.id, updated);
            delta.updatedInShortcut += 1;
            events.push(
              createEvent({
                level: 'INFO',
                source: 'linear',
                action: 'update',
                entityType: 'story',
                entityId: String(updated.id),
                message: `Updated Shortcut story ${updated.id} from Linear issue ${issue.identifier}`,
              })
            );
            targetStory = updated;
          }
        } else {
          if (!nextWorkflowStateId) {
            throw new Error('No Shortcut workflow state available for creating stories');
          }

          const created = await shortcutClient.createStory({
            name: issue.title,
            description: nextDescription,
            story_type: mapStoryTypeFromIssue(issue),
            workflow_state_id: nextWorkflowStateId,
            estimate: issue.estimate,
          });
          storyById.set(created.id, created);
          storyIdByIssueId.set(issue.id, created.id);
          delta.createdInShortcut += 1;
          events.push(
            createEvent({
              level: 'INFO',
              source: 'linear',
              action: 'create',
              entityType: 'story',
              entityId: String(created.id),
              message: `Created Shortcut story ${created.id} from Linear issue ${issue.identifier}`,
            })
          );
          targetStory = created;
        }

        if (input.config.includeComments && targetStory) {
          const createdComments = await syncLinearCommentsToShortcutStory({
            shortcutClient,
            linearClient,
            issue,
            storyId: targetStory.id,
          });

          if (createdComments > 0) {
            events.push(
              createEvent({
                level: 'INFO',
                source: 'linear',
                action: 'create',
                entityType: 'story',
                entityId: String(targetStory.id),
                message: `Created ${createdComments} comment(s) on Shortcut story ${targetStory.id} from Linear issue ${issue.identifier}`,
              })
            );
          }
        }
      } catch (error) {
        delta.errors += 1;
        events.push(
          createEvent({
            level: 'ERROR',
            source: 'linear',
            action: 'error',
            entityType: 'issue',
            entityId: issue.id,
            message: `Failed syncing Linear issue ${issue.identifier} to Shortcut`,
            details: error instanceof Error ? error.message : 'Unknown error',
          })
        );
      }
    }
  }

  const nextCursors: SyncCursorState = {
    shortcutUpdatedAt: maxUpdatedAt(
      stories.map((story) => story.updated_at),
      previousCursors.shortcutUpdatedAt
    ),
    linearUpdatedAt: maxUpdatedAt(
      issues.map((issue) => issue.updatedAt),
      previousCursors.linearUpdatedAt
    ),
  };

  const durationMs = Date.now() - startedAt;

  events.unshift(
    createEvent({
      level: 'INFO',
      source: 'system',
      action: 'cycle',
      entityType: 'sync',
      entityId: 'cycle',
      message: `Completed sync cycle in ${durationMs}ms`,
    })
  );

  return {
    cursors: nextCursors,
    delta,
    events,
    durationMs,
  };
}

function mergeSyncStats(current: SyncStats, result: SyncCycleResult): SyncStats {
  return {
    cyclesRun: current.cyclesRun + 1,
    storiesScanned: current.storiesScanned + result.delta.storiesScanned,
    issuesScanned: current.issuesScanned + result.delta.issuesScanned,
    createdInLinear: current.createdInLinear + result.delta.createdInLinear,
    updatedInLinear: current.updatedInLinear + result.delta.updatedInLinear,
    createdInShortcut: current.createdInShortcut + result.delta.createdInShortcut,
    updatedInShortcut: current.updatedInShortcut + result.delta.updatedInShortcut,
    conflicts: current.conflicts + result.delta.conflicts,
    errors: current.errors + result.delta.errors,
    lastRunAt: nowIso(),
    lastRunDurationMs: result.durationMs,
    lastError: undefined,
  };
}

function scheduleSyncLoop(): void {
  const settings = getSyncSettings();
  const intervalMs = Math.min(Math.max(settings.pollIntervalSeconds, 5), 3600) * 1000;

  if (syncIntervalHandle) {
    clearInterval(syncIntervalHandle);
  }

  syncIntervalHandle = setInterval(() => {
    void runSyncCycleFromState('system', 'scheduled interval');
  }, intervalMs);
}

export function isSyncRunning(): boolean {
  return syncIntervalHandle !== null;
}

export async function runSyncCycleFromState(
  triggerSource: 'shortcut' | 'linear' | 'system' = 'system',
  triggerReason: string = 'manual run'
): Promise<SyncCycleResult> {
  if (syncCycleInFlight) {
    const skipped: SyncCycleResult = {
      cursors: getSyncCursors(),
      delta: defaultDelta(),
      events: [
        createEvent({
          level: 'INFO',
          source: 'system',
          action: 'noop',
          entityType: 'sync',
          entityId: 'cycle',
          message: 'Skipped sync cycle because another cycle is still running',
        }),
      ],
      durationMs: 0,
    };
    appendSyncEvents(skipped.events);
    return skipped;
  }

  const state = getState();
  const settings = getSyncSettings(state);

  if (!state.shortcutToken || !state.linearToken) {
    const error = new Error('Missing tokens. Configure Shortcut and Linear tokens first.');
    appendSyncEvents(
      createEvent({
        level: 'ERROR',
        source: 'system',
        action: 'error',
        entityType: 'sync',
        entityId: 'cycle',
        message: error.message,
      })
    );
    setSyncStatus('ERROR');
    throw error;
  }

  if (!settings.linearTeamId) {
    const error = new Error('Sync requires a target Linear team.');
    appendSyncEvents(
      createEvent({
        level: 'ERROR',
        source: 'system',
        action: 'error',
        entityType: 'sync',
        entityId: 'config',
        message: error.message,
      })
    );
    setSyncStatus('ERROR');
    throw error;
  }

  syncCycleInFlight = true;

  try {
    const result = await runSyncCycle({
      shortcutToken: state.shortcutToken,
      linearToken: state.linearToken,
      config: {
        direction: settings.direction,
        conflictPolicy: settings.conflictPolicy,
        shortcutTeamId: settings.shortcutTeamId,
        linearTeamId: settings.linearTeamId,
        includeComments: settings.includeComments,
        includeAttachments: settings.includeAttachments,
      },
      cursors: getSyncCursors(state),
      triggerSource,
      triggerReason,
    });

    setSyncCursors(result.cursors);
    setSyncStats(mergeSyncStats(getSyncStats(), result));
    appendSyncEvents(result.events);
    setSyncStatus('RUNNING');

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    appendSyncEvents(
      createEvent({
        level: 'ERROR',
        source: triggerSource,
        action: 'error',
        entityType: 'sync',
        entityId: 'cycle',
        message,
      })
    );
    const stats = getSyncStats();
    setSyncStats({
      ...stats,
      errors: stats.errors + 1,
      lastError: message,
      lastRunAt: nowIso(),
    });
    setSyncStatus('ERROR');
    throw error;
  } finally {
    syncCycleInFlight = false;
  }
}

export async function startRealtimeSync(): Promise<void> {
  const settings = getSyncSettings();
  setSyncSettings({ ...settings, enabled: true });
  setSyncStatus('RUNNING');
  appendSyncEvents(
    createEvent({
      level: 'INFO',
      source: 'system',
      action: 'start',
      entityType: 'sync',
      entityId: 'engine',
      message: 'Started real-time sync engine',
    })
  );

  await runSyncCycleFromState('system', 'initial start');
  scheduleSyncLoop();
}

export function pauseRealtimeSync(): void {
  if (syncIntervalHandle) {
    clearInterval(syncIntervalHandle);
    syncIntervalHandle = null;
  }

  const settings = getSyncSettings();
  setSyncSettings({ ...settings, enabled: false });
  setSyncStatus('PAUSED');
  appendSyncEvents(
    createEvent({
      level: 'INFO',
      source: 'system',
      action: 'pause',
      entityType: 'sync',
      entityId: 'engine',
      message: 'Paused real-time sync engine',
    })
  );
}

export async function resumeRealtimeSync(): Promise<void> {
  if (isSyncRunning()) return;

  const settings = getSyncSettings();
  setSyncSettings({ ...settings, enabled: true });
  setSyncStatus('RUNNING');
  appendSyncEvents(
    createEvent({
      level: 'INFO',
      source: 'system',
      action: 'resume',
      entityType: 'sync',
      entityId: 'engine',
      message: 'Resumed real-time sync engine',
    })
  );

  await runSyncCycleFromState('system', 'resume');
  scheduleSyncLoop();
}

export function stopRealtimeSync(): void {
  if (syncIntervalHandle) {
    clearInterval(syncIntervalHandle);
    syncIntervalHandle = null;
  }

  const settings = getSyncSettings();
  setSyncSettings({ ...settings, enabled: false });
  setSyncStatus('IDLE');
  appendSyncEvents(
    createEvent({
      level: 'INFO',
      source: 'system',
      action: 'pause',
      entityType: 'sync',
      entityId: 'engine',
      message: 'Stopped real-time sync engine',
    })
  );
}

export function bootstrapSyncEngine(): void {
  if (typeof window === 'undefined') return;

  const settings = getSyncSettings();
  const status = getState().syncStatus;

  if (settings.enabled && status !== 'PAUSED') {
    scheduleSyncLoop();
  }
}
