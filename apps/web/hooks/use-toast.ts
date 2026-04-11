'use client';

import { useState, useCallback } from 'react';
import type { ToastItem, ToastType } from '@/components/ui/Toast';

let nextId = 0;

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setItems((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { items, show, dismiss };
}
