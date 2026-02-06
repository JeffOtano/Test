'use client';

import { useEffect } from 'react';
import { bootstrapSyncEngine } from '@/lib/sync/service';

export function SyncBootstrap(): null {
  useEffect(() => {
    bootstrapSyncEngine();
  }, []);

  return null;
}
