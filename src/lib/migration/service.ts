import { getState } from '../db';
import { LinearClient } from '../linear/client';
import { ShortcutClient } from '../shortcut/client';
import { LinearTeam, ShortcutComment, ShortcutStory, ShortcutTeam } from '@/types';

export type MigrationPhase =
  | 'preflight'
  | 'fetching'
  | 'labels'
  | 'projects'
  | 'cycles'
  | 'issues'
  | 'comments'
  | 'attachments'
  | 'done'
  | 'error';

export interface MigrationProgress {
  phase: MigrationPhase;
  current: number;
  total: number;
  message: string;
}

export interface EntityStats {
  attempted: number;
  created: number;
  reused: number;
  failed: number;
}

export interface MigrationResult {
  success: boolean;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stats: {
    labels: EntityStats;
    projects: EntityStats;
    cycles: EntityStats;
    issues: EntityStats;
    comments: EntityStats;
    attachments: EntityStats;
  };
  errors: string[];
  warnings: string[];
}

export interface RunMigrationOptions {
  shortcutTeamId?: string;
  linearTeamId: string;
  mode: 'ONE_SHOT' | 'TEAM_BY_TEAM';
  includeComments: boolean;
  includeAttachments: boolean;
  dryRun: boolean;
}

export interface TokenValidationResult {
  shortcut: boolean;
  linear: boolean;
  shortcutUserName?: string;
  linearUserName?: string;
  linearWorkspace?: string;
  linearTeams: LinearTeam[];
  errors: string[];
}

export interface MigrationPreview {
  stories: number;
  epics: number;
  iterations: number;
  labels: number;
  shortcutTeams: ShortcutTeam[];
  teams: LinearTeam[];
}

export type ProgressCallback = (progress: MigrationProgress) => void;

interface StoryIssueMapping {
  issueId: string;
  story: ShortcutStory;
}

function createEntityStats(): EntityStats {
  return {
    attempted: 0,
    created: 0,
    reused: 0,
    failed: 0,
  };
}

function createInitialResult(startedAt: Date, dryRun: boolean): MigrationResult {
  return {
    success: false,
    dryRun,
    startedAt: startedAt.toISOString(),
    completedAt: startedAt.toISOString(),
    durationMs: 0,
    stats: {
      labels: createEntityStats(),
      projects: createEntityStats(),
      cycles: createEntityStats(),
      issues: createEntityStats(),
      comments: createEntityStats(),
      attachments: createEntityStats(),
    },
    errors: [],
    warnings: [],
  };
}

function normalizeName(name: string | undefined | null): string {
  return (name ?? '').trim().toLowerCase();
}

function normalizeCycleKey(name: string | undefined, start: string, end: string): string {
  const normalizedStart = start.slice(0, 10);
  const normalizedEnd = end.slice(0, 10);
  return `${normalizeName(name)}|${normalizedStart}|${normalizedEnd}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function extractMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((entry) => extractMessage(entry))
      .filter((entry): entry is string => Boolean(entry));
    return messages.length > 0 ? messages.join(' | ') : null;
  }

  if (!isRecord(value)) return null;

  const preferredKeys = ['message', 'error', 'detail', 'title', 'reason'];
  for (const key of preferredKeys) {
    const message = extractMessage(value[key]);
    if (message) return message;
  }

  if ('errors' in value) {
    const errorsMessage = extractMessage(value.errors);
    if (errorsMessage) return errorsMessage;
  }

  return null;
}

function formatError(error: unknown): string {
  const direct = extractMessage(error);
  if (direct) return direct;

  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : null;
    if (response) {
      const status =
        typeof response.status === 'number' ? response.status : undefined;
      const statusText =
        typeof response.statusText === 'string' ? response.statusText : '';
      const responseMessage = extractMessage(response.data);
      if (responseMessage) return responseMessage;

      if (status) {
        return statusText ? `HTTP ${status} ${statusText}` : `HTTP ${status}`;
      }
    }
  }

  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function withNetworkHint(message: string): string {
  const normalized = message.trim().toLowerCase();
  if (
    normalized === 'network error' ||
    normalized === 'failed to fetch' ||
    normalized.includes('network error') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('fetch failed')
  ) {
    return `${message}. This is usually a connectivity or browser policy issue.`;
  }
  return message;
}

function extractShortcutStoryId(issue: { description?: string }): number | undefined {
  const description = issue.description ?? '';
  const match = description.match(/Shortcut Story ID:\s*(\d+)/i);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapPriority(storyType: ShortcutStory['story_type']): number {
  switch (storyType) {
    case 'bug':
      return 2;
    case 'feature':
      return 3;
    case 'chore':
    default:
      return 4;
  }
}

function buildIssueDescription(story: ShortcutStory): string {
  const description = (story.description ?? '').trim();
  const metadata = [
    '---',
    'Migrated from Shortcut',
    `Shortcut Story ID: ${story.id}`,
    `Shortcut Story Type: ${story.story_type}`,
    `Shortcut Story URL: https://app.shortcut.com/story/${story.id}`,
    `Shortcut Created At: ${story.created_at}`,
    `Shortcut Updated At: ${story.updated_at}`,
  ];

  return description ? `${description}\n\n${metadata.join('\n')}` : metadata.join('\n');
}

