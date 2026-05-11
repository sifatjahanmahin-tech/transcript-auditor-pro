/**
 * AsyncStorage-based offline support layer.
 *
 * Three storage areas:
 *   - OFFLINE_QUEUE_KEY   — pending uploads waiting for connectivity.
 *   - CACHED_HISTORY_KEY  — last fetched history list for offline browsing.
 *   - PENDING_ANNOTATIONS_KEY — local flags / notes attached to courses.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuditResult, auditFromCSV, auditFromImage } from './api';

export const OFFLINE_QUEUE_KEY = 'offline_upload_queue';
export const CACHED_HISTORY_KEY = 'cached_history';
export const PENDING_ANNOTATIONS_KEY = 'pending_annotations';

export type FlagColor = 'red' | 'yellow' | 'green';

export interface OfflineUpload {
  id: string;                     // local UUID
  fileUri: string;                // local file URI
  fileName: string;
  fileType: string;               // mime type
  programName: string;
  waivedCourses?: string;
  inputType: 'csv' | 'image';     // which endpoint to hit
  createdAt: string;              // ISO timestamp
}

export interface Annotation {
  auditId: string;
  courseCode: string;
  note: string;
  flagColor: FlagColor;
  createdAt: string;
}

// ── Generic helpers ──

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ── Offline upload queue ──

export async function saveToOfflineQueue(item: OfflineUpload): Promise<void> {
  const queue = await getOfflineQueue();
  queue.push(item);
  await writeJson(OFFLINE_QUEUE_KEY, queue);
}

export async function getOfflineQueue(): Promise<OfflineUpload[]> {
  return readJson<OfflineUpload[]>(OFFLINE_QUEUE_KEY, []);
}

export async function removeFromOfflineQueue(id: string): Promise<void> {
  const queue = await getOfflineQueue();
  const next = queue.filter((item) => item.id !== id);
  await writeJson(OFFLINE_QUEUE_KEY, next);
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ── Cached history ──

export async function cacheHistory(items: AuditResult[]): Promise<void> {
  await writeJson(CACHED_HISTORY_KEY, items);
}

export async function getCachedHistory(): Promise<AuditResult[]> {
  return readJson<AuditResult[]>(CACHED_HISTORY_KEY, []);
}

export async function clearCachedHistory(): Promise<void> {
  await AsyncStorage.removeItem(CACHED_HISTORY_KEY);
}

// ── Annotations ──

export async function saveAnnotation(
  auditId: string,
  courseCode: string,
  note: string,
  flagColor: FlagColor,
): Promise<void> {
  const all = await readJson<Annotation[]>(PENDING_ANNOTATIONS_KEY, []);
  // Replace any existing annotation for this (auditId, courseCode)
  const filtered = all.filter(
    (a) => !(a.auditId === auditId && a.courseCode === courseCode),
  );
  filtered.push({
    auditId,
    courseCode,
    note,
    flagColor,
    createdAt: new Date().toISOString(),
  });
  await writeJson(PENDING_ANNOTATIONS_KEY, filtered);
}

export async function getAnnotations(auditId: string): Promise<Annotation[]> {
  const all = await readJson<Annotation[]>(PENDING_ANNOTATIONS_KEY, []);
  return all.filter((a) => a.auditId === auditId);
}

export async function getAnnotationFor(
  auditId: string,
  courseCode: string,
): Promise<Annotation | null> {
  const all = await readJson<Annotation[]>(PENDING_ANNOTATIONS_KEY, []);
  return all.find((a) => a.auditId === auditId && a.courseCode === courseCode) ?? null;
}

export async function deleteAnnotation(
  auditId: string,
  courseCode: string,
): Promise<void> {
  const all = await readJson<Annotation[]>(PENDING_ANNOTATIONS_KEY, []);
  const next = all.filter(
    (a) => !(a.auditId === auditId && a.courseCode === courseCode),
  );
  await writeJson(PENDING_ANNOTATIONS_KEY, next);
}

// ── Sync ──

export interface SyncResult {
  synced: number;
  failed: number;
  results: AuditResult[];
  errors: Array<{ id: string; message: string }>;
}

/**
 * Try to upload all queued items.  Successful items are removed.
 * Failed items remain queued for the next sync attempt.
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  const queue = await getOfflineQueue();
  const result: SyncResult = { synced: 0, failed: 0, results: [], errors: [] };

  for (const item of queue) {
    try {
      const filePart = {
        uri: item.fileUri,
        name: item.fileName,
        type: item.fileType,
      };
      const audit =
        item.inputType === 'csv'
          ? await auditFromCSV(filePart, item.programName, item.waivedCourses)
          : await auditFromImage(filePart, item.programName, item.waivedCourses);
      result.results.push(audit);
      result.synced += 1;
      await removeFromOfflineQueue(item.id);
    } catch (err) {
      result.failed += 1;
      const message = err instanceof Error ? err.message : 'Unknown sync error';
      result.errors.push({ id: item.id, message });
    }
  }

  return result;
}
