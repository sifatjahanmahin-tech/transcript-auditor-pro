/**
 * API client for Transcript Auditor backend.
 *
 * - Reads base URL from app.json `extra.apiUrl` (overridable at runtime
 *   via AsyncStorage key `app_api_url` for the Settings screen).
 * - Adds the SecureStore-stored JWT to every outgoing request.
 * - On 401, clears the token and invokes the registered logout callback.
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'audit_pro_token';
export const API_URL_KEY = 'app_api_url';

const DEFAULT_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8000';

let baseUrlOverride: string | null = null;
let logoutCallback: (() => void) | null = null;

export function registerLogoutCallback(cb: () => void): void {
  logoutCallback = cb;
}

export async function getApiBaseUrl(): Promise<string> {
  if (baseUrlOverride) return baseUrlOverride;
  const stored = await AsyncStorage.getItem(API_URL_KEY);
  if (stored && stored.trim().length > 0) {
    baseUrlOverride = stored;
    return stored;
  }
  return DEFAULT_BASE_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  baseUrlOverride = url;
  await AsyncStorage.setItem(API_URL_KEY, url);
  api.defaults.baseURL = url;
}

export const api: AxiosInstance = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 60_000,
});

// Initialize correct base URL on app start
void (async () => {
  const url = await getApiBaseUrl();
  api.defaults.baseURL = url;
})();

// Attach JWT to every request if available
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear stored token and notify the auth context
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      if (logoutCallback) logoutCallback();
    }
    return Promise.reject(error);
  },
);

// ── Token helpers ──

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Types ──

export interface Program {
  id: string;
  name: string;
  total_required_credits: number;
}

export interface CreditRow {
  course_code: string;
  course_name: string;
  grade: string;
  credits: number;
  semester: string;
  status: string;
  counted: boolean;
}

export interface AuditResult {
  id: string;
  input_type: string;
  original_filename: string | null;
  program_name: string;
  total_valid_credits: number;
  cgpa: number;
  on_probation: boolean;
  credit_breakdown: CreditRow[];
  missing_courses: Record<string, string[]>;
  completed_courses: string[];
  waived_courses: string[];
  ocr_confidence: number | null;
  created_at: string;
}

export interface HistoryResponse {
  items: AuditResult[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Stats {
  total_audits: number;
  csv_audits: number;
  image_audits: number;
  average_cgpa: number;
  probation_warnings: number;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  created_at: string;
}

export interface OcrPreview {
  raw_text: string;
  confidence: number;
  parsed_entries: Array<Record<string, unknown>>;
  entry_count: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  database: string;
  ocr_available: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

// ── API calls ──

export async function fetchPrograms(): Promise<Program[]> {
  const { data } = await api.get<{ programs: Program[] }>('/api/programs');
  return data.programs;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/health');
  return data;
}

export async function fetchMe(): Promise<UserInfo> {
  const { data } = await api.get<UserInfo>('/api/auth/me');
  return data;
}

interface FilePart {
  uri: string;
  name: string;
  type: string;
}

function appendFile(form: FormData, part: FilePart): void {
  // React-Native FormData accepts { uri, name, type } shape
  form.append('file', part as unknown as Blob);
}

export async function auditFromCSV(
  file: FilePart,
  programName: string,
  waivedCourses?: string,
): Promise<AuditResult> {
  const form = new FormData();
  appendFile(form, file);
  form.append('program_name', programName);
  if (waivedCourses && waivedCourses.trim().length > 0) {
    form.append('waived_courses', waivedCourses);
  }
  const { data } = await api.post<AuditResult>('/api/audit/csv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function auditFromImage(
  file: FilePart,
  programName: string,
  waivedCourses?: string,
): Promise<AuditResult> {
  const form = new FormData();
  appendFile(form, file);
  form.append('program_name', programName);
  if (waivedCourses && waivedCourses.trim().length > 0) {
    form.append('waived_courses', waivedCourses);
  }
  const { data } = await api.post<AuditResult>('/api/audit/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function ocrPreview(file: FilePart): Promise<OcrPreview> {
  const form = new FormData();
  appendFile(form, file);
  const { data } = await api.post<OcrPreview>('/api/audit/ocr-preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchHistory(page = 1, pageSize = 20): Promise<HistoryResponse> {
  const { data } = await api.get<HistoryResponse>('/api/history', {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function fetchHistoryItem(id: string): Promise<AuditResult> {
  const { data } = await api.get<AuditResult>(`/api/history/${id}`);
  return data;
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await api.delete(`/api/history/${id}`);
}

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>('/api/history/stats/summary');
  return data;
}

/**
 * Friendly error extractor — Axios errors can come from many sources.
 */
export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    if (detail && typeof detail === 'string') return detail;
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
