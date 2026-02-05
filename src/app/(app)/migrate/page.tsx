'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Zap,
  Users,
  RefreshCw,
  Link as LinkIcon,
  Settings2,
  Eye,
  Play,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { id: 'connect', title: 'Connect', description: 'Link your accounts', icon: LinkIcon },
  { id: 'mode', title: 'Mode', description: 'Choose migration type', icon: Settings2 },
  { id: 'mapping', title: 'Mapping', description: 'Configure field mapping', icon: Settings2 },
  { id: 'preview', title: 'Preview', description: 'Review changes', icon: Eye },
  { id: 'migrate', title: 'Migrate', description: 'Execute migration', icon: Play },
  { id: 'complete', title: 'Complete', description: 'Migration done', icon: CheckCheck },
];

const migrationModes = [
  {
    id: 'one-shot',
    title: 'One-Shot Migration',
    description: 'Migrate all data at once. Best for teams ready to fully commit.',
    icon: Zap,
    features: ['Complete data transfer', 'All history preserved', 'Single operation'],
  },
  {
    id: 'team-by-team',
    title: 'Team-by-Team',
    description: 'Migrate teams gradually. Perfect for phased rollouts.',
    icon: Users,
    features: ['Migrate one team at a time', 'Pause and resume', 'Control the timeline'],
    popular: true,
  },
  {
    id: 'real-time-sync',
    title: 'Real-Time Sync',
    description: 'Keep both tools in sync. Ideal for trial periods.',
    icon: RefreshCw,
    features: ['Bidirectional sync', 'Zero data loss', 'Switch when ready'],
  },
];

export default function MigratePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [connections, setConnections] = useState({
    shortcut: false,
    linear: false,
  });

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return connections.shortcut && connections.linear;
      case 1:
        return selectedMode !== null;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Migration Wizard</h1>
        <p className="text-muted-foreground mt-1">
          Follow the steps to migrate from Shortcut to Linear
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                  index < currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : index === currentStep
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground'
                )}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-12 lg:w-24 mx-2',
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'text-center',
                index === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
              )}
              style={{ width: '80px' }}
            >
              {step.title}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Connect Accounts */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className={cn(connections.shortcut && 'border-green-500')}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Shortcut</CardTitle>
                      {connections.shortcut ? (
                        <Badge className="bg-green-500">Connected</Badge>
                      ) : (
                        <Badge variant="outline">Not Connected</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {connections.shortcut
                        ? 'Your Shortcut account is connected'
                        : 'Connect to access your Shortcut data'}
                    </p>
                    <Button
                      onClick={() => setConnections((prev) => ({ ...prev, shortcut: !prev.shortcut }))}
                      variant={connections.shortcut ? 'outline' : 'default'}
                    >
                      {connections.shortcut ? 'Disconnect' : 'Connect Shortcut'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className={cn(connections.linear && 'border-green-500')}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Linear</CardTitle>
                      {connections.linear ? (
                        <Badge className="bg-green-500">Connected</Badge>
                      ) : (
                        <Badge variant="outline">Not Connected</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {connections.linear
                        ? 'Your Linear account is connected'
                        : 'Connect to import your data'}
                    </p>
                    <Button
                      onClick={() => setConnections((prev) => ({ ...prev, linear: !prev.linear }))}
                      variant={connections.linear ? 'outline' : 'default'}
                    >
                      {connections.linear ? 'Disconnect' : 'Connect Linear'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 2: Select Mode */}
          {currentStep === 1 && (
            <div className="grid gap-4 md:grid-cols-3">
              {migrationModes.map((mode) => (
                <Card
                  key={mode.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary relative',
                    selectedMode === mode.id && 'border-primary ring-1 ring-primary'
                  )}
                  onClick={() => setSelectedMode(mode.id)}
                >
                  {mode.popular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg">
                      Popular
                    </div>
                  )}
                  <CardHeader>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <mode.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{mode.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {mode.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {mode.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Step 3: Field Mapping */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Entity Mapping</h3>
                <div className="space-y-2">
                  {[
                    { from: 'Stories', to: 'Issues' },
                    { from: 'Epics', to: 'Projects' },
                    { from: 'Iterations', to: 'Cycles' },
                    { from: 'Labels', to: 'Labels' },
                  ].map((mapping) => (
                    <div
                      key={mapping.from}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                    >
                      <span className="flex-1 font-medium">{mapping.from}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 font-medium">{mapping.to}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Workflow State Mapping</h3>
                <div className="space-y-2">
                  {[
                    { from: 'Unstarted', to: 'Backlog' },
                    { from: 'Started', to: 'In Progress' },
                    { from: 'Done', to: 'Done' },
                  ].map((mapping) => (
                    <div
                      key={mapping.from}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                    >
                      <span className="flex-1">{mapping.from}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <select className="flex-1 p-2 rounded border bg-background">
                        <option>{mapping.to}</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Options</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span>Include comments</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span>Include attachments</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded" />
                    <span>Dry run (preview only, no changes)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Stories', count: 1234 },
                  { label: 'Epics', count: 45 },
                  { label: 'Comments', count: 5678 },
                  { label: 'Attachments', count: 234 },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">{stat.count.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-yellow-500 bg-yellow-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                      <Circle className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Ready to migrate</h4>
                      <p className="text-sm text-muted-foreground">
                        Review the summary above and click &quot;Start Migration&quot; when ready.
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Migration Progress */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Migration in Progress</h3>
                <p className="text-muted-foreground">
                  Please don&apos;t close this window
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span>45%</span>
                  </div>
                  <Progress value={45} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Teams migrated (3/3)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Labels migrated (24/24)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                    <span>Stories migrating (556/1234)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span>Comments pending</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Complete */}
          {currentStep === 5 && (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Migration Complete!</h3>
              <p className="text-muted-foreground mb-6">
                All your data has been successfully migrated to Linear
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Issues Created', count: 1234 },
                  { label: 'Projects Created', count: 45 },
                  { label: 'Comments Migrated', count: 5678 },
                  { label: 'Attachments Uploaded', count: 234 },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {stat.count.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <Button variant="outline" asChild>
                  <a href="/dashboard">Back to Dashboard</a>
                </Button>
                <Button asChild>
                  <a href="https://linear.app" target="_blank" rel="noopener noreferrer">
                    Open Linear
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      {currentStep < 5 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
            className="gap-2"
          >
            {currentStep === 3 ? 'Start Migration' : currentStep === 4 ? 'View Results' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
