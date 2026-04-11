'use client';

import { useState } from 'react';
import type { AppState } from '@/components/types';

export function useVideoResolver() {
  const [state, setState] = useState<AppState>({ status: 'idle' });

  async function handleResolve(url: string) {
    setState({ status: 'resolving' });
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        try {
          const data = await res.json();
          setState({ status: 'error', message: data.error || `Server error (${res.status})` });
        } catch {
          setState({ status: 'error', message: `Server error (${res.status})` });
        }
        return;
      }

      const data = await res.json();
      if (data.success) {
        setState({
          status: 'resolved',
          video: data.data,
          token: data.token,
          collection: data.collection ?? null,
        });
      } else {
        setState({ status: 'error', message: data.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setState({ status: 'error', message: `Network error: ${msg}` });
    }
  }

  function handleReset() {
    setState({ status: 'idle' });
  }

  return { state, handleResolve, handleReset };
}