function buildCommentBody(comment: ShortcutComment): string {
  const metadata = [
    'Migrated from Shortcut Comment',
    `Shortcut Comment ID: ${comment.id}`,
    `Author ID: ${comment.author_id}`,
    `Created At: ${comment.created_at}`,
  ];
  return `${comment.text}\n\n---\n${metadata.join('\n')}`;
}

function extractExternalLinks(story: ShortcutStory): Array<{ title: string; url: string }> {
  if (!Array.isArray(story.external_links)) return [];

  const links: Array<{ title: string; url: string }> = [];

  story.external_links.forEach((entry, index) => {
    if (typeof entry === 'string' && entry.startsWith('http')) {
      links.push({
        title: `Shortcut Link ${index + 1}`,
        url: entry,
      });
      return;
    }

    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const urlValue =
        (typeof record.url === 'string' && record.url) ||
        (typeof record.external_url === 'string' && record.external_url) ||
        (typeof record.link === 'string' && record.link) ||
        '';
      if (!urlValue || !urlValue.startsWith('http')) return;
      links.push({
        title:
          (typeof record.title === 'string' && record.title) ||
          `Shortcut Link ${index + 1}`,
        url: urlValue,
      });
    }
  });

  return links;
}

function finalizeResult(result: MigrationResult, startedAt: Date): MigrationResult {
  const completedAt = new Date();
  result.completedAt = completedAt.toISOString();
  result.durationMs = completedAt.getTime() - startedAt.getTime();
  result.success = result.errors.length === 0;
  return result;
}

function markPlannedOrCreated(stats: EntityStats, dryRun: boolean): void {
  // For dry runs we intentionally show "created" as "would create" to keep a single stat model.
  stats.created += 1;
  if (dryRun) return;
}

