'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Zap,
  Users,
  RefreshCw,
  Settings2,
  Eye,
  Play,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getState } from '@/lib/db';

const steps = [
  { id: 'mode', title: 'Mode', icon: Settings2 },
  { id: 'mapping', title: 'Mapping', icon: Settings2 },
  { id: 'preview', title: 'Preview', icon: Eye },
  { id: 'migrate', title: 'Migrate', icon: Play },
  { id: 'done', title: 'Done', icon: CheckCheck },
];

const modes = [
  {
    id: 'one-shot',
    title: 'One-Shot',
    description: 'Migrate everything at once',
    icon: Zap,
  },
  {
    id: 'team-by-team',
    title: 'Team-by-Team',
    description: 'Migrate gradually',
    icon: Users,
    popular: true,
  },
  {
    id: 'sync',
    title: 'Real-Time Sync',
    description: 'Keep both in sync',
    icon: RefreshCw,
  },
];

export default function MigratePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [hasTokens, setHasTokens] = useState(false);

  useEffect(() => {
    const state = getState();
    if (!state.shortcutToken || !state.linearToken) {
      router.push('/setup');
    } else {
      setHasTokens(true);
    }
  }, [router]);

  if (!hasTokens) {
    return null;
  }

  const canProceed = currentStep === 0 ? selectedMode !== null : true;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Migrate</h1>
        <p className="text-muted-foreground mt-1">
          Transfer your data from Shortcut to Linear
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                i < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : i === currentStep
                  ? 'border-2 border-primary text-primary'
                  : 'border-2 border-muted text-muted-foreground'
              )}
            >
              {i < currentStep ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={cn('w-8 h-0.5 mx-1', i < currentStep ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step 1: Mode */}
          {currentStep === 0 && (
            <div className="grid gap-3">
              {modes.map((mode) => (
                <div
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors',
                    selectedMode === mode.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <mode.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{mode.title}</div>
                    <div className="text-sm text-muted-foreground">{mode.description}</div>
                  </div>
                  {mode.popular && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                      Popular
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Mapping */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Default mappings will be used:
              </p>
              {[
                ['Stories', 'Issues'],
                ['Epics', 'Projects'],
                ['Iterations', 'Cycles'],
                ['Labels', 'Labels'],
              ].map(([from, to]) => (
                <div key={from} className="flex items-center gap-3 p-3 rounded border">
                  <span className="flex-1">{from}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{to}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Preview */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Ready to fetch data from Shortcut and preview the migration.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">--</div>
                    <div className="text-sm text-muted-foreground">Stories</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">--</div>
                    <div className="text-sm text-muted-foreground">Epics</div>
                  </CardContent>
                </Card>
              </div>
              <p className="text-sm text-muted-foreground">
                Click &quot;Start Migration&quot; to begin.
              </p>
            </div>
          )}

          {/* Step 4: Migrating */}
          {currentStep === 3 && (
            <div className="py-8 text-center">
              <RefreshCw className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Migrating...</h3>
              <Progress value={45} className="mb-4" />
              <p className="text-sm text-muted-foreground">
                Please wait while we transfer your data.
              </p>
            </div>
          )}

          {/* Step 5: Done */}
          {currentStep === 4 && (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Migration Complete!</h3>
              <p className="text-muted-foreground mb-6">
                Your data has been migrated to Linear.
              </p>
              <Button asChild>
                <a href="https://linear.app" target="_blank" rel="noopener noreferrer">
                  Open Linear
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep < 4 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed}
          >
            {currentStep === 2 ? 'Start Migration' : 'Continue'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
