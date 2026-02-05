'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Zap,
  Users,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getState } from '@/lib/db';
import { runMigration, fetchMigrationPreview, MigrationProgress } from '@/lib/migration/service';
import Link from 'next/link';

const steps = ['Mode', 'Preview', 'Migrate', 'Done'];

const modes = [
  { id: 'one-shot', title: 'One-Shot', description: 'Migrate everything at once', icon: Zap },
  { id: 'team-by-team', title: 'Team-by-Team', description: 'Migrate gradually', icon: Users, popular: true },
  { id: 'sync', title: 'Real-Time Sync', description: 'Keep both in sync', icon: RefreshCw, disabled: true },
];

export default function MigratePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<string | null>(null);
  const [hasTokens, setHasTokens] = useState(false);
  const [preview, setPreview] = useState<{ stories: number; epics: number; iterations: number; labels: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [result, setResult] = useState<{ success: boolean; stats: Record<string, number>; errors: string[] } | null>(null);

  useEffect(() => {
    const state = getState();
    if (!state.shortcutToken || !state.linearToken) {
      router.push('/setup');
    } else {
      setHasTokens(true);
    }
  }, [router]);

  const loadPreview = async () => {
    setLoading(true);
    const data = await fetchMigrationPreview();
    setPreview(data);
    setLoading(false);
  };

  const startMigration = async () => {
    setStep(2);
    // TODO: Let user select Linear team
    const linearTeamId = 'default'; // This should be selected by user

    try {
      const migrationResult = await runMigration(linearTeamId, (p) => {
        setProgress(p);
      });
      setResult(migrationResult);
      if (migrationResult.success) {
        setStep(3);
      }
    } catch (error) {
      setResult({
        success: false,
        stats: {},
        errors: [error instanceof Error ? error.message : 'Migration failed'],
      });
    }
  };

  if (!hasTokens) return null;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Migrate</h1>
        <p className="text-muted-foreground mt-1">Transfer your Shortcut data to Linear</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'border-2 border-primary text-primary' :
                'border-2 border-muted text-muted-foreground'
              )}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={cn('w-12 h-0.5 mx-2', i < step ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Mode Selection */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Migration Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {modes.map((m) => (
              <div
                key={m.id}
                onClick={() => !m.disabled && setMode(m.id)}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-lg border transition-colors',
                  m.disabled ? 'opacity-50 cursor-not-allowed' :
                  mode === m.id ? 'border-primary bg-primary/5 cursor-pointer' :
                  'hover:border-primary/50 cursor-pointer'
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <m.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{m.title}</div>
                  <div className="text-sm text-muted-foreground">{m.description}</div>
                </div>
                {m.popular && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Popular</span>}
                {m.disabled && <span className="text-xs text-muted-foreground">Coming soon</span>}
              </div>
            ))}

            <div className="pt-4 flex justify-end">
              <Button onClick={() => { setStep(1); loadPreview(); }} disabled={!mode}>
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Preview */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Migration</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Fetching data from Shortcut...</p>
              </div>
            ) : preview ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-3xl font-bold">{preview.stories}</div>
                    <div className="text-sm text-muted-foreground">Stories</div>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-3xl font-bold">{preview.epics}</div>
                    <div className="text-sm text-muted-foreground">Epics</div>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-3xl font-bold">{preview.iterations}</div>
                    <div className="text-sm text-muted-foreground">Iterations</div>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-3xl font-bold">{preview.labels}</div>
                    <div className="text-sm text-muted-foreground">Labels</div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/5">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                    <div className="text-sm">
                      <strong>Ready to migrate.</strong> This will create new items in Linear.
                      The process cannot be undone automatically.
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button onClick={startMigration}>
                    Start Migration <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>Failed to fetch preview. Check your Shortcut token.</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/setup')}>
                  Check Setup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Migrating */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Migrating...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              {progress?.phase === 'error' ? (
                <>
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Migration Failed</h3>
                  <p className="text-muted-foreground mb-4">{progress.message}</p>
                  <Button onClick={() => setStep(1)}>Try Again</Button>
                </>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-medium mb-2">{progress?.message || 'Starting...'}</h3>
                  {progress && progress.total > 0 && (
                    <div className="max-w-xs mx-auto">
                      <Progress value={(progress.current / progress.total) * 100} className="mb-2" />
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

      {/* Step 3: Done */}
      {step === 3 && result && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Complete!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-6">Your data has been migrated to Linear</h3>

              <div className="grid grid-cols-2 gap-4 mb-6 max-w-sm mx-auto">
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <div className="text-2xl font-bold text-green-600">{result.stats.issues || 0}</div>
                  <div className="text-xs text-muted-foreground">Issues</div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <div className="text-2xl font-bold text-green-600">{result.stats.projects || 0}</div>
                  <div className="text-xs text-muted-foreground">Projects</div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <div className="text-2xl font-bold text-green-600">{result.stats.cycles || 0}</div>
                  <div className="text-xs text-muted-foreground">Cycles</div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <div className="text-2xl font-bold text-green-600">{result.stats.labels || 0}</div>
                  <div className="text-xs text-muted-foreground">Labels</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mb-6 p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/5 text-left max-w-sm mx-auto">
                  <p className="text-sm font-medium mb-2">{result.errors.length} items skipped:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {result.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                    {result.errors.length > 5 && <li>• ...and {result.errors.length - 5} more</li>}
                  </ul>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <Button variant="outline" asChild>
                  <Link href="/setup">Back to Setup</Link>
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
