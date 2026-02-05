import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Users,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage your Shortcut to Linear migration
        </p>
      </div>

      {/* Connection Status */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Shortcut</CardTitle>
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              Not Connected
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Shortcut account to start migrating
            </p>
            <Button size="sm">Connect Shortcut</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Linear</CardTitle>
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              Not Connected
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Linear account as the migration target
            </p>
            <Button size="sm">Connect Linear</Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <h2 className="text-xl font-semibold mb-4">Get Started</h2>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href="/migrate?mode=one-shot">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">One-Shot Migration</CardTitle>
              <CardDescription>
                Migrate everything at once
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="gap-2 p-0">
                Start Migration <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href="/migrate?mode=team-by-team">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Team-by-Team</CardTitle>
              <CardDescription>
                Gradual migration at your pace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="gap-2 p-0">
                Start Migration <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href="/sync">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Real-Time Sync</CardTitle>
              <CardDescription>
                Keep both tools in sync
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="gap-2 p-0">
                Configure Sync <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Migrations */}
      <h2 className="text-xl font-semibold mb-4">Recent Migrations</h2>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No migrations yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start your first migration to see it here
            </p>
            <Button asChild>
              <Link href="/migrate">Start Migration</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
