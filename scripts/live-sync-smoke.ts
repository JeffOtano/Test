import fs from 'node:fs';
import path from 'node:path';
import { LinearClient } from '../src/lib/linear/client';
import { ShortcutClient } from '../src/lib/shortcut/client';
import { runSyncCycle } from '../src/lib/sync/service';
import {
  buildLinearStateIdByShortcutType,
  buildShortcutStateTypeById,
  mapStoryToLinearStateId,
} from '../src/lib/workflow-state-mapping';
import type { ShortcutStory, ShortcutWorkflowState } from '../src/types';

interface LiveSmokeConfig {
  shortcutToken: string;
  linearToken: string;
  linearTeamId: string;
  shortcutTeamId?: string;
  prefix: string;
}

interface CheckRecord {
  name: string;
  passed: boolean;
  details?: string;
}

interface SmokeReport {
  runId: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  config: Omit<LiveSmokeConfig, 'shortcutToken' | 'linearToken'>;
  checks: CheckRecord[];
  fixture: {
    shortcutStoryId?: number;
    linearIssueId?: string;
    linearIssueIdentifier?: string;
    shortcutTeamId?: string;
    linearTeamId: string;
    createdLabelNames: string[];
    createdLinks: string[];
  };
  errors: string[];
}

function parseDotenvFile(content: string): Record<string, string> {
  const output: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }

  return output;
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const parsed = parseDotenvFile(fs.readFileSync(filePath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(
  keys: string[],
  label: string,
  errors: string[]
): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  errors.push(`Missing ${label}. Set one of: ${keys.join(', ')}`);
  return undefined;
}

function getOptionalEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function appendCheck(
  report: SmokeReport,
  name: string,
  passed: boolean,
  details?: string
): void {
  report.checks.push({ name, passed, details });
  if (!passed) {
    throw new Error(details ? `${name}: ${details}` : name);
  }
}

function extractStoryLinks(story: Pick<ShortcutStory, 'external_links'>): string[] {
  const urls: string[] = [];

  for (const entry of story.external_links ?? []) {
    if (typeof entry === 'string') {
      if (entry.startsWith('http')) urls.push(entry);
      continue;
    }

    const record = entry as Record<string, unknown>;
    const candidate =
      (typeof record.url === 'string' && record.url) ||
      (typeof record.external_url === 'string' && record.external_url) ||
      (typeof record.link === 'string' && record.link) ||
      '';

    if (candidate.startsWith('http')) urls.push(candidate);
  }

  return Array.from(new Set(urls));
}

function findPreferredState(
  states: ShortcutWorkflowState[],
  type: ShortcutWorkflowState['type']
): ShortcutWorkflowState | undefined {
  const candidates = states
    .filter((state) => state.type === type)
    .sort((a, b) => a.position - b.position);
  return candidates[0];
}

function writeReport(report: SmokeReport): string {
  const outputDir = path.join(process.cwd(), 'artifacts', 'live');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `live-smoke-${report.runId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  return outputPath;
}

async function main(): Promise<void> {
  loadEnvFile(path.join(process.cwd(), '.env.local'));
  loadEnvFile(path.join(process.cwd(), '.env'));

  const configErrors: string[] = [];
  const shortcutToken =
    requireEnv(
      ['GOODBYE_LIVE_SHORTCUT_TOKEN', 'GOODBYE_SHORTCUT_TOKEN', 'SHORTCUT_TOKEN'],
      'Shortcut token',
      configErrors
    ) ?? '';
  const linearToken =
    requireEnv(
      ['GOODBYE_LIVE_LINEAR_TOKEN', 'GOODBYE_LINEAR_TOKEN', 'LINEAR_TOKEN'],
      'Linear token',
      configErrors
    ) ?? '';
  const linearTeamId =
    requireEnv(
      ['GOODBYE_LIVE_LINEAR_TEAM_ID', 'GOODBYE_LINEAR_TEAM_ID', 'LINEAR_TEAM_ID'],
      'Linear team id',
      configErrors
    ) ?? '';
  const shortcutTeamId = getOptionalEnv([
    'GOODBYE_LIVE_SHORTCUT_TEAM_ID',
    'GOODBYE_SYNC_SHORTCUT_TEAM_ID',
    'SHORTCUT_TEAM_ID',
  ]);

  if (configErrors.length > 0) {
    throw new Error(configErrors.join('\n'));
  }

  const config: LiveSmokeConfig = {
    shortcutToken,
    linearToken,
    linearTeamId,
    shortcutTeamId,
    prefix: process.env.GOODBYE_LIVE_PREFIX?.trim() || 'GS-LIVE',
  };

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  const report: SmokeReport = {
    runId,
    startedAt: new Date(startedAt).toISOString(),
    config: {
      linearTeamId: config.linearTeamId,
      shortcutTeamId: config.shortcutTeamId,
      prefix: config.prefix,
    },
    checks: [],
    fixture: {
      linearTeamId: config.linearTeamId,
      createdLabelNames: [],
      createdLinks: [],
    },
    errors: [],
  };

  const shortcut = new ShortcutClient(config.shortcutToken);
  const linear = new LinearClient(config.linearToken);
  const resolvedLinearTeamId = await linear.resolveTeamId(config.linearTeamId);
  report.config.linearTeamId = resolvedLinearTeamId;
  report.fixture.linearTeamId = resolvedLinearTeamId;

  let createdStoryId: number | undefined;
  let createdIssueId: string | undefined;

  try {
    const [shortcutMember, linearUser, linearTeam, shortcutTeams, shortcutWorkflows] =
      await Promise.all([
        shortcut.getCurrentMember(),
        linear.getCurrentUser(),
        linear.getTeam(resolvedLinearTeamId),
        shortcut.getTeams(),
        shortcut.getWorkflows(),
      ]);

    appendCheck(
      report,
      'Shortcut token is valid',
      Boolean(shortcutMember.id),
      'Shortcut member could not be loaded'
    );
    appendCheck(
      report,
      'Linear token is valid',
      Boolean(linearUser.id),
      'Linear user could not be loaded'
    );
    appendCheck(
      report,
      'Linear team is accessible',
      Boolean(linearTeam.id),
      'Target Linear team is not accessible'
    );

    const selectedShortcutTeam =
      (config.shortcutTeamId
        ? shortcutTeams.find((team) => String(team.id) === String(config.shortcutTeamId))
        : undefined) ?? shortcutTeams[0];

    appendCheck(
      report,
      'Shortcut source team is available',
      Boolean(selectedShortcutTeam),
      'No Shortcut team is accessible with this token'
    );

    const sourceTeamId = String(selectedShortcutTeam.id);
    report.fixture.shortcutTeamId = sourceTeamId;

    const teamWorkflowIdSet = new Set(selectedShortcutTeam.workflow_ids);
    const teamStates = shortcutWorkflows
      .filter((workflow) => teamWorkflowIdSet.has(workflow.id))
      .flatMap((workflow) => workflow.states);

    appendCheck(
      report,
      'Shortcut source team has workflow states',
      teamStates.length > 0,
      `Team ${selectedShortcutTeam.name} has no workflow states`
    );

    const unstartedState =
      findPreferredState(teamStates, 'unstarted') ??
      [...teamStates].sort((a, b) => a.position - b.position)[0];
    const startedState = findPreferredState(teamStates, 'started') ?? unstartedState;

    appendCheck(
      report,
      'Shortcut source team has a usable initial state',
      Boolean(unstartedState),
      'No initial workflow state found for test story creation'
    );

    const labelOneName = `${config.prefix.toLowerCase()}-${runId}-alpha`;
    const labelTwoName = `${config.prefix.toLowerCase()}-${runId}-beta`;
    const linkOne = `https://example.com/${runId}/one`;
    const linkTwo = `https://example.com/${runId}/two`;

    report.fixture.createdLabelNames.push(labelOneName, labelTwoName);
    report.fixture.createdLinks.push(linkOne, linkTwo);

    const baseStoryDescription = [
      `${config.prefix} Shortcut -> Linear live smoke`,
      `Run ID: ${runId}`,
      'Phase: initial',
    ].join('\n');

    const createdStory = await shortcut.createStory({
      name: `${config.prefix} ${runId} smoke`,
      description: baseStoryDescription,
      story_type: 'feature',
      workflow_state_id: unstartedState.id,
      labels: [{ name: labelOneName, color: '#2563EB' }],
      external_links: [linkOne],
      estimate: 2,
    });

    createdStoryId = createdStory.id;
    report.fixture.shortcutStoryId = createdStory.id;

    const createdStoryComment = await shortcut.createStoryComment(createdStory.id, {
      text: `${config.prefix} comment phase1 ${runId}`,
    });

    const firstCycle = await runSyncCycle({
      shortcutToken: config.shortcutToken,
      linearToken: config.linearToken,
      config: {
        direction: 'SHORTCUT_TO_LINEAR',
        conflictPolicy: 'NEWEST_WINS',
        shortcutTeamId: sourceTeamId,
        linearTeamId: resolvedLinearTeamId,
        includeComments: true,
        includeAttachments: true,
      },
      triggerSource: 'system',
      triggerReason: `live smoke phase1 ${runId}`,
    });

    appendCheck(
      report,
      'First sync cycle completed without sync errors',
      firstCycle.delta.errors === 0,
      `First cycle reported ${firstCycle.delta.errors} errors`
    );

    const createdIssueEvent = firstCycle.events.find(
      (event) =>
        event.entityType === 'issue' &&
        event.action === 'create' &&
        event.message.includes(`story ${createdStory.id}`)
    );

    const createdIssue = createdIssueEvent
      ? await linear.getIssue(createdIssueEvent.entityId)
      : (await linear
          .getIssues(resolvedLinearTeamId, { includeAllPages: true }))
          .find((issue) => (issue.description ?? '').includes(`Shortcut Story ID: ${createdStory.id}`));

    appendCheck(
      report,
      'Shortcut story created a Linear issue',
      Boolean(createdIssue),
      `No Linear issue found for Shortcut story ${createdStory.id}`
    );

    if (!createdIssue) {
      throw new Error(`No Linear issue found for Shortcut story ${createdStory.id}`);
    }

    const linearIssue = createdIssue;

    createdIssueId = linearIssue.id;
    report.fixture.linearIssueId = linearIssue.id;
    report.fixture.linearIssueIdentifier = linearIssue.identifier;

    appendCheck(
      report,
      'Linear issue title matches Shortcut story',
      linearIssue.title === createdStory.name,
      `Expected "${createdStory.name}" got "${linearIssue.title}"`
    );
    appendCheck(
      report,
      'Linear issue description contains smoke marker',
      (linearIssue.description ?? '').includes(`Run ID: ${runId}`),
      'Linear issue description did not include story body'
    );
    appendCheck(
      report,
      'Linear issue includes synced label',
      linearIssue.labels.some((label) => label.name === labelOneName),
      `Linear issue missing label ${labelOneName}`
    );

    const attachments = await linear.getIssueAttachments(linearIssue.id, {
      includeAllPages: true,
    });
    appendCheck(
      report,
      'Linear issue includes synced attachment/link',
      attachments.some((attachment) => attachment.url === linkOne),
      `Linear issue missing attachment ${linkOne}`
    );

    const comments = await linear.getIssueComments(linearIssue.id, {
      includeAllPages: true,
    });
    appendCheck(
      report,
      'Linear issue includes synced Shortcut comment',
      comments.some((comment) =>
        comment.body.includes(`Shortcut Comment ID: ${createdStoryComment.id}`)
      ),
      `Linear issue missing comment marker for ${createdStoryComment.id}`
    );

    const shortcutStateTypeById = buildShortcutStateTypeById(shortcutWorkflows);
    const linearWorkflowStates = await linear.getWorkflowStates(resolvedLinearTeamId);
    const linearStateIdByShortcutType = buildLinearStateIdByShortcutType(linearWorkflowStates);
    const expectedLinearStateIdPhase1 = mapStoryToLinearStateId(
      createdStory,
      shortcutStateTypeById,
      linearStateIdByShortcutType
    );

    appendCheck(
      report,
      'Linear issue state matches mapped Shortcut state',
      !expectedLinearStateIdPhase1 || linearIssue.state.id === expectedLinearStateIdPhase1,
      expectedLinearStateIdPhase1
        ? `Expected state ${expectedLinearStateIdPhase1}, got ${linearIssue.state.id}`
        : 'No expected state id available for verification'
    );

    const updatedStoryDescription = [
      `${config.prefix} Shortcut -> Linear live smoke`,
      `Run ID: ${runId}`,
      'Phase: updated',
    ].join('\n');

    const updatedStory = await shortcut.updateStory(createdStory.id, {
      name: `${config.prefix} ${runId} smoke updated`,
      description: updatedStoryDescription,
      workflow_state_id: startedState.id,
      labels: [
        { name: labelOneName, color: '#2563EB' },
        { name: labelTwoName, color: '#0891B2' },
      ],
      external_links: [linkOne, linkTwo],
      estimate: 3,
    });

    const updatedStoryComment = await shortcut.createStoryComment(createdStory.id, {
      text: `${config.prefix} comment phase2 ${runId}`,
    });

    const secondCycle = await runSyncCycle({
      shortcutToken: config.shortcutToken,
      linearToken: config.linearToken,
      config: {
        direction: 'SHORTCUT_TO_LINEAR',
        conflictPolicy: 'NEWEST_WINS',
        shortcutTeamId: sourceTeamId,
        linearTeamId: resolvedLinearTeamId,
        includeComments: true,
        includeAttachments: true,
      },
      cursors: firstCycle.cursors,
      triggerSource: 'system',
      triggerReason: `live smoke phase2 ${runId}`,
    });

    appendCheck(
      report,
      'Second sync cycle completed without sync errors',
      secondCycle.delta.errors === 0,
      `Second cycle reported ${secondCycle.delta.errors} errors`
    );

    const issueAfterUpdate = await linear.getIssue(linearIssue.id);

    appendCheck(
      report,
      'Linear issue reflects updated story title',
      issueAfterUpdate.title === updatedStory.name,
      `Expected "${updatedStory.name}" got "${issueAfterUpdate.title}"`
    );
    appendCheck(
      report,
      'Linear issue reflects updated story description',
      (issueAfterUpdate.description ?? '').includes('Phase: updated'),
      'Linear issue did not receive updated description'
    );
    appendCheck(
      report,
      'Linear issue reflects both synced labels',
      issueAfterUpdate.labels.some((label) => label.name === labelOneName) &&
        issueAfterUpdate.labels.some((label) => label.name === labelTwoName),
      `Linear issue missing expected labels ${labelOneName}/${labelTwoName}`
    );

    const attachmentsAfterUpdate = await linear.getIssueAttachments(createdIssue.id, {
      includeAllPages: true,
    });
    appendCheck(
      report,
      'Linear issue reflects updated links as attachments',
      attachmentsAfterUpdate.some((attachment) => attachment.url === linkTwo),
      `Linear issue missing attachment ${linkTwo}`
    );

    const commentsAfterUpdate = await linear.getIssueComments(createdIssue.id, {
      includeAllPages: true,
    });
    appendCheck(
      report,
      'Linear issue received second synced Shortcut comment',
      commentsAfterUpdate.some((comment) =>
        comment.body.includes(`Shortcut Comment ID: ${updatedStoryComment.id}`)
      ),
      `Linear issue missing phase2 comment marker for ${updatedStoryComment.id}`
    );

    const reverseLabelName = `${config.prefix.toLowerCase()}-${runId}-reverse`;
    const reverseLink = `https://example.com/${runId}/linear-reverse`;

    report.fixture.createdLabelNames.push(reverseLabelName);
    report.fixture.createdLinks.push(reverseLink);

    const reverseLabel = await linear.createLabel(
      reverseLabelName,
      '#16A34A',
      resolvedLinearTeamId
    );

    const nextLabelIds = Array.from(
      new Set([...issueAfterUpdate.labels.map((label) => label.id), reverseLabel.id])
    );

    await linear.updateIssue(linearIssue.id, {
      title: `${config.prefix} ${runId} reverse`,
      description: [
        `${config.prefix} Linear -> Shortcut live smoke`,
        `Run ID: ${runId}`,
        'Phase: reverse',
      ].join('\n'),
      labelIds: nextLabelIds,
      estimate: 5,
    });

    const reverseComment = await linear.createComment(
      linearIssue.id,
      `${config.prefix} linear comment reverse ${runId}`
    );

    await linear.createAttachment(linearIssue.id, reverseLink, 'Live Smoke Reverse Link');

    const thirdCycle = await runSyncCycle({
      shortcutToken: config.shortcutToken,
      linearToken: config.linearToken,
      config: {
        direction: 'LINEAR_TO_SHORTCUT',
        conflictPolicy: 'NEWEST_WINS',
        shortcutTeamId: sourceTeamId,
        linearTeamId: resolvedLinearTeamId,
        includeComments: true,
        includeAttachments: true,
      },
      cursors: secondCycle.cursors,
      triggerSource: 'system',
      triggerReason: `live smoke reverse ${runId}`,
    });

    appendCheck(
      report,
      'Reverse sync cycle completed without sync errors',
      thirdCycle.delta.errors === 0,
      `Reverse cycle reported ${thirdCycle.delta.errors} errors`
    );

    const storyAfterReverse = await shortcut.getStory(createdStory.id);
    appendCheck(
      report,
      'Shortcut story reflects reverse Linear title',
      storyAfterReverse.name.includes('reverse'),
      `Shortcut story title did not update from Linear. Got "${storyAfterReverse.name}"`
    );
    appendCheck(
      report,
      'Shortcut story reflects reverse label from Linear',
      storyAfterReverse.labels.some((label) => label.name === reverseLabelName),
      `Shortcut story missing reverse label ${reverseLabelName}`
    );

    const reverseLinks = extractStoryLinks(storyAfterReverse);
    appendCheck(
      report,
      'Shortcut story reflects reverse attachment/link from Linear',
      reverseLinks.includes(reverseLink),
      `Shortcut story missing reverse link ${reverseLink}`
    );

    const storyCommentsAfterReverse = await shortcut.getStoryComments(createdStory.id);
    appendCheck(
      report,
      'Shortcut story received reverse Linear comment',
      storyCommentsAfterReverse.some((comment) =>
        comment.text.includes(`Linear Comment ID: ${reverseComment.id}`)
      ),
      `Shortcut story missing reverse comment marker for ${reverseComment.id}`
    );
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : 'Unknown smoke test error');
    throw error;
  } finally {
    try {
      if (createdStoryId !== undefined) {
        await shortcut.updateStory(createdStoryId, { archived: true });
      }
    } catch (error) {
      report.errors.push(
        `Cleanup failed for Shortcut story ${createdStoryId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    try {
      if (createdIssueId) {
        await linear.archiveIssue(createdIssueId);
      }
    } catch (error) {
      report.errors.push(
        `Cleanup failed for Linear issue ${createdIssueId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    const endedAt = Date.now();
    report.endedAt = new Date(endedAt).toISOString();
    report.durationMs = endedAt - startedAt;
    const reportPath = writeReport(report);

    const passedChecks = report.checks.filter((check) => check.passed).length;
    const failedChecks = report.checks.length - passedChecks;
    console.log(
      `[live-smoke] checks=${report.checks.length} passed=${passedChecks} failed=${failedChecks}`
    );
    console.log(`[live-smoke] report=${reportPath}`);
  }
}

main().catch((error) => {
  console.error('[live-smoke] failed', error);
  process.exitCode = 1;
});
