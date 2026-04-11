'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DownloadLogEntry, DownloadLogRecord } from '@/lib/download-log';
import { logDownload, getHistory, deleteEntry, cleanup } from '@/lib/download-log';

export function useDownloadLog() {
  const [history, setHistory] = useState<DownloadLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const entries = await getHistory();
    setHistory(entries);
  }, []);

  useEffect(() => {
    cleanup(7).then(refresh).finally(() => setLoading(false));
  }, [refresh]);

  const log = useCallback(async (entry: DownloadLogEntry) => {
    await logDownload(entry);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await deleteEntry(id);
    await refresh();
  }, [refresh]);

  return { history, loading, log, remove };
}
