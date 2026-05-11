/**
 * SettingsScreen — account, server, theme, offline, about.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  HealthResponse,
  extractApiError,
  fetchHealth,
  getApiBaseUrl,
  setApiBaseUrl,
} from '@/lib/api';
import {
  clearCachedHistory,
  clearOfflineQueue,
  getOfflineQueue,
  syncOfflineQueue,
} from '@/lib/offline';

export default function SettingsScreen(): React.ReactElement {
  const { colors, theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const [apiUrl, setApiUrlState] = useState<string>('');
  const [savingUrl, setSavingUrl] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  const refreshPending = useCallback(async () => {
    const q = await getOfflineQueue();
    setPendingCount(q.length);
  }, []);

  useEffect(() => {
    (async () => {
      const url = await getApiBaseUrl();
      setApiUrlState(url);
      await refreshPending();
    })();
  }, [refreshPending]);

  useFocusEffect(
    useCallback(() => {
      void refreshPending();
    }, [refreshPending]),
  );

  async function handleSaveUrl(): Promise<void> {
    if (!apiUrl.startsWith('http')) {
      Alert.alert('Invalid URL', 'API URL should start with http:// or https://');
      return;
    }
    setSavingUrl(true);
    try {
      await setApiBaseUrl(apiUrl.trim());
      Alert.alert('Saved', 'API URL updated. Existing requests use the new server.');
    } finally {
      setSavingUrl(false);
    }
  }

  async function handleTestConnection(): Promise<void> {
    setTesting(true);
    setHealthError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setHealthError(extractApiError(err, 'Connection failed'));
    } finally {
      setTesting(false);
    }
  }

  async function handleSync(): Promise<void> {
    setSyncing(true);
    try {
      const result = await syncOfflineQueue();
      await refreshPending();
      Alert.alert(
        'Sync complete',
        `Uploaded ${result.synced} item(s). ${result.failed} failed.`,
      );
    } catch (err) {
      Alert.alert('Sync failed', extractApiError(err, 'Could not sync'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearQueue(): Promise<void> {
    Alert.alert(
      'Clear offline queue',
      'Discard all pending uploads?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearOfflineQueue();
            await refreshPending();
          },
        },
      ],
    );
  }

  async function handleClearCache(): Promise<void> {
    Alert.alert(
      'Clear cached history',
      'Remove the offline copy of your history list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await clearCachedHistory();
            Alert.alert('Done', 'Cached history was cleared.');
          },
        },
      ],
    );
  }

  function handleSignOut(): void {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ],
    );
  }

  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();
  const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.text }]}>Settings</Text>

        {/* Account */}
        <Section title="Account" colors={colors}>
          <View
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>
                {user?.name ?? 'Signed-in user'}
              </Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                {user?.email ?? '—'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.danger,
              { borderColor: colors.error, backgroundColor: `${colors.error}11` },
            ]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={[styles.dangerText, { color: colors.error }]}>Sign out</Text>
          </TouchableOpacity>
        </Section>

        {/* Server */}
        <Section title="Server" colors={colors}>
          <Text style={[styles.label, { color: colors.textMuted }]}>API URL</Text>
          <TextInput
            value={apiUrl}
            onChangeText={setApiUrlState}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://api.example.com"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          />
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.accent, flex: 1 }]}
              onPress={handleSaveUrl}
              disabled={savingUrl}
            >
              {savingUrl ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Save URL</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  flex: 1,
                },
              ]}
              onPress={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.btnText, { color: colors.text }]}>Test connection</Text>
              )}
            </TouchableOpacity>
          </View>

          {health ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${colors.success}22`, borderColor: colors.success },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.statusText, { color: colors.success }]}>
                {health.status} • v{health.version} • db: {health.database} • OCR:{' '}
                {health.ocr_available ? 'on' : 'off'}
              </Text>
            </View>
          ) : null}
          {healthError ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${colors.error}22`, borderColor: colors.error },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.statusText, { color: colors.error }]}>
                {healthError}
              </Text>
            </View>
          ) : null}
        </Section>

        {/* Appearance */}
        <Section title="Appearance" colors={colors}>
          <View
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={theme === 'dark' ? 'moon' : 'sunny'}
              size={22}
              color={colors.accent}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                Tap the switch to flip themes.
              </Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={() => void toggleTheme()}
              thumbColor="#fff"
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </Section>

        {/* Offline */}
        <Section title="Offline" colors={colors}>
          <TouchableOpacity
            style={[
              styles.btn,
              {
                backgroundColor: pendingCount > 0 ? colors.warning : colors.card,
                borderColor: colors.border,
                borderWidth: pendingCount > 0 ? 0 : 1,
              },
            ]}
            onPress={handleSync}
            disabled={syncing || pendingCount === 0}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={[
                  styles.btnText,
                  { color: pendingCount > 0 ? '#fff' : colors.text },
                ]}
              >
                Sync pending ({pendingCount})
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                marginTop: 8,
              },
            ]}
            onPress={handleClearCache}
          >
            <Text style={[styles.btnText, { color: colors.text }]}>
              Clear cached history
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.danger,
              {
                borderColor: colors.error,
                backgroundColor: `${colors.error}11`,
                marginTop: 8,
              },
            ]}
            onPress={handleClearQueue}
            disabled={pendingCount === 0}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.dangerText, { color: colors.error }]}>
              Clear offline queue
            </Text>
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section title="About" colors={colors}>
          <View
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="information-circle-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>Transcript Auditor</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                Version {appVersion}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.btn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                marginTop: 8,
              },
            ]}
            onPress={() => Linking.openURL('https://github.com/sifatjahanmahin-tech/transcript-auditor-pro').catch(() => undefined)}
          >
            <Text style={[styles.btnText, { color: colors.text }]}>View on GitHub</Text>
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  heading: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  name: { fontSize: 14, fontWeight: '600' },
  muted: { fontSize: 12, marginTop: 2 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  dangerText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
