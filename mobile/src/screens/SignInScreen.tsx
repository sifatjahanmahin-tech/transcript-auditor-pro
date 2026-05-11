/**
 * Sign-In screen — Google OAuth via backend proxy flow.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { signInWithGoogle } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { extractApiError } from '@/lib/api';

export default function SignInScreen(): JSX.Element {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePress(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await signInWithGoogle();
      await signIn(token, user);
    } catch (err) {
      setError(extractApiError(err, 'Sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        <View style={styles.logoBlock}>
          <Text style={styles.logoEmoji}>📋</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Transcript{'\n'}Auditor Pro
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            NSU Degree Audit Tool
          </Text>
        </View>

        <View style={styles.actionBlock}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
          ) : (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={handlePress}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </TouchableOpacity>
          )}

          {error ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: `${colors.error}22`,
                  borderColor: colors.error,
                },
              ]}
            >
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.footer, { color: colors.textMuted }]}>
            Sign in with your NSU Google account.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    padding: 32,
    justifyContent: 'space-between',
  },
  logoBlock: {
    alignItems: 'center',
    marginTop: 80,
  },
  logoEmoji: {
    fontSize: 76,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  actionBlock: {
    marginBottom: 40,
  },
  button: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loader: { marginVertical: 24 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    marginTop: 24,
    fontSize: 13,
    textAlign: 'center',
  },
});