export async function runMigration(
  options: RunMigrationOptions,
  onProgress: ProgressCallback
): Promise<MigrationResult> {
  const state = getState();
  const startedAt = new Date();
  const result = createInitialResult(startedAt, options.dryRun);

  if (!state.shortcutToken || !state.linearToken) {
    throw new Error('Missing API tokens');
  }

  if (!options.linearTeamId) {
    throw new Error('Missing target Linear team');
  }

  if (options.mode === 'TEAM_BY_TEAM' && options.shortcutTeamId == null) {
    throw new Error('Missing source Shortcut team for Team-by-Team mode');
  }

  const shortcut = new ShortcutClient(state.shortcutToken);
  const linear = new LinearClient(state.linearToken);

  try {
    onProgress({
      phase: 'preflight',
      current: 0,
      total: 1,
      message: 'Validating target team and loading existing Linear data...',
    });

    await linear.getTeam(options.linearTeamId);

    const [existingLabels, existingProjects, existingCycles, existingIssues] =
      await Promise.all([
        linear.getLabels(options.linearTeamId, { includeAllPages: true }),
        linear.getProjects(options.linearTeamId, { includeAllPages: true }),
        linear.getCycles(options.linearTeamId, { includeAllPages: true }),
        linear.getIssues(options.linearTeamId, { includeAllPages: true }),
      ]);

    if (options.dryRun) {
      result.warnings.push('Dry run enabled: no data will be written to Linear.');
    }

    if (options.mode === 'TEAM_BY_TEAM') {
      result.warnings.push(
        `Team-by-Team mode enabled: migrating only Shortcut team ${options.shortcutTeamId} into the selected Linear team.`
      );
    }

    if (!options.includeComments) {
      result.warnings.push('Comment migration is disabled.');
    }

    if (!options.includeAttachments) {
      result.warnings.push('Attachment migration is disabled.');
    }

    onProgress({
      phase: 'fetching',
      current: 0,
      total: 1,
      message: 'Fetching Shortcut data...',
    });

    const storiesPromise =
      options.mode === 'TEAM_BY_TEAM' && options.shortcutTeamId != null
        ? shortcut.getStoriesForTeam(options.shortcutTeamId)
        : shortcut.getAllStories();

    const [labels, epics, iterations, stories] = await Promise.all([
      shortcut.getLabels(),
      shortcut.getEpics(),
      shortcut.getIterations(),
      storiesPromise,
    ]);

    const labelMap = new Map<number, string>();
    const existingLabelByName = new Map<string, string>();
    existingLabels.forEach((label) => {
      existingLabelByName.set(normalizeName(label.name), label.id);
    });

    onProgress({
      phase: 'labels',
      current: 0,
      total: labels.length,
      message: 'Migrating labels...',
    });

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      result.stats.labels.attempted += 1;
      const normalizedName = normalizeName(label.name);
      const existingId = existingLabelByName.get(normalizedName);

      if (existingId) {
        labelMap.set(label.id, existingId);
        result.stats.labels.reused += 1;
      } else {
        try {
          if (options.dryRun) {
            const plannedId = `dry-label-${label.id}`;
            labelMap.set(label.id, plannedId);
            markPlannedOrCreated(result.stats.labels, options.dryRun);
          } else {
            const created = await linear.createLabel(
              label.name,
              label.color || '#6B7280',
              options.linearTeamId
            );
            labelMap.set(label.id, created.id);
            existingLabelByName.set(normalizedName, created.id);
            markPlannedOrCreated(result.stats.labels, options.dryRun);
          }
        } catch (error) {
          result.stats.labels.failed += 1;
          result.errors.push(
            `[labels] Failed to migrate "${label.name}": ${formatError(error)}`
          );
        }
      }

      onProgress({
        phase: 'labels',
        current: i + 1,
        total: labels.length,
        message: `Processed label ${i + 1}/${labels.length}`,
      });
    }

    const projectMap = new Map<number, string>();
    const existingProjectByName = new Map<string, string>();
    existingProjects.forEach((project) => {
      existingProjectByName.set(normalizeName(project.name), project.id);
    });

    onProgress({
      phase: 'projects',
      current: 0,
      total: epics.length,
      message: 'Migrating projects...',
    });

    for (let i = 0; i < epics.length; i++) {
      const epic = epics[i];
      result.stats.projects.attempted += 1;
      const normalizedName = normalizeName(epic.name);
      const existingId = existingProjectByName.get(normalizedName);

      if (existingId) {
        projectMap.set(epic.id, existingId);
        result.stats.projects.reused += 1;
      } else {
        try {
          if (options.dryRun) {
            const plannedId = `dry-project-${epic.id}`;
            projectMap.set(epic.id, plannedId);
            markPlannedOrCreated(result.stats.projects, options.dryRun);
          } else {
            const created = await linear.createProject(
              epic.name,
              [options.linearTeamId],
              epic.description
            );
            projectMap.set(epic.id, created.id);
            existingProjectByName.set(normalizedName, created.id);
            markPlannedOrCreated(result.stats.projects, options.dryRun);
          }
        } catch (error) {
          result.stats.projects.failed += 1;
          result.errors.push(
            `[projects] Failed to migrate "${epic.name}": ${formatError(error)}`
          );
        }
      }

      onProgress({
        phase: 'projects',
        current: i + 1,
        total: epics.length,
        message: `Processed project ${i + 1}/${epics.length}`,
      });
    }

    const cycleMap = new Map<number, string>();
    const existingCycleByKey = new Map<string, string>();
    existingCycles.forEach((cycle) => {
      existingCycleByKey.set(
        normalizeCycleKey(cycle.name, cycle.startsAt, cycle.endsAt),
        cycle.id
      );
    });

    onProgress({
      phase: 'cycles',
      current: 0,
      total: iterations.length,
      message: 'Migrating cycles...',
    });

    for (let i = 0; i < iterations.length; i++) {
      const iteration = iterations[i];
      result.stats.cycles.attempted += 1;
      const cycleKey = normalizeCycleKey(
        iteration.name,
        iteration.start_date,
        iteration.end_date
      );
      const existingId = existingCycleByKey.get(cycleKey);

      if (existingId) {
        cycleMap.set(iteration.id, existingId);
        result.stats.cycles.reused += 1;
      } else {
        try {
          if (options.dryRun) {
            const plannedId = `dry-cycle-${iteration.id}`;
            cycleMap.set(iteration.id, plannedId);
            markPlannedOrCreated(result.stats.cycles, options.dryRun);
          } else {
            const created = await linear.createCycle(
              options.linearTeamId,
              new Date(iteration.start_date),
              new Date(iteration.end_date),
              iteration.name
            );
            cycleMap.set(iteration.id, created.id);
            existingCycleByKey.set(cycleKey, created.id);
            markPlannedOrCreated(result.stats.cycles, options.dryRun);
          }
        } catch (error) {
          result.stats.cycles.failed += 1;
          result.errors.push(
            `[cycles] Failed to migrate "${iteration.name}": ${formatError(error)}`
          );
        }
      }

      onProgress({
        phase: 'cycles',
        current: i + 1,
        total: iterations.length,
        message: `Processed cycle ${i + 1}/${iterations.length}`,
      });
    }

    const existingIssueByStoryId = new Map<number, string>();
    existingIssues.forEach((issue) => {
      const storyId = extractShortcutStoryId(issue);
      if (!storyId) return;
      existingIssueByStoryId.set(storyId, issue.id);
    });

    const migratedStories: StoryIssueMapping[] = [];

    onProgress({
      phase: 'issues',
      current: 0,
      total: stories.length,
      message: 'Migrating issues...',
    });

    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      result.stats.issues.attempted += 1;

      const existingIssueId = existingIssueByStoryId.get(story.id);
      if (existingIssueId) {
        result.stats.issues.reused += 1;
        migratedStories.push({ story, issueId: existingIssueId });
      } else {
        try {
          if (options.dryRun) {
            const plannedId = `dry-issue-${story.id}`;
            existingIssueByStoryId.set(story.id, plannedId);
            migratedStories.push({ story, issueId: plannedId });
            markPlannedOrCreated(result.stats.issues, options.dryRun);
          } else {
            const created = await linear.createIssue({
              teamId: options.linearTeamId,
              title: story.name,
              description: buildIssueDescription(story),
              projectId: story.epic_id ? projectMap.get(story.epic_id) : undefined,
              cycleId: story.iteration_id ? cycleMap.get(story.iteration_id) : undefined,
              labelIds: story.labels
                ?.map((label) => labelMap.get(label.id))
                .filter((id): id is string => Boolean(id)),
              priority: mapPriority(story.story_type),
              estimate: story.estimate,
            });
            existingIssueByStoryId.set(story.id, created.id);
            migratedStories.push({ story, issueId: created.id });
            markPlannedOrCreated(result.stats.issues, options.dryRun);
          }
        } catch (error) {
          result.stats.issues.failed += 1;
          result.errors.push(
            `[issues] Failed to migrate story "${story.name}" (#${story.id}): ${formatError(
              error
            )}`
          );
        }
      }

      onProgress({
        phase: 'issues',
        current: i + 1,
        total: stories.length,
        message: `Processed issue ${i + 1}/${stories.length}`,
      });
    }

    if (options.includeComments) {
      onProgress({
        phase: 'comments',
        current: 0,
        total: migratedStories.length,
        message: 'Migrating comments...',
      });

      for (let i = 0; i < migratedStories.length; i++) {
        const { story, issueId } = migratedStories[i];
        try {
          const comments = await shortcut.getStoryComments(story.id);

          for (const comment of comments) {
            result.stats.comments.attempted += 1;
            try {
              if (options.dryRun) {
                markPlannedOrCreated(result.stats.comments, options.dryRun);
              } else {
                await linear.createComment(issueId, buildCommentBody(comment));
                markPlannedOrCreated(result.stats.comments, options.dryRun);
              }
            } catch (error) {
              result.stats.comments.failed += 1;
              result.errors.push(
                `[comments] Failed to migrate comment ${comment.id} for story #${story.id}: ${formatError(
                  error
                )}`
              );
            }
          }
        } catch (error) {
          result.stats.comments.failed += 1;
          result.errors.push(
            `[comments] Failed to fetch comments for story #${story.id}: ${formatError(error)}`
          );
        }

        onProgress({
          phase: 'comments',
          current: i + 1,
          total: migratedStories.length,
          message: `Processed comments ${i + 1}/${migratedStories.length}`,
        });
      }
    }

    if (options.includeAttachments) {
      onProgress({
        phase: 'attachments',
        current: 0,
        total: migratedStories.length,
        message: 'Migrating external links as attachments...',
      });

      for (let i = 0; i < migratedStories.length; i++) {
        const { story, issueId } = migratedStories[i];
        const links = extractExternalLinks(story);

        for (const link of links) {
          result.stats.attachments.attempted += 1;
          try {
            if (options.dryRun) {
              markPlannedOrCreated(result.stats.attachments, options.dryRun);
            } else {
              await linear.createAttachment(issueId, link.url, link.title);
              markPlannedOrCreated(result.stats.attachments, options.dryRun);
            }
          } catch (error) {
            result.stats.attachments.failed += 1;
            result.errors.push(
              `[attachments] Failed to migrate link for story #${story.id}: ${formatError(
                error
              )}`
            );
          }
        }

        onProgress({
          phase: 'attachments',
          current: i + 1,
          total: migratedStories.length,
          message: `Processed attachments ${i + 1}/${migratedStories.length}`,
        });
      }
    }

    const finalized = finalizeResult(result, startedAt);
    onProgress({
      phase: 'done',
      current: 1,
      total: 1,
      message: finalized.success
        ? options.dryRun
          ? 'Dry run complete. Review the plan before running for real.'
          : 'Migration complete.'
        : 'Migration completed with errors.',
    });
    return finalized;
  } catch (error) {
    result.errors.push(`[fatal] ${formatError(error)}`);
    onProgress({
      phase: 'error',
      current: 0,
      total: 0,
      message: formatError(error),
    });
    return finalizeResult(result, startedAt);
  }
}

