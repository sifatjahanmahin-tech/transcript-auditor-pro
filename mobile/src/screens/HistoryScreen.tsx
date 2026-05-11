/**
 * HistoryScreen — paginated list of past audits with delete + offline cache.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import {
  AuditResult,
  deleteHistoryItem,
  extractApiError,
  fetchHistory,
} from '@/lib/api';
import { cacheHistory, getCachedHistory } from '@/lib/offline';
import OfflineBanner, { useIsOnline } from '@/components/OfflineBanner';
import AuditCard from '@/components/AuditCard';
import { RootStackParamList } from '@/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HistoryScreen(): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const online = useIsOnline();

  const [records, setRecords] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showCached, setShowCached] = useState<boolean>(false);

  const load = useCallback(
    async (p = 1, append = false) => {
      try {
        if (!online) {
          const cached = await getCachedHistory();
          setRecords(cached);
          setTotalPages(1);
          setPage(1);
          setShowCached(true);
          setError(null);
          return;
        }
        const data = await fetchHistory(p, 20);
        setRecords((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotalPages(data.total_pages);
        setPage(p);
        setShowCached(false);
        setError(null);
        if (!append) await cacheHistory(data.items);
      } catch (err) {
        setError(extractApiError(err, 'Failed to load history'));
        if (!append) {
          const cached = await getCachedHistory();
          if (cached.length > 0) {
            setRecords(cached);
            setShowCached(true);
          }
        }
      }
    },
    [online],
  );

  useEffect(() => {
    (async () => {
      await load(1);
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(1);
    }, [load]),
  );

  async function onRefresh(): Promise<void> {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  }

  async function loadMore(): Promise<void> {
    if (loadingMore) return;
    if (page >= totalPages) return;
    setLoadingMore(true);
    await load(page + 1, true);
    setLoadingMore(false);
  }

  function handleDelete(item: AuditResult): void {
    Alert.alert(
      'Delete audit',
      `Delete the audit for "${item.program_name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHistoryItem(item.id);
              setRecords((prev) => prev.filter((r) => r.id !== item.id));
            } catch (err) {
              Alert.alert('Failed', extractApiError(err, 'Could not delete record'));
            }
          },
        },
      ],
    );
  }

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
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>History</Text>
        {showCached ? (
          <View style={[styles.cachedBadge, { backgroundColor: `${colors.warning}22` }]}>
            <Ionicons name="cloud-offline" size={12} color={colors.warning} />
            <Text style={[styles.cachedText, { color: colors.warning }]}>cached</Text>
          </View>
        ) : null}
      </View>

      {error && records.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.accent }]}
            onPress={() => load(1)}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No audits yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Upload your transcript from the Upload tab to see it here.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <AuditCard
              audit={item}
              onPress={() => navigation.navigate('Result', { result: item })}
              onLongPress={() => handleDelete(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  heading: { fontSize: 24, fontWeight: '800' },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cachedText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  list: { padding: 16, paddingTop: 8 },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
