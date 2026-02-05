'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Play,
  Pause,
  Settings,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SyncDirection = 'bidirectional' | 'shortcut-to-linear' | 'linear-to-shortcut';

interface SyncLog {
  id: string;
  type: 'success' | 'info' | 'warning';
  message: string;
  timestamp: string;
}

export default function SyncPage() {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncDirection, setSyncDirection] = useState<SyncDirection>('bidirectional');
  const [syncLogs] = useState<SyncLog[]>([
    { id: '1', type: 'success', message: 'Story "Fix login bug" synced to Linear', timestamp: '2 min ago' },
    { id: '2', type: 'info', message: 'Comment added to issue LIN-123', timestamp: '5 min ago' },
    { id: '3', type: 'success', message: 'Story "Add dark mode" synced to Linear', timestamp: '10 min ago' },
    { id: '4', type: 'warning', message: 'Label "urgent" not found in Linear, skipped', timestamp: '15 min ago' },
  ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Real-Time Sync</h1>
        <p className="text-muted-foreground mt-1">
          Keep Shortcut and Linear synchronized in real-time
        </p>
      </div>

      {/* Sync Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync Status</CardTitle>
              <CardDescription>
                {syncEnabled
                  ? 'Your workspaces are being synchronized in real-time'
                  : 'Enable sync to keep your workspaces in sync'}
              </CardDescription>
            </div>
            <Badge
              variant={syncEnabled ? 'default' : 'secondary'}
              className={cn(syncEnabled && 'bg-green-500')}
            >
              {syncEnabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8 py-6">
            <div className="text-center">
              <div className="h-16 w-16 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-orange-500">SC</span>
              </div>
              <span className="text-sm font-medium">Shortcut</span>
              <p className="text-xs text-muted-foreground">My Workspace</p>
            </div>

            <div className="flex flex-col items-center gap-2">
              {syncEnabled ? (
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {syncDirection === 'bidirectional'
                  ? 'Bidirectional'
                  : syncDirection === 'shortcut-to-linear'
                  ? 'One-way →'
                  : '← One-way'}
              </span>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-indigo-500">LN</span>
              </div>
              <span className="text-sm font-medium">Linear</span>
              <p className="text-xs text-muted-foreground">My Team</p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              onClick={() => setSyncEnabled(!syncEnabled)}
              className={cn(
                'gap-2',
                syncEnabled
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              )}
            >
              {syncEnabled ? (
                <>
                  <Pause className="h-4 w-4" /> Stop Sync
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Start Sync
                </>
              )}
            </Button>
            <Button variant="outline" size="lg" className="gap-2">
              <Settings className="h-4 w-4" /> Configure
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sync Direction */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Direction</CardTitle>
            <CardDescription>
              Choose how data flows between your tools
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                syncDirection === 'bidirectional' && 'border-primary bg-primary/5'
              )}
            >
              <input
                type="radio"
                name="direction"
                checked={syncDirection === 'bidirectional'}
                onChange={() => setSyncDirection('bidirectional')}
                className="accent-primary"
              />
              <ArrowLeftRight className="h-4 w-4" />
              <div>
                <div className="font-medium">Bidirectional</div>
                <div className="text-xs text-muted-foreground">
                  Changes sync both ways
                </div>
              </div>
            </label>

            <label
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                syncDirection === 'shortcut-to-linear' && 'border-primary bg-primary/5'
              )}
            >
              <input
                type="radio"
                name="direction"
                checked={syncDirection === 'shortcut-to-linear'}
                onChange={() => setSyncDirection('shortcut-to-linear')}
                className="accent-primary"
              />
              <ArrowRight className="h-4 w-4" />
              <div>
                <div className="font-medium">Shortcut → Linear</div>
                <div className="text-xs text-muted-foreground">
                  One-way sync to Linear
                </div>
              </div>
            </label>

            <label
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                syncDirection === 'linear-to-shortcut' && 'border-primary bg-primary/5'
              )}
            >
              <input
                type="radio"
                name="direction"
                checked={syncDirection === 'linear-to-shortcut'}
                onChange={() => setSyncDirection('linear-to-shortcut')}
                className="accent-primary"
              />
              <ArrowLeft className="h-4 w-4" />
              <div>
                <div className="font-medium">Linear → Shortcut</div>
                <div className="text-xs text-muted-foreground">
                  One-way sync to Shortcut
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Sync Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statistics</CardTitle>
            <CardDescription>
              Sync activity for the last 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">156</div>
                <div className="text-sm text-muted-foreground">Items Synced</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">2</div>
                <div className="text-sm text-muted-foreground">Conflicts</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">98%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">&lt;1s</div>
                <div className="text-sm text-muted-foreground">Avg Latency</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Logs */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest sync events</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
              >
                {log.type === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                )}
                {log.type === 'info' && (
                  <Clock className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                )}
                {log.type === 'warning' && (
                  <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{log.message}</p>
                  <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
