'use client';

import { useSyncExternalStore } from 'react';
import {
  AppState,
  getState,
  STORAGE_KEY,
  STORAGE_STATE_CHANGE_EVENT,
} from './db';

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(STORAGE_STATE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(STORAGE_STATE_CHANGE_EVENT, onStoreChange);
  };
}

function getServerSnapshot(): AppState {
  return {};
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getServerSnapshot);
}
