/**
 * AuditCard — compact summary row for Dashboard / History lists.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { AuditResult } from '@/lib/api';

interface AuditCardProps {
  audit: AuditResult;
  onPress: () => void;
  onLongPress?: () => void;
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function cgpaColor(cgpa: number, themeColors: { success: string; warning: string; error: string }): string {
  if (cgpa >= 3.0) return themeColors.success;
  if (cgpa >= 2.0) return themeColors.warning;
  return themeColors.error;
}

function missingCount(missing: Record<string, string[]>): number {
  return Object.values(missing).reduce((sum, list) => sum + list.length, 0);
}

export default function AuditCard({ audit, onPress, onLongPress }: AuditCardProps): React.ReactElement {
  const { colors } = useTheme();
  const cgpaC = cgpaColor(audit.cgpa, colors);
  const missing = missingCount(audit.missing_courses);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
        >
          {audit.program_name}
        </Text>
        <View style={[styles.cgpaChip, { backgroundColor: `${cgpaC}22` }]}>
          <Text style={[styles.cgpaText, { color: cgpaC }]}>
            {audit.cgpa.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
          <Ionicons
            name={audit.input_type === 'csv' ? 'document-text' : 'image'}
            size={12}
            color={colors.accent}
          />
          <Text style={[styles.badgeText, { color: colors.accent }]}>
            {audit.input_type.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {audit.total_valid_credits.toFixed(1)} cr
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>•</Text>
        <Text style={[styles.metaText, { color: missing > 0 ? colors.warning : colors.success }]}>
          {missing > 0 ? `${missing} missing` : 'complete'}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>
          {relativeDate(audit.created_at)}
        </Text>
        {audit.on_probation ? (
          <View style={[styles.probationChip, { backgroundColor: `${colors.error}22` }]}>
            <Ionicons name="warning" size={12} color={colors.error} />
            <Text style={[styles.probationText, { color: colors.error }]}>probation</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 10,
  },
  cgpaChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    minWidth: 50,
    alignItems: 'center',
  },
  cgpaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateText: {
    fontSize: 11,
  },
  probationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  probationText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
