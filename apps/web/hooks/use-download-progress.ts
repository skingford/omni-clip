'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { downloadWithProgress, type DownloadProgress } from '@/lib/download-with-progress';

export type { DownloadProgress };

export interface UseDownloadProgressReturn {
  progress: DownloadProgress | null;
  downloading: boolean;
  download: (url: string, pollProgressUrl?: string) => Promise<Blob>;
  abort: () => void;
}

export function useDownloadProgress(): UseDownloadProgressReturn {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const download = useCallback(async (url: string, pollProgressUrl?: string): Promise<Blob> => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setDownloading(true);
    setProgress(null);

    try {
      const blob = await downloadWithProgress(url, setProgress, controller.signal, pollProgressUrl);
      return blob;
    } finally {
      setDownloading(false);
      controllerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return { progress, downloading, download, abort };
}
