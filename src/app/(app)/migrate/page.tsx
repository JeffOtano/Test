'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  getMigrationHistory,
  getMigrationSettings,
  setMigrationSettings,
  setState,
  StoredShortcutTeam,
} from '@/lib/db';
import {
  fetchMigrationPreview,
  MigrationPreview,
  MigrationProgress,
  MigrationResult,
  runMigration,
} from '@/lib/migration/service';
import { useAppState } from '@/lib/use-app-state';

const steps = ['Mode', 'Configure', 'Migrate', 'Done'];

const modes: Array<{
  id: 'ONE_SHOT' | 'TEAM_BY_TEAM' | 'REAL_TIME_SYNC';
  title: string;
  description: string;
  icon: typeof Zap;
  disabled?: boolean;
  popular?: boolean;
}> = [
  {
    id: 'ONE_SHOT',
    title: 'One-Shot',
    description: 'Move everything in one controlled run',
    icon: Zap,
  },
  {
    id: 'TEAM_BY_TEAM',
    title: 'Team-by-Team',
    description: 'Run staged migrations by selecting a target team',
    icon: Users,
    popular: true,
  },
  {
    id: 'REAL_TIME_SYNC',
    title: 'Real-Time Sync',
    description: 'Bidirectional sync between tools',
    icon: RefreshCw,
  },
];

type SelectableMode = 'ONE_SHOT' | 'TEAM_BY_TEAM';

function describeRun(result: MigrationResult): string {
  if (result.success && result.dryRun) return 'Dry run complete';
  if (result.success) return 'Migration complete';
  return 'Migration complete with errors';
}

function formatUiError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'Unexpected error. Please retry.';
}