// Validate tokens and fetch basic bootstrap metadata used by setup UX.
export async function validateTokens(tokens?: {
  shortcutToken?: string;
  linearToken?: string;
}): Promise<TokenValidationResult> {
  const state = getState();
  const shortcutToken = tokens?.shortcutToken ?? state.shortcutToken;
  const linearToken = tokens?.linearToken ?? state.linearToken;
  const result: TokenValidationResult = {
    shortcut: false,
    linear: false,
    linearTeams: [],
    errors: [],
  };

  if (!shortcutToken) {
    result.errors.push('Shortcut token is missing.');
  }

  if (!linearToken) {
    result.errors.push('Linear token is missing.');
  }

  if (!shortcutToken || !linearToken) {
    return result;
  }

  try {
    const shortcutClient = new ShortcutClient(shortcutToken);
    const member = await shortcutClient.getCurrentMember();
    result.shortcut = true;
    result.shortcutUserName = member.profile?.name ?? undefined;
  } catch (error) {
    result.errors.push(
      `Shortcut token validation failed: ${withNetworkHint(formatError(error))}`
    );
  }

  try {
    const linearClient = new LinearClient(linearToken);
    const [user, organization, teams] = await Promise.all([
      linearClient.getCurrentUser(),
      linearClient.getOrganization(),
      linearClient.getTeams({ includeAllPages: true }),
    ]);
    result.linear = true;
    result.linearUserName = user.name;
    result.linearWorkspace = organization.name;
    result.linearTeams = teams;
  } catch (error) {
    result.errors.push(
      `Linear token validation failed: ${withNetworkHint(formatError(error))}`
    );
  }

  return result;
}

// Fetch migration preview data and target teams for the wizard.
export async function fetchMigrationPreview(): Promise<MigrationPreview> {
  const state = getState();

  if (!state.shortcutToken || !state.linearToken) {
    throw new Error('Missing API tokens. Validate tokens in Setup first.');
  }

  try {
    const shortcutClient = new ShortcutClient(state.shortcutToken);
    const linearClient = new LinearClient(state.linearToken);

    const [stories, epics, iterations, labels, shortcutTeams, teams] = await Promise.all([
      shortcutClient.getAllStories(),
      shortcutClient.getEpics(),
      shortcutClient.getIterations(),
      shortcutClient.getLabels(),
      shortcutClient.getTeams(),
      linearClient.getTeams({ includeAllPages: true }),
    ]);

    return {
      stories: stories.length,
      epics: epics.length,
      iterations: iterations.length,
      labels: labels.length,
      shortcutTeams,
      teams,
    };
  } catch (error) {
    throw new Error(`Preview fetch failed: ${withNetworkHint(formatError(error))}`);
  }
}
