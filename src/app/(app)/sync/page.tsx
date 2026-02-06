'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  clearSyncState,
  getSyncEvents,
  getSyncSettings,
  getSyncStats,
  getSyncStatus,
  setSyncSettings,
  SyncSettings,
} from '@/lib/db';
import {
  bootstrapSyncEngine,
  isSyncRunning,
  pauseRealtimeSync,
  resumeRealtimeSync,
  runSyncCycleFromState,
  startRealtimeSync,
  stopRealtimeSync,
} from '@/lib/sync/service';
import { useAppState } from '@/lib/use-app-state';

function cloneSettings(settings: SyncSettings): SyncSettings {
  return {
    enabled: settings.enabled,
    direction: settings.direction,
    shortcutTeamId: settings.shortcutTeamId,
    linearTeamId: settings.linearTeamId,
    pollIntervalSeconds: settings.pollIntervalSeconds,
    conflictPolicy: settings.conflictPolicy,
    includeComments: settings.includeComments,
    includeAttachments: settings.includeAttachments,
  };
}

export default function SyncPage() {
  const appState = useAppState();
  const hasTokens = Boolean(appState.shortcutToken && appState.linearToken);
  const persistedSettings = useMemo(
    () => getSyncSettings(appState),
    [appState]
  );
  const syncStatus = getSyncStatus(appState);
  const syncStats = getSyncStats(appState);
  const syncEvents = getSyncEvents(appState);

  const [draftSettings, setDraftSettings] = useState<SyncSettings>(() =>
    cloneSettings(persistedSettings)
  );
  const [runningAction, setRunningAction] = useState<
    'start' | 'resume' | 'pause' | 'stop' | 'run' | 'save' | null
  >(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [webhookBaseUrl, setWebhookBaseUrl] = useState('');

  useEffect(() => {
    bootstrapSyncEngine();
  }, []);

  useEffect(() => {
    setDraftSettings(cloneSettings(persistedSettings));
  }, [persistedSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setWebhookBaseUrl(window.location.origin);
  }, []);

  async function handleStart(): Promise<void> {
    setRunningAction('start');
    setSyncError(null);
    try {
      setSyncSettings({ ...draftSettings, enabled: true });
      await startRealtimeSync();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to start sync');
    } finally {
      setRunningAction(null);
    }
  }

  async function handleResume(): Promise<void> {
    setRunningAction('resume');
    setSyncError(null);
    try {
      setSyncSettings({ ...draftSettings, enabled: true });
      await resumeRealtimeSync();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to resume sync');
    } finally {
      setRunningAction(null);
    }
  }

  function handlePause(): void {
    setRunningAction('pause');
    setSyncError(null);
    try {
      pauseRealtimeSync();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to pause sync');
    } finally {
      setRunningAction(null);
    }
  }

  function handleStop(): void {
    setRunningAction('stop');
    setSyncError(null);
    try {
      stopRealtimeSync();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to stop sync');
    } finally {
      setRunningAction(null);
    }
  }

  async function handleRunOnce(): Promise<void> {
    setRunningAction('run');
    setSyncError(null);
    try {
      setSyncSettings({ ...draftSettings });
      await runSyncCycleFromState('system', 'manual run from Sync page');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to run sync cycle');
    } finally {
      setRunningAction(null);
    }
  }

  function handleSave(): void {
    setRunningAction('save');
    setSyncError(null);
    try {
      setSyncSettings({ ...draftSettings });
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setRunningAction(null);
    }
  }

  function handleResetSyncData(): void {
    setSyncError(null);
    clearSyncState();
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
              Validate your Shortcut and Linear credentials before enabling real-time
              sync.
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
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Real-Time Sync</h1>
        <p className="mt-1 text-muted-foreground">
          Run Shortcut and Linear in parallel with continuous bidirectional synchronization.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-lg font-semibold">{syncStatus}</p>
            <p className="text-xs text-muted-foreground">
              Engine: {isSyncRunning() ? 'Timer active' : 'Timer idle'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cycles Run</p>
            <p className="mt-1 text-lg font-semibold">{syncStats.cyclesRun}</p>
            <p className="text-xs text-muted-foreground">
              Last run: {syncStats.lastRunAt ? new Date(syncStats.lastRunAt).toLocaleString() : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Linear Writes</p>
            <p className="mt-1 text-lg font-semibold">
              {syncStats.createdInLinear + syncStats.updatedInLinear}
            </p>
            <p className="text-xs text-muted-foreground">
              Create {syncStats.createdInLinear} · Update {syncStats.updatedInLinear}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Shortcut Writes</p>
            <p className="mt-1 text-lg font-semibold">
              {syncStats.createdInShortcut + syncStats.updatedInShortcut}
            </p>
            <p className="text-xs text-muted-foreground">
              Create {syncStats.createdInShortcut} · Update {syncStats.updatedInShortcut}
            </p>
          </CardContent>
        </Card>
      </div>

      {syncError && (
        <div className="mb-6 rounded-lg border border-red-600/40 bg-red-600/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-red-700">
            <AlertCircle className="h-4 w-4" />
            Sync error
          </div>
          <p className="mt-1 text-muted-foreground">{syncError}</p>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sync Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <label htmlFor="sync-direction" className="mb-1 block font-medium">
                Direction
              </label>
              <select
                id="sync-direction"
                value={draftSettings.direction}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    direction: event.target.value as SyncSettings['direction'],
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="BIDIRECTIONAL">Bidirectional</option>
                <option value="SHORTCUT_TO_LINEAR">Shortcut → Linear</option>
                <option value="LINEAR_TO_SHORTCUT">Linear → Shortcut</option>
              </select>
            </div>

            <div>
              <label htmlFor="sync-conflict-policy" className="mb-1 block font-medium">
                Conflict Policy
              </label>
              <select
                id="sync-conflict-policy"
                value={draftSettings.conflictPolicy}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    conflictPolicy: event.target.value as SyncSettings['conflictPolicy'],
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="NEWEST_WINS">Newest wins</option>
                <option value="SHORTCUT_WINS">Shortcut wins</option>
                <option value="LINEAR_WINS">Linear wins</option>
                <option value="MANUAL">Manual review</option>
              </select>
            </div>

            <div>
              <label htmlFor="sync-shortcut-team" className="mb-1 block font-medium">
                Source Shortcut Team (optional)
              </label>
              <select
                id="sync-shortcut-team"
                value={draftSettings.shortcutTeamId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraftSettings((current) => ({
                    ...current,
                    shortcutTeamId: value || undefined,
                  }));
                }}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">All Shortcut teams</option>
                {(appState.shortcutTeams ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sync-linear-team" className="mb-1 block font-medium">
                Target Linear Team
              </label>
              <select
                id="sync-linear-team"
                value={draftSettings.linearTeamId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraftSettings((current) => ({
                    ...current,
                    linearTeamId: value || undefined,
                  }));
                }}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">Select team</option>
                {(appState.linearTeams ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sync-poll" className="mb-1 block font-medium">
                Poll Interval (seconds)
              </label>
              <input
                id="sync-poll"
                type="number"
                min={5}
                max={3600}
                value={draftSettings.pollIntervalSeconds}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  const value = Number.isFinite(parsed)
                    ? Math.min(Math.max(parsed, 5), 3600)
                    : 30;
                  setDraftSettings((current) => ({
                    ...current,
                    pollIntervalSeconds: value,
                  }));
                }}
                className="w-full rounded-md border bg-background px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftSettings.includeComments}
                  onChange={(event) =>
                    setDraftSettings((current) => ({
                      ...current,
                      includeComments: event.target.checked,
                    }))
                  }
                />
                Sync comment fields where supported
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftSettings.includeAttachments}
                  onChange={(event) =>
                    setDraftSettings((current) => ({
                      ...current,
                      includeAttachments: event.target.checked,
                    }))
                  }
                />
                Sync attachment/link fields where supported
              </label>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleSave} disabled={runningAction === 'save'}>
                {runningAction === 'save' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>

              <Button variant="outline" onClick={handleRunOnce} disabled={runningAction === 'run'}>
                {runningAction === 'run' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" /> Run One Cycle
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engine Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Use start/pause/resume controls for continuous syncing. Manual run executes one
              immediate cycle regardless of timer state.
            </p>

            <div className="flex flex-wrap gap-3">
              {syncStatus === 'PAUSED' || syncStatus === 'IDLE' ? (
                <Button onClick={syncStatus === 'PAUSED' ? handleResume : handleStart}>
                  {syncStatus === 'PAUSED' ? (
                    <>
                      <Play className="mr-2 h-4 w-4" /> Resume Sync
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" /> Start Sync
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handlePause} variant="outline">
                  <Pause className="mr-2 h-4 w-4" /> Pause Sync
                </Button>
              )}

              <Button onClick={handleStop} variant="outline">
                <Square className="mr-2 h-4 w-4" /> Stop Sync
              </Button>

              <Button onClick={handleResetSyncData} variant="outline">
                Reset Sync Data
              </Button>
            </div>

            <div className="rounded border border-blue-500/40 bg-blue-500/5 p-4">
              <p className="mb-2 font-medium">Webhook Endpoints</p>
              <p className="text-xs text-muted-foreground">
                Send Shortcut or Linear webhook notifications here to trigger an immediate sync
                cycle.
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                <li>{webhookBaseUrl}/api/webhooks/shortcut</li>
                <li>{webhookBaseUrl}/api/webhooks/linear</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Required headers (unless <code>GOODBYE_*</code> env vars are configured):
                {' '}<code>x-shortcut-token</code>, <code>x-linear-token</code>, <code>x-linear-team-id</code>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                For signed webhooks configure secrets and include provider signature headers:
                {' '}<code>Payload-Signature</code> (Shortcut) and <code>Linear-Signature</code> (Linear).
              </p>
            </div>

            <div className="rounded border p-4">
              <p className="font-medium">Stats</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>Conflicts: {syncStats.conflicts}</p>
                <p>Errors: {syncStats.errors}</p>
                <p>Stories scanned: {syncStats.storiesScanned}</p>
                <p>Issues scanned: {syncStats.issuesScanned}</p>
                <p>
                  Last duration:{' '}
                  {syncStats.lastRunDurationMs != null ? `${syncStats.lastRunDurationMs}ms` : 'N/A'}
                </p>
                <p>Last error: {syncStats.lastError ?? 'None'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Events</CardTitle>
        </CardHeader>
        <CardContent>
          {syncEvents.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              No sync events yet.
            </div>
          ) : (
            <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
              {syncEvents.map((event) => (
                <div key={event.id} className="rounded border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      [{event.level}] {event.message}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    source={event.source} · action={event.action} · entity={event.entityType}:{' '}
                    {event.entityId}
                  </p>
                  {event.details && (
                    <p className="mt-1 text-red-700">details: {event.details}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