function downloadMigrationReport(
  result: MigrationResult,
  options: {
    mode: SelectableMode;
    shortcutTeamId?: string;
    linearTeamId: string;
    includeComments: boolean;
    includeAttachments: boolean;
    dryRun: boolean;
  }
): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    migration: result,
    options,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `goodbye-shortcut-report-${result.completedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MigratePage() {
  const router = useRouter();
  const appState = useAppState();
  const persistedSettings = getMigrationSettings(appState);
  const migrationHistory = getMigrationHistory(appState);
  const hasTokens = Boolean(appState.shortcutToken && appState.linearToken);

  const [step, setStep] = useState(0);
  const [modeOverride, setModeOverride] = useState<SelectableMode | null>(null);
  const [selectedShortcutTeamIdOverride, setSelectedShortcutTeamIdOverride] = useState<
    string | null
  >(null);
  const [selectedTeamIdOverride, setSelectedTeamIdOverride] = useState<string | null>(null);
  const [includeCommentsOverride, setIncludeCommentsOverride] = useState<boolean | null>(
    null
  );
  const [includeAttachmentsOverride, setIncludeAttachmentsOverride] =
    useState<boolean | null>(null);
  const [dryRunOverride, setDryRunOverride] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [shortcutTeamsOverride, setShortcutTeamsOverride] = useState<
    StoredShortcutTeam[] | null
  >(null);
  const [teamsOverride, setTeamsOverride] = useState<
    Array<{ id: string; key: string; name: string }> | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const mode = modeOverride ?? persistedSettings.mode;
  const selectedShortcutTeamId =
    selectedShortcutTeamIdOverride ??
    persistedSettings.shortcutTeamId ??
    appState.shortcutTeams?.[0]?.id;
  const selectedTeamId =
    selectedTeamIdOverride ??
    persistedSettings.linearTeamId ??
    appState.linearTeams?.[0]?.id ??
    '';
  const includeComments =
    includeCommentsOverride ?? persistedSettings.includeComments;
  const includeAttachments =
    includeAttachmentsOverride ?? persistedSettings.includeAttachments;
  const dryRun = dryRunOverride ?? persistedSettings.dryRun;
  const shortcutTeams = shortcutTeamsOverride ?? appState.shortcutTeams ?? [];
  const teams = teamsOverride ?? appState.linearTeams ?? [];
  const canStartMigration = Boolean(
    selectedTeamId &&
      (mode !== 'TEAM_BY_TEAM' || selectedShortcutTeamId !== undefined)
  );

  async function loadPreview(): Promise<void> {
    setLoading(true);
    setPreviewError(null);

    try {
      const data = await fetchMigrationPreview();
      setPreview(data);

      const normalizedShortcutTeams = data.shortcutTeams
        .map((team) => ({
          id: String(team.id),
          name: team.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const normalizedTeams = data.teams.map((team) => ({
        id: team.id,
        key: team.key,
        name: team.name,
      }));
      setShortcutTeamsOverride(normalizedShortcutTeams);
      setTeamsOverride(normalizedTeams);
      setState({
        shortcutTeams: normalizedShortcutTeams,
        linearTeams: normalizedTeams,
      });

      if (!selectedShortcutTeamId && normalizedShortcutTeams.length > 0) {
        const nextShortcutTeamId = normalizedShortcutTeams[0].id;
        setSelectedShortcutTeamIdOverride(nextShortcutTeamId);
        setState({ shortcutTeamId: nextShortcutTeamId });
      }

      if (!selectedTeamId && normalizedTeams.length > 0) {
        const nextTeamId = normalizedTeams[0].id;
        setSelectedTeamIdOverride(nextTeamId);
        setState({ linearTeamId: nextTeamId });
      }
    } catch (error) {
      const fallbackShortcutTeams =
        appState.shortcutTeams?.map((team) => {
          const parsedTeamId = Number.parseInt(team.id, 10);
          return {
            id: Number.isFinite(parsedTeamId) ? parsedTeamId : 0,
            name: team.name,
            description: '',
            workflow_ids: [],
          };
        }) ?? [];
      const fallbackTeams =
        appState.linearTeams?.map((team) => ({
          id: team.id,
          key: team.key,
          name: team.name,
          description: '',
        })) ?? [];

      setPreview({
        stories: 0,
        epics: 0,
        iterations: 0,
        labels: 0,
        shortcutTeams: fallbackShortcutTeams,
        teams: fallbackTeams,
      });
      setPreviewError(formatUiError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueToConfig(): Promise<void> {
    setStep(1);
    await loadPreview();
  }

  async function startMigration(retryStoryIds?: number[]): Promise<void> {
    if (!canStartMigration) return;

    setStep(2);
    setResult(null);
    setProgress({
      phase: 'preflight',
      current: 0,
      total: 1,
      message: 'Preparing migration...',
    });

    setMigrationSettings({
      shortcutTeamId: mode === 'TEAM_BY_TEAM' ? selectedShortcutTeamId : undefined,
      mode,
      linearTeamId: selectedTeamId,
      includeComments,
      includeAttachments,
      dryRun,
    });

    try {
      const migrationResult = await runMigration(
        {
          shortcutTeamId: mode === 'TEAM_BY_TEAM' ? selectedShortcutTeamId : undefined,
          mode,
          linearTeamId: selectedTeamId,
          includeComments,
          includeAttachments,
          dryRun,
          retryStoryIds,
        },
        (nextProgress) => {
          setProgress(nextProgress);
        }
      );

      setResult(migrationResult);
      setStep(3);
    } catch (error) {
      setProgress({
        phase: 'error',
        current: 0,
        total: 1,
        message: formatUiError(error),
      });
    }
  }

  if (!hasTokens) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Add and validate your Shortcut and Linear tokens before running migrations.
            </p>
            <Button asChild>
              <Link href="/setup">Go to Setup</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Migrate</h1>
        <p className="mt-1 text-muted-foreground">
          Configure and run a deterministic migration from Shortcut to Linear
        </p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {steps.map((label, index) => (
          <div key={label} className="flex items-center">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                index < step
                  ? 'bg-primary text-primary-foreground'
                  : index === step
                    ? 'border-2 border-primary text-primary'
                    : 'border-2 border-muted text-muted-foreground'
              )}
            >
              {index < step ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 w-12',
                  index < step ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Migration Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {modes.map((entry) => (
              <div
                key={entry.id}
                onClick={() => {
                  if (entry.id === 'REAL_TIME_SYNC') {
                    router.push('/sync');
                    return;
                  }
                  if (!entry.disabled) {
                    setModeOverride(entry.id as SelectableMode);
                  }
                }}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-4 transition-colors',
                  entry.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : mode === entry.id
                      ? 'cursor-pointer border-primary bg-primary/5'
                      : 'cursor-pointer hover:border-primary/50'
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <entry.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{entry.title}</div>
                  <div className="text-sm text-muted-foreground">{entry.description}</div>
                </div>
                {entry.popular && (
                  <span className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                    Popular
                  </span>
                )}
                {entry.disabled && (
                  <span className="text-xs text-muted-foreground">Coming soon</span>
                )}
              </div>
            ))}

            <div className="flex justify-end pt-4">
              <Button onClick={handleContinueToConfig}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Migration</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading migration preview...</p>
              </div>
            ) : preview ? (
              <div className="space-y-6">
                {previewError && (
                  <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm text-muted-foreground">
                    Preview data could not be fully loaded. Using saved team metadata only.
                    Error: {previewError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-3xl font-bold">{preview.stories}</div>
                    <div className="text-sm text-muted-foreground">Stories</div>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-3xl font-bold">{preview.epics}</div>
                    <div className="text-sm text-muted-foreground">Epics</div>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-3xl font-bold">{preview.iterations}</div>
                    <div className="text-sm text-muted-foreground">Iterations</div>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-3xl font-bold">{preview.labels}</div>
                    <div className="text-sm text-muted-foreground">Labels</div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  {mode === 'TEAM_BY_TEAM' && (
                    <div>
                      <label
                        htmlFor="source-shortcut-team"
                        className="mb-1 block text-sm font-medium"
                      >
                        Source Shortcut Team
                      </label>
                      <select
                        id="source-shortcut-team"
                        className="w-full rounded-md border bg-background px-3 py-2"
                        value={selectedShortcutTeamId ?? ''}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const nextShortcutTeamId = raw || undefined;
                          setSelectedShortcutTeamIdOverride(nextShortcutTeamId ?? null);
                          setState({ shortcutTeamId: nextShortcutTeamId });
                        }}
                      >
                        <option value="">Select a Shortcut team</option>
                        {shortcutTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Only stories from this Shortcut team will migrate in Team-by-Team
                        mode.
                      </p>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="target-team"
                      className="mb-1 block text-sm font-medium"
                    >
                      Target Linear Team
                    </label>
                    <select
                      id="target-team"
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={selectedTeamId}
                      onChange={(event) => {
                        const nextTeamId = event.target.value;
                        setSelectedTeamIdOverride(nextTeamId);
                        setState({ linearTeamId: nextTeamId });
                      }}
                    >
                      <option value="">Select a team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.key})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeComments}
                        onChange={(event) =>
                          setIncludeCommentsOverride(event.target.checked)
                        }
                      />
                      Migrate comments
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeAttachments}
                        onChange={(event) =>
                          setIncludeAttachmentsOverride(event.target.checked)
                        }
                      />
                      Migrate external links as attachments
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={dryRun}
                        onChange={(event) => setDryRunOverride(event.target.checked)}
                      />
                      Dry run (no writes to Linear)
                    </label>
                  </div>

                  {mode === 'TEAM_BY_TEAM' && (
                    <div className="rounded border border-blue-500/40 bg-blue-500/5 p-3 text-sm text-muted-foreground">
                      Team-by-Team mode is configured. Run separate migrations per Linear team
                      for staged rollout.
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
                    <div className="text-sm">
                      This process may create, reuse, or skip entities depending on existing
                      Linear data. Review results carefully before final cutover.
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={() => startMigration()} disabled={!canStartMigration}>
                    Start Migration <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p className="font-medium text-foreground">Failed to fetch preview.</p>
                {previewError && (
                  <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                    {previewError}
                  </p>
                )}
                <div className="mt-4 flex justify-center gap-3">
                  <Button variant="outline" onClick={loadPreview}>
                    Retry Preview
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/setup">Check Setup</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Migrating...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              {progress?.phase === 'error' ? (
                <>
                  <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                  <h3 className="mb-2 text-lg font-medium">Migration Failed</h3>
                  <p className="mb-4 text-muted-foreground">{progress.message}</p>
                  <Button onClick={() => setStep(1)}>Back to Config</Button>
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
                  <h3 className="mb-2 text-lg font-medium">
                    {progress?.message ?? 'Starting...'}
                  </h3>
                  {progress && progress.total > 0 && (
                    <div className="mx-auto max-w-xs">
                      <Progress
                        value={(progress.current / progress.total) * 100}
                        className="mb-2"
                      />
                      <p className="text-sm text-muted-foreground">
                        {progress.current} / {progress.total}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && result && (
        <Card>
          <CardHeader>
            <CardTitle>{describeRun(result)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <CheckCircle2
                className={cn(
                  'mx-auto mb-4 h-12 w-12',
                  result.success ? 'text-green-500' : 'text-yellow-600'
                )}
              />
              <h3 className="mb-2 text-lg font-medium">
                {result.dryRun
                  ? 'No data was written. Review the plan below.'
                  : result.success
                    ? 'Your data has been migrated to Linear.'
                    : 'Some items failed and need review.'}
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Duration: {(result.durationMs / 1000).toFixed(1)}s
              </p>

              <div className="mb-6 grid grid-cols-2 gap-4 text-left">
                {[
                  { title: 'Labels', stats: result.stats.labels },
                  { title: 'Projects', stats: result.stats.projects },
                  { title: 'Cycles', stats: result.stats.cycles },
                  { title: 'Issues', stats: result.stats.issues },
                  { title: 'Comments', stats: result.stats.comments },
                  { title: 'Attachments', stats: result.stats.attachments },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border p-3 text-sm">
                    <div className="mb-1 font-medium">{item.title}</div>
                    <div className="text-muted-foreground">
                      Attempted: {item.stats.attempted}
                    </div>
                    <div className="text-muted-foreground">Created: {item.stats.created}</div>
                    <div className="text-muted-foreground">Reused: {item.stats.reused}</div>
                    <div className="text-muted-foreground">Failed: {item.stats.failed}</div>
                  </div>
                ))}
              </div>

              {result.warnings.length > 0 && (
                <div className="mx-auto mb-6 max-w-xl rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4 text-left">
                  <p className="mb-2 text-sm font-medium">Warnings</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {result.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="mx-auto mb-6 max-w-xl rounded-lg border border-red-500/50 bg-red-500/5 p-4 text-left">
                  <p className="mb-2 text-sm font-medium">{result.errors.length} errors</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {result.errors.slice(0, 12).map((error) => (
                      <li key={error}>• {error}</li>
                    ))}
                    {result.errors.length > 12 && (
                      <li>• ...and {result.errors.length - 12} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <Button variant="outline" asChild>
                  <Link href="/setup">Back to Setup</Link>
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Run Again
                </Button>
                {result.retryStoryIds.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => startMigration(result.retryStoryIds)}
                  >
                    Retry Failed Stories
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadMigrationReport(result, {
                      mode,
                      shortcutTeamId:
                        mode === 'TEAM_BY_TEAM' ? selectedShortcutTeamId : undefined,
                      linearTeamId: selectedTeamId,
                      includeComments,
                      includeAttachments,
                      dryRun,
                    })
                  }
                >
                  Download Report
                </Button>
                <Button asChild>
                  <a href="https://linear.app" target="_blank" rel="noopener noreferrer">
                    Open Linear
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {migrationHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Migration Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {migrationHistory.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border p-3 text-muted-foreground"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {entry.mode} · {entry.success ? 'Success' : 'Completed with errors'}
                    </span>
                    <span>{new Date(entry.completedAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-xs">
                    Duration {(entry.durationMs / 1000).toFixed(1)}s · Issues attempted{' '}
                    {entry.stats.issues.attempted} · Failed {entry.stats.issues.failed}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
