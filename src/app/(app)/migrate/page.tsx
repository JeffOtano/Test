'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
import { getMigrationSettings, getState, setMigrationSettings, setState } from '@/lib/db';
import {
  fetchMigrationPreview,
  MigrationPreview,
  MigrationProgress,
  MigrationResult,
  runMigration,
} from '@/lib/migration/service';

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
    disabled: true,
  },
];

type SelectableMode = 'ONE_SHOT' | 'TEAM_BY_TEAM';

function describeRun(result: MigrationResult): string {
  if (result.success && result.dryRun) return 'Dry run complete';
  if (result.success) return 'Migration complete';
  return 'Migration complete with errors';
}

export default function MigratePage() {
  const persistedState = useMemo(() => getState(), []);
  const persistedSettings = useMemo(
    () => getMigrationSettings(persistedState),
    [persistedState]
  );
  const hasTokens = Boolean(
    persistedState.shortcutToken && persistedState.linearToken
  );

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<SelectableMode>(persistedSettings.mode);
  const [selectedTeamId, setSelectedTeamId] = useState(
    persistedSettings.linearTeamId ?? persistedState.linearTeams?.[0]?.id ?? ''
  );
  const [includeComments, setIncludeComments] = useState(
    persistedSettings.includeComments
  );
  const [includeAttachments, setIncludeAttachments] = useState(
    persistedSettings.includeAttachments
  );
  const [dryRun, setDryRun] = useState(persistedSettings.dryRun);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [teams, setTeams] = useState(persistedState.linearTeams ?? []);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  async function loadPreview(): Promise<void> {
    setLoading(true);
    const data = await fetchMigrationPreview();
    setPreview(data);

    if (data) {
      const normalizedTeams = data.teams.map((team) => ({
        id: team.id,
        key: team.key,
        name: team.name,
      }));
      setTeams(normalizedTeams);
      setState({ linearTeams: normalizedTeams });

      if (!selectedTeamId && normalizedTeams.length > 0) {
        const nextTeamId = normalizedTeams[0].id;
        setSelectedTeamId(nextTeamId);
        setState({ linearTeamId: nextTeamId });
      }
    }

    setLoading(false);
  }

  async function handleContinueToConfig(): Promise<void> {
    setStep(1);
    await loadPreview();
  }

  async function startMigration(): Promise<void> {
    if (!selectedTeamId) return;

    setStep(2);
    setResult(null);
    setProgress({
      phase: 'preflight',
      current: 0,
      total: 1,
      message: 'Preparing migration...',
    });

    setMigrationSettings({
      mode,
      linearTeamId: selectedTeamId,
      includeComments,
      includeAttachments,
      dryRun,
    });

    const migrationResult = await runMigration(
      {
        mode,
        linearTeamId: selectedTeamId,
        includeComments,
        includeAttachments,
        dryRun,
      },
      (nextProgress) => {
        setProgress(nextProgress);
      }
    );

    setResult(migrationResult);
    setStep(3);
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
                onClick={() => !entry.disabled && setMode(entry.id as SelectableMode)}
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
                        setSelectedTeamId(nextTeamId);
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
                        onChange={(event) => setIncludeComments(event.target.checked)}
                      />
                      Migrate comments
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeAttachments}
                        onChange={(event) => setIncludeAttachments(event.target.checked)}
                      />
                      Migrate external links as attachments
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={dryRun}
                        onChange={(event) => setDryRun(event.target.checked)}
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
                  <Button onClick={startMigration} disabled={!selectedTeamId}>
                    Start Migration <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>Failed to fetch preview. Re-check your token setup.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/setup">Check Setup</Link>
                </Button>
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
    </div>
  );
}
