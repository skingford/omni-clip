import { existsSync } from 'node:fs';
import { join } from 'node:path';

const UNSAFE_CHARS = /[/\\:*?"<>|]/g;

export function sanitizeFilename(name: string): string {
  return name.replace(UNSAFE_CHARS, '_').replace(/\s+/g, ' ').trim();
}

export function generateVideoFilename(author: string, title: string): string {
  const safeName = sanitizeFilename(`${author}-${title}`);
  return `${safeName}.mp4`;
}

export function resolveUniqueFilePath(dir: string, filename: string): string {
  let filePath = join(dir, filename);
  if (!existsSync(filePath)) return filePath;

  const ext = '.mp4';
  const base = filename.slice(0, -ext.length);
  let counter = 1;
  while (existsSync(filePath)) {
    filePath = join(dir, `${base}_${counter}${ext}`);
    counter++;
  }
  return filePath;
}
