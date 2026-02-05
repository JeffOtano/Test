import { ShortcutClient } from '../shortcut/client';
import { LinearClient } from '../linear/client';
import { getState } from '../db';

export interface MigrationProgress {
  phase: 'fetching' | 'labels' | 'projects' | 'cycles' | 'issues' | 'comments' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

export interface MigrationResult {
  success: boolean;
  stats: {
    labels: number;
    projects: number;
    cycles: number;
    issues: number;
    comments: number;
  };
  errors: string[];
}

export type ProgressCallback = (progress: MigrationProgress) => void;

export async function runMigration(
  linearTeamId: string,
  onProgress: ProgressCallback
): Promise<MigrationResult> {
  const state = getState();

  if (!state.shortcutToken || !state.linearToken) {
    throw new Error('Missing API tokens');
  }

  const shortcut = new ShortcutClient(state.shortcutToken);
  const linear = new LinearClient(state.linearToken);

  const result: MigrationResult = {
    success: false,
    stats: { labels: 0, projects: 0, cycles: 0, issues: 0, comments: 0 },
    errors: [],
  };

  try {
    // Phase 1: Fetch data from Shortcut
    onProgress({ phase: 'fetching', current: 0, total: 1, message: 'Fetching data from Shortcut...' });

    const [labels, epics, iterations, stories] = await Promise.all([
      shortcut.getLabels(),
      shortcut.getEpics(),
      shortcut.getIterations(),
      shortcut.getAllStories(),
    ]);

    // Phase 2: Create labels
    onProgress({ phase: 'labels', current: 0, total: labels.length, message: 'Creating labels...' });

    const labelMap = new Map<number, string>();
    for (let i = 0; i < labels.length; i++) {
      try {
        const label = labels[i];
        const created = await linear.createLabel(label.name, label.color || '#6B7280', linearTeamId);
        labelMap.set(label.id, created.id);
        result.stats.labels++;
        onProgress({ phase: 'labels', current: i + 1, total: labels.length, message: `Created label: ${label.name}` });
      } catch (e) {
        result.errors.push(`Failed to create label: ${labels[i].name}`);
      }
    }

    // Phase 3: Create projects from epics
    onProgress({ phase: 'projects', current: 0, total: epics.length, message: 'Creating projects...' });

    const projectMap = new Map<number, string>();
    for (let i = 0; i < epics.length; i++) {
      try {
        const epic = epics[i];
        const created = await linear.createProject(epic.name, [linearTeamId], epic.description);
        projectMap.set(epic.id, created.id);
        result.stats.projects++;
        onProgress({ phase: 'projects', current: i + 1, total: epics.length, message: `Created project: ${epic.name}` });
      } catch (e) {
        result.errors.push(`Failed to create project: ${epics[i].name}`);
      }
    }

    // Phase 4: Create cycles from iterations
    onProgress({ phase: 'cycles', current: 0, total: iterations.length, message: 'Creating cycles...' });

    const cycleMap = new Map<number, string>();
    for (let i = 0; i < iterations.length; i++) {
      try {
        const iteration = iterations[i];
        const created = await linear.createCycle(
          linearTeamId,
          new Date(iteration.start_date),
          new Date(iteration.end_date),
          iteration.name
        );
        cycleMap.set(iteration.id, created.id);
        result.stats.cycles++;
        onProgress({ phase: 'cycles', current: i + 1, total: iterations.length, message: `Created cycle: ${iteration.name}` });
      } catch (e) {
        result.errors.push(`Failed to create cycle: ${iterations[i].name}`);
      }
    }

    // Phase 5: Create issues from stories
    onProgress({ phase: 'issues', current: 0, total: stories.length, message: 'Creating issues...' });

    const issueMap = new Map<number, string>();
    for (let i = 0; i < stories.length; i++) {
      try {
        const story = stories[i];
        const created = await linear.createIssue({
          teamId: linearTeamId,
          title: story.name,
          description: story.description || undefined,
          projectId: story.epic_id ? projectMap.get(story.epic_id) : undefined,
          cycleId: story.iteration_id ? cycleMap.get(story.iteration_id) : undefined,
          labelIds: story.labels?.map(l => labelMap.get(l.id)).filter(Boolean) as string[],
          estimate: story.estimate,
        });
        issueMap.set(story.id, created.id);
        result.stats.issues++;
        onProgress({ phase: 'issues', current: i + 1, total: stories.length, message: `Created issue: ${story.name}` });
      } catch (e) {
        result.errors.push(`Failed to create issue: ${stories[i].name}`);
      }
    }

    // Done!
    onProgress({ phase: 'done', current: 1, total: 1, message: 'Migration complete!' });
    result.success = true;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(message);
    onProgress({ phase: 'error', current: 0, total: 0, message });
  }

  return result;
}

// Validate tokens by making test API calls
export async function validateTokens(): Promise<{ shortcut: boolean; linear: boolean }> {
  const state = getState();
  const result = { shortcut: false, linear: false };

  if (state.shortcutToken) {
    try {
      const client = new ShortcutClient(state.shortcutToken);
      await client.getCurrentMember();
      result.shortcut = true;
    } catch {
      // Token invalid
    }
  }

  if (state.linearToken) {
    try {
      const client = new LinearClient(state.linearToken);
      await client.getCurrentUser();
      result.linear = true;
    } catch {
      // Token invalid
    }
  }

  return result;
}

// Fetch summary of data to migrate
export async function fetchMigrationPreview(): Promise<{
  stories: number;
  epics: number;
  iterations: number;
  labels: number;
} | null> {
  const state = getState();

  if (!state.shortcutToken) return null;

  try {
    const client = new ShortcutClient(state.shortcutToken);
    const [stories, epics, iterations, labels] = await Promise.all([
      client.getAllStories(),
      client.getEpics(),
      client.getIterations(),
      client.getLabels(),
    ]);

    return {
      stories: stories.length,
      epics: epics.length,
      iterations: iterations.length,
      labels: labels.length,
    };
  } catch {
    return null;
  }
}
