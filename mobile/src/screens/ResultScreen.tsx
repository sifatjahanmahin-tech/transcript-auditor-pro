/**
 * ResultScreen — three-tab view of an audit (Summary / Missing / Breakdown).
 *
 * Receives the AuditResult through navigation params.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { CreditRow } from '@/lib/api';
import IssueFlag from '@/components/IssueFlag';
import { RootStackParamList } from '@/navigation/AppNavigator';

type ResultRoute = RouteProp<RootStackParamList, 'Result'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type TabKey = 'summary' | 'missing' | 'breakdown';

function gradeColor(
  grade: string,
  colors: { success: string; warning: string; error: string; textMuted: string },
): string {
  const g = grade.trim().toUpperCase();
  if (['A', 'A+', 'A-'].includes(g)) return colors.success;
  if (['B+', 'B', 'B-'].includes(g)) return colors.success;
  if (['C+', 'C', 'C-'].includes(g)) return colors.warning;
  if (['D+', 'D', 'D-'].includes(g)) return colors.warning;
  if (['F', 'I'].includes(g)) return colors.error;
  return colors.textMuted;
}

function cgpaColor(
  cgpa: number,
  colors: { success: string; warning: string; error: string },
): string {
  if (cgpa >= 3) return colors.success;
  if (cgpa >= 2) return colors.warning;
  return colors.error;
}

export default function ResultScreen(): JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ResultRoute>();
  const { result } = route.params;

  const [tab, setTab] = useState<TabKey>('summary');
  const [probationDismissed, setProbationDismissed] = useState<boolean>(false);

  const totalMissing = useMemo(
    () =>
      Object.values(result.missing_courses ?? {}).reduce(
        (acc, arr) => acc + arr.length,
        0,
      ),
    [result.missing_courses],
  );

  const cgpaC = cgpaColor(result.cgpa, colors);

  async function handleShare(): Promise<void> {
    try {
      const message =
        `Audit Report — ${result.program_name}\n` +
        `CGPA: ${result.cgpa.toFixed(2)} • Credits: ${result.total_valid_credits}\n` +
        `Missing: ${totalMissing} • ${result.on_probation ? 'On probation' : 'In good standing'}`;
      await Share.share({ message, title: 'Audit Result' });
    } catch (err) {
      Alert.alert('Share failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {result.program_name}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {new Date(result.created_at).toLocaleDateString()} •{' '}
            <Text style={{ fontWeight: '700' }}>{result.input_type.toUpperCase()}</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare} hitSlop={10} style={{ marginRight: 12 }}>
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Report', { result })}
          hitSlop={10}
        >
          <Ionicons name="document-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statValue, { color: colors.text }]}>
            {result.total_valid_credits.toFixed(1)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Credits</Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statValue, { color: cgpaC }]}>
            {result.cgpa.toFixed(2)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>CGPA</Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.statValue,
              { color: totalMissing > 0 ? colors.error : colors.success },
            ]}
          >
            {totalMissing}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Missing</Text>
        </View>
      </View>

      {/* Probation banner */}
      {result.on_probation && !probationDismissed ? (
        <View
          style={[
            styles.probationBanner,
            { backgroundColor: `${colors.error}22`, borderColor: colors.error },
          ]}
        >
          <Ionicons name="warning" size={18} color={colors.error} />
          <Text style={[styles.probationText, { color: colors.error }]}>
            Academic probation: CGPA below threshold.
          </Text>
          <TouchableOpacity
            onPress={() => setProbationDismissed(true)}
            hitSlop={10}
          >
            <Ionicons name="close" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(['summary', 'missing', 'breakdown'] as TabKey[]).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[
                styles.tab,
                active && { backgroundColor: colors.accent },
              ]}
              onPress={() => setTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? '#fff' : colors.textMuted },
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {tab === 'summary' ? (
          <SummaryTab result={result} colors={colors} totalMissing={totalMissing} />
        ) : null}
        {tab === 'missing' ? (
          <MissingTab result={result} colors={colors} totalMissing={totalMissing} />
        ) : null}
        {tab === 'breakdown' ? (
          <BreakdownTab
            rows={result.credit_breakdown}
            auditId={result.id}
            colors={colors}
          />
        ) : null}

        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate('Report', { result })}
        >
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.exportBtnText}>Export report</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryTab({
  result,
  colors,
  totalMissing,
}: {
  result: RouteProp<RootStackParamList, 'Result'>['params']['result'];
  colors: ReturnType<typeof useTheme>['colors'];
  totalMissing: number;
}): JSX.Element {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Program', value: result.program_name },
    { label: 'Input type', value: result.input_type.toUpperCase() },
    { label: 'Original file', value: result.original_filename ?? '—' },
    { label: 'Total courses', value: String(result.credit_breakdown.length) },
    { label: 'Completed courses', value: String(result.completed_courses.length) },
    { label: 'Waived courses', value: String(result.waived_courses.length) },
    { label: 'Missing requirements', value: String(totalMissing) },
    {
      label: 'OCR confidence',
      value:
        result.ocr_confidence !== null
          ? `${(result.ocr_confidence * 100).toFixed(0)}%`
          : '—',
    },
    { label: 'Created at', value: new Date(result.created_at).toLocaleString() },
  ];

  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={[
            styles.summaryRow,
            i < rows.length - 1 && {
              borderBottomColor: colors.border,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{r.label}</Text>
          <Text
            style={[styles.summaryValue, { color: colors.text }]}
            numberOfLines={2}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MissingTab({
  result,
  colors,
  totalMissing,
}: {
  result: RouteProp<RootStackParamList, 'Result'>['params']['result'];
  colors: ReturnType<typeof useTheme>['colors'];
  totalMissing: number;
}): JSX.Element {
  if (totalMissing === 0) {
    return (
      <View style={styles.allGoodWrap}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
        <Text style={[styles.allGoodTitle, { color: colors.success }]}>
          All requirements met!
        </Text>
        <Text style={[styles.allGoodText, { color: colors.textMuted }]}>
          You have completed every required course for this program.
        </Text>
      </View>
    );
  }

  const groups = Object.entries(result.missing_courses).filter(
    ([, codes]) => codes.length > 0,
  );

  return (
    <View>
      {groups.map(([category, codes]) => (
        <View
          key={category}
          style={[
            styles.missingGroup,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.missingCategory, { color: colors.text }]}>
            {category} ({codes.length})
          </Text>
          {codes.map((code) => (
            <View
              key={code}
              style={[
                styles.missingRow,
                { borderTopColor: colors.border },
              ]}
            >
              <Text style={[styles.missingCode, { color: colors.text }]}>{code}</Text>
              <View style={[styles.missingBadge, { backgroundColor: `${colors.error}22` }]}>
                <Text style={[styles.missingBadgeText, { color: colors.error }]}>
                  MISSING
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function BreakdownTab({
  rows,
  auditId,
  colors,
}: {
  rows: CreditRow[];
  auditId: string;
  colors: ReturnType<typeof useTheme>['colors'];
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <View style={styles.allGoodWrap}>
        <Ionicons name="document-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.allGoodText, { color: colors.textMuted }]}>
          No course rows in this audit.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.breakdownCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {rows.map((row, i) => {
        const gColor = gradeColor(row.grade, colors);
        const dimmed = !row.counted;
        return (
          <View
            key={`${row.course_code}-${i}`}
            style={[
              styles.breakdownRow,
              { borderTopColor: colors.border },
              i === 0 && { borderTopWidth: 0 },
              dimmed && styles.breakdownDim,
            ]}
          >
            <View style={styles.breakdownLeft}>
              <Text
                style={[
                  styles.breakdownCode,
                  { color: dimmed ? colors.textMuted : colors.text },
                  dimmed && styles.strike,
                ]}
              >
                {row.course_code}
              </Text>
              <Text
                style={[styles.breakdownName, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {row.course_name || '—'}
              </Text>
              <Text style={[styles.breakdownSemester, { color: colors.textMuted }]}>
                {row.semester} • {row.status}
              </Text>
            </View>

            <View style={styles.breakdownRight}>
              <View style={[styles.gradeChip, { backgroundColor: `${gColor}22` }]}>
                <Text style={[styles.gradeText, { color: gColor }]}>
                  {row.grade || '—'}
                </Text>
              </View>
              <Text style={[styles.breakdownCredits, { color: colors.textMuted }]}>
                {row.credits.toFixed(1)} cr
              </Text>
              <IssueFlag auditId={auditId} courseCode={row.course_code} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  probationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  probationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  body: { padding: 16 },
  summaryCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  summaryLabel: { fontSize: 13 },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  allGoodWrap: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
    gap: 10,
  },
  allGoodTitle: { fontSize: 18, fontWeight: '700' },
  allGoodText: { fontSize: 13, textAlign: 'center' },
  missingGroup: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  missingCategory: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  missingCode: { fontSize: 14, fontWeight: '600' },
  missingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  missingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  breakdownCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  breakdownDim: { opacity: 0.55 },
  strike: { textDecorationLine: 'line-through' },
  breakdownLeft: { flex: 1, marginRight: 8 },
  breakdownCode: { fontSize: 13, fontWeight: '700' },
  breakdownName: { fontSize: 12, marginTop: 2 },
  breakdownSemester: { fontSize: 11, marginTop: 2 },
  breakdownRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  gradeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  gradeText: { fontSize: 12, fontWeight: '700' },
  breakdownCredits: { fontSize: 11 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  exportBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
