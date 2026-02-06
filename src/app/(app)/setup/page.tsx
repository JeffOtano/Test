'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setState, StoredLinearTeam } from '@/lib/db';
import { validateTokens } from '@/lib/migration/service';
import { useAppState } from '@/lib/use-app-state';

type ValidationState = 'idle' | 'validating' | 'success' | 'error';

function sanitizeTeams(teams: StoredLinearTeam[]): StoredLinearTeam[] {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name));
}

export default function SetupPage() {
  const persistedState = useAppState();
  const [shortcutTokenDraft, setShortcutTokenDraft] = useState<string | null>(null);
  const [linearTokenDraft, setLinearTokenDraft] = useState<string | null>(null);
  const [showShortcut, setShowShortcut] = useState(false);
  const [showLinear, setShowLinear] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validatedWorkspaceName, setValidatedWorkspaceName] = useState('');
  const [validatedTeamCount, setValidatedTeamCount] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const shortcutToken = shortcutTokenDraft ?? persistedState.shortcutToken ?? '';
  const linearToken = linearTokenDraft ?? persistedState.linearToken ?? '';
  const workspaceName =
    validatedWorkspaceName || persistedState.linearWorkspace || '';
  const teamCount =
    validatedTeamCount ?? persistedState.linearTeams?.length ?? 0;

  const isComplete =
    shortcutToken.trim().length > 0 && linearToken.trim().length > 0;
  const tokenHasChanged =
    shortcutToken !== (persistedState.shortcutToken ?? '') ||
    linearToken !== (persistedState.linearToken ?? '');
  const canContinue =
    isComplete &&
    (validationState === 'success' ||
      (!tokenHasChanged && Boolean(persistedState.lastValidatedAt)));

  async function handleValidateAndSave(): Promise<void> {
    if (!isComplete) return;

    setValidationState('validating');
    setValidationErrors([]);
    setSaved(false);

    const normalizedShortcutToken = shortcutToken.trim();
    const normalizedLinearToken = linearToken.trim();

    const validation = await validateTokens({
      shortcutToken: normalizedShortcutToken,
      linearToken: normalizedLinearToken,
    });

    if (!validation.shortcut || !validation.linear) {
      setValidationState('error');
      setValidationErrors(
        validation.errors.length > 0
          ? validation.errors
          : ['Token validation failed.']
      );
      return;
    }

    const teams = sanitizeTeams(
      validation.linearTeams.map((team) => ({
        id: team.id,
        key: team.key,
        name: team.name,
      }))
    );

    const currentSelectedTeamId = persistedState.linearTeamId;
    const selectedTeamId = teams.some((team) => team.id === currentSelectedTeamId)
      ? currentSelectedTeamId
      : teams[0]?.id;

    setState({
      shortcutToken: normalizedShortcutToken,
      linearToken: normalizedLinearToken,
      shortcutUserName: validation.shortcutUserName,
      linearUserName: validation.linearUserName,
      linearWorkspace: validation.linearWorkspace,
      linearTeams: teams,
      linearTeamId: selectedTeamId,
      migrationMode: persistedState.migrationMode ?? 'ONE_SHOT',
      includeComments: persistedState.includeComments ?? true,
      includeAttachments: persistedState.includeAttachments ?? true,
      dryRun: persistedState.dryRun ?? false,
      lastValidatedAt: new Date().toISOString(),
    });

    setValidatedWorkspaceName(validation.linearWorkspace ?? '');
    setValidatedTeamCount(teams.length);
    setValidationState('success');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Setup</h1>
        <p className="mt-1 text-muted-foreground">
          Validate your tokens and bootstrap team metadata before migration
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Shortcut API Token</CardTitle>
                <CardDescription>
                  Get your token from Shortcut settings
                </CardDescription>
              </div>
              {shortcutToken && (
                <Badge className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Added
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <input
                type={showShortcut ? 'text' : 'password'}
                value={shortcutToken}
                onChange={(event) => {
                  setShortcutTokenDraft(event.target.value);
                  setValidationState('idle');
                  setValidationErrors([]);
                }}
                placeholder="Paste your Shortcut API token"
                className="w-full rounded-md border bg-background px-3 py-2 pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowShortcut((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showShortcut ? 'Hide Shortcut token' : 'Show Shortcut token'}
              >
                {showShortcut ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <a
              href="https://app.shortcut.com/settings/account/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Get your Shortcut token <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Linear API Key</CardTitle>
                <CardDescription>
                  Get your key from Linear settings
                </CardDescription>
              </div>
              {linearToken && (
                <Badge className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Added
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <input
                type={showLinear ? 'text' : 'password'}
                value={linearToken}
                onChange={(event) => {
                  setLinearTokenDraft(event.target.value);
                  setValidationState('idle');
                  setValidationErrors([]);
                }}
                placeholder="Paste your Linear API key"
                className="w-full rounded-md border bg-background px-3 py-2 pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowLinear((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showLinear ? 'Hide Linear token' : 'Show Linear token'}
              >
                {showLinear ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <a
              href="https://linear.app/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Get your Linear API key <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {validationState === 'success' && (
          <div className="rounded-lg border border-green-600/40 bg-green-600/5 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Tokens validated
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Workspace: {workspaceName || 'Unknown'}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Teams discovered: {teamCount}
              </div>
            </div>
          </div>
        )}

        {validationState === 'error' && (
          <div className="rounded-lg border border-red-600/40 bg-red-600/5 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-red-700">
              <AlertCircle className="h-4 w-4" />
              Validation failed
            </div>
            <ul className="space-y-1 text-muted-foreground">
              {validationErrors.map((error) => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <Button onClick={handleValidateAndSave} disabled={!isComplete || validationState === 'validating'}>
            {validationState === 'validating' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : saved ? (
              'Saved!'
            ) : (
              'Validate & Save'
            )}
          </Button>
          {canContinue && (
            <Button asChild variant="outline">
              <Link href="/migrate">Continue to Migration</Link>
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Tokens are stored in your browser localStorage and are not persisted by this app server.
        </p>
      </div>
    </div>
  );
}
