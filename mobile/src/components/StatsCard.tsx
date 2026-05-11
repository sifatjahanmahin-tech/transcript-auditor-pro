/**
 * StatsCard — colourful summary tile used in DashboardScreen.
 */

import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface StatsCardProps {
  label: string;
  value: string | number;
  color?: string;
  icon?: IoniconName;
  style?: ViewStyle;
}

export default function StatsCard({
  label,
  value,
  color,
  icon,
  style,
}: StatsCardProps): React.ReactElement {
  const { colors } = useTheme();
  const accent = color ?? colors.accent;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
        style,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
      ) : null}
      <Text style={[styles.value, { color: accent }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 96,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});
