/**
 * Google OAuth via backend proxy.
 *
 * Instead of PKCE from the app (which requires registering the dynamic
 * exp:// redirect URI in Google Cloud Console), the mobile app opens the
 * backend's /api/auth/mobile/login URL in a system browser.
 *
 * Flow:
 *   1. App opens  GET /api/auth/mobile/login  → 302 → Google OAuth
 *   2. Google authenticates user
 *   3. Google redirects to  /api/auth/google/callback?code=...&state=mobile
 *   4. Backend exchanges code, creates JWT, redirects to
 *      transcriptauditor://auth/callback?token=JWT
 *   5. WebBrowser.openAuthSessionAsync detects the scheme and returns the URL
 *   6. App extracts the JWT and saves it
 */

import * as WebBrowser from 'expo-web-browser';

import { UserInfo, api, getApiBaseUrl, saveToken } from './api';

// Required on Android to properly close the browser after auth
WebBrowser.maybeCompleteAuthSession();

const DEEP_LINK_CALLBACK = 'transcriptauditor://auth/callback';

export interface SignInResult {
  token: string;
  user: UserInfo;
}

export async function signInWithGoogle(): Promise<SignInResult> {
  const baseUrl = await getApiBaseUrl();

  const result = await WebBrowser.openAuthSessionAsync(
    `${baseUrl}/api/auth/mobile/login`,
    DEEP_LINK_CALLBACK,
  );

  if (result.type === 'cancel') {
    throw new Error('Sign-in was cancelled.');
  }
  if (result.type !== 'success') {
    throw new Error('Sign-in failed. Please try again.');
  }

  // URL: transcriptauditor://auth/callback?token=<JWT>
  const tokenMatch = result.url.match(/[?&]token=([^&]+)/);
  if (!tokenMatch) {
    throw new Error('Authentication failed: no token received.');
  }

  const token = decodeURIComponent(tokenMatch[1]);
  await saveToken(token);

  // Fetch user profile using the new token
  const { data: user } = await api.get<UserInfo>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  return { token, user };
}
