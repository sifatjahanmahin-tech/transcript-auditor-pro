/**
 * Google OAuth via backend proxy.
 *
 * Instead of PKCE from the app (which requires registering the dynamic
 * exp:// redirect URI in Google Cloud Console), the mobile app opens the
 * backend's /api/auth/mobile/login URL in a system browser.
 *
 * Flow:
 *   1. App opens  GET /api/auth/mobile/login?callback_url=<encoded>  → 302 → Google OAuth
 *   2. Google authenticates user
 *   3. Google redirects to  /api/auth/google/callback?code=...&state=<encoded>
 *   4. Backend exchanges code, creates JWT, redirects to <callback_url>?token=JWT
 *   5. WebBrowser.openAuthSessionAsync detects the scheme and returns the URL
 *   6. App extracts the JWT and saves it
 *
 * The callback_url is resolved at runtime via Linking.createURL:
 *   - Expo Go dev build  → exp://192.168.x.x:8081/--/auth/callback
 *   - Production build   → transcriptauditor://auth/callback
 * This ensures the deep-link is intercepted correctly in both environments.
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { UserInfo, api, getApiBaseUrl, saveToken } from './api';

// Required on Android to properly close the browser after auth
WebBrowser.maybeCompleteAuthSession();

export interface SignInResult {
  token: string;
  user: UserInfo;
}

export async function signInWithGoogle(): Promise<SignInResult> {
  const baseUrl = await getApiBaseUrl();

  // Expo Go  → exp://192.168.x.x:8081/--/auth/callback
  // Native   → transcriptauditor://auth/callback
  const callbackUrl = Linking.createURL('/auth/callback');

  const loginUrl =
    `${baseUrl}/api/auth/mobile/login` +
    `?callback_url=${encodeURIComponent(callbackUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(loginUrl, callbackUrl);

  if (result.type === 'cancel') {
    throw new Error('Sign-in was cancelled.');
  }
  if (result.type !== 'success') {
    throw new Error('Sign-in failed. Please try again.');
  }

  // URL: <callbackUrl>?token=<JWT>
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
