/**
 * OfflineBanner — shows an amber bar when network is unavailable.
 *
 * Polls connectivity on a 5-second interval (and on mount) using
 * expo-network so we don't depend on a separate listener library.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';

interface OfflineBannerProps {
  message?: string;
  onConnectivityChange?: (online: boolean) => void;
}

export default function OfflineBanner({
  message,
  onConnectivityChange,
}: OfflineBannerProps): JSX.Element | null {
  const { colors } = useTheme();
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function check(): Promise<void> {
      try {
        const state = await Network.getNetworkStateAsync();
        const isOnline =
          state.isConnected !== false && state.isInternetReachable !== false;
        if (mounted) {
          setOnline(isOnline);
          if (onConnectivityChange) onConnectivityChange(isOnline);
        }
      } catch {
        if (mounted) setOnline(true); // assume online on error
      }
    }
    void check();
    const id = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [onConnectivityChange]);

  if (online) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.warning }]}>
      <Ionicons name="cloud-offline" size={16} color="#fff" />
      <Text style={styles.text}>
        {message ?? "You're offline. Changes will sync when connected."}
      </Text>
    </View>
  );
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean>(true);
  useEffect(() => {
    let mounted = true;
    async function check(): Promise<void> {
      try {
        const state = await Network.getNetworkStateAsync();
        const isOnline =
          state.isConnected !== false && state.isInternetReachable !== false;
        if (mounted) setOnline(isOnline);
      } catch {
        if (mounted) setOnline(true);
      }
    }
    void check();
    const id = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);
  return online;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
