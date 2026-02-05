'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { getState, setState } from '@/lib/db';
import Link from 'next/link';

export default function SetupPage() {
  const [shortcutToken, setShortcutToken] = useState('');
  const [linearToken, setLinearToken] = useState('');
  const [showShortcut, setShowShortcut] = useState(false);
  const [showLinear, setShowLinear] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const state = getState();
    if (state.shortcutToken) setShortcutToken(state.shortcutToken);
    if (state.linearToken) setLinearToken(state.linearToken);
  }, []);

  const handleSave = () => {
    setState({ shortcutToken, linearToken });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isComplete = shortcutToken.length > 0 && linearToken.length > 0;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Setup</h1>
        <p className="text-muted-foreground mt-1">
          Enter your API tokens to get started
        </p>
      </div>

      <div className="space-y-6">
        {/* Shortcut Token */}
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
                <Badge className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
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
                onChange={(e) => setShortcutToken(e.target.value)}
                placeholder="Paste your Shortcut API token"
                className="w-full px-3 py-2 border rounded-md bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowShortcut(!showShortcut)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showShortcut ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

        {/* Linear Token */}
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
                <Badge className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
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
                onChange={(e) => setLinearToken(e.target.value)}
                placeholder="Paste your Linear API key"
                className="w-full px-3 py-2 border rounded-md bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowLinear(!showLinear)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showLinear ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={!shortcutToken && !linearToken}>
            {saved ? 'Saved!' : 'Save Tokens'}
          </Button>
          {isComplete && (
            <Button asChild variant="outline">
              <Link href="/migrate">
                Continue to Migration
              </Link>
            </Button>
          )}
        </div>

        {/* Info */}
        <p className="text-sm text-muted-foreground">
          Your tokens are stored locally in your browser. They are never sent to any server.
        </p>
      </div>
    </div>
  );
}
