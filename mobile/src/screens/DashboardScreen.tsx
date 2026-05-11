/**
 * DashboardScreen — landing page after sign-in.
 *
 * Pulls /history/stats/summary + last 5 audits, shows offline banner,
 * surfaces a sync button when there are queued offline uploads, and
 * has a floating "Start Audit" button that jumps to the Upload tab.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  AuditResult,
  Stats,
  extractApiError,
  fetchHistory,
  fetchStats,
} from '@/lib/api';
import {
  cacheHistory,
  getCachedHistory,
  getOfflineQueue,
  syncOfflineQueue,
} from '@/lib/offline';
import OfflineBanner, { useIsOnline } from '@/components/OfflineBanner';
import StatsCard from '@/components/StatsCard';
import AuditCard from '@/components/AuditCard';
import { RootStackParamList } from '@/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen(): React.ReactElement {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const online = useIsOnline();

  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  const refreshPending = useCallback(async () => {
    const queue = await getOfflineQueue();
    setPendingCount(queue.length);
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      if (online) {
        const [statsResp, history] = await Promise.all([
          fetchStats(),
          fetchHistory(1, 5),
        ]);
        setStats(statsResp);
        setRecent(history.items);
        await cacheHistory(history.items);
      } else {
        const cached = await getCachedHistory();
        setRecent(cached.slice(0, 5));
      }
    } catch (err) {
      setError(extractApiError(err, 'Could not load dashboard'));
      const cached = await getCachedHistory();
      if (cached.length > 0) setRecent(cached.slice(0, 5));
    } finally {
      await refreshPending();
    }
  }, [online, refreshPending]);

  useEffect(() => {
    (async () => {
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void refreshPending();
    }, [refreshPending]),
  );

  async function onRefresh(): Promise<void> {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleSync(): Promise<void> {
    if (!online) return;
    setSyncing(true);
    try {
      await syncOfflineQueue();
      await loadData();
    } catch (err) {
      setError(extractApiError(err, 'Sync failed'));
    } finally {
      setSyncing(false);
    }
  }

  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <OfflineBanner />
      <FlatList
        data={recent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Greeting */}
            <View style={styles.greetRow}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hello, { color: colors.textMuted }]}>Welcome back,</Text>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {user?.name ?? user?.email ?? 'Student'}
                </Text>
              </View>
            </View>

            {/* Stats cards */}
            <View style={styles.statsRow}>
              <StatsCard
                label="Total audits"
                value={stats?.total_audits ?? 0}
                icon="documents-outline"
              />
              <StatsCard
                label="Avg CGPA"
                value={(stats?.average_cgpa ?? 0).toFixed(2)}
                icon="stats-chart-outline"
                color={
                  (stats?.average_cgpa ?? 0) >= 3
                    ? colors.success
                    : (stats?.average_cgpa ?? 0) >= 2
                    ? colors.warning
                    : colors.error
                }
              />
              <StatsCard
                label="Probation flags"
                value={stats?.probation_warnings ?? 0}
                icon="warning-outline"
                color={
                  (stats?.probation_warnings ?? 0) > 0 ? colors.error : colors.success
                }
              />
            </View>

            {/* Sync banner */}
            {pendingCount > 0 ? (
              <TouchableOpacity
                onPress={handleSync}
                disabled={syncing || !online}
                activeOpacity={0.8}
                style={[
                  styles.syncCard,
                  {
                    backgroundColor: `${colors.warning}22`,
                    borderColor: colors.warning,
                    opacity: !online ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons name="sync-outline" size={18} color={colors.warning} />
                <Text style={[styles.syncText, { color: colors.text }]}>
                  {syncing
                    ? 'Syncing pending uploads...'
                    : `${pendingCount} pending upload${pendingCount > 1 ? 's' : ''}. Tap to sync.`}
                </Text>
                {syncing ? <ActivityIndicator size="small" color={colors.warning} /> : null}
              </TouchableOpacity>
            ) : null}

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

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent audits</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'History' })}>
                <Text style={[styles.linkText, { color: colors.accent }]}>View all</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <AuditCard
            audit={item}
            onPress={() => navigation.navigate('Result', { result: item })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No audits yet
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Upload a transcript to see CGPA, missing courses, and probation status.
            </Text>
          </View>
        }
      />

      {/* Floating Start Audit button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Upload' })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>Start Audit</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 100 },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  hello: { fontSize: 12, fontWeight: '500' },
  name: { fontSize: 18, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  syncText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
