/**
 * AppNavigator — root navigator.
 *
 * - When unauthenticated: stack with SignInScreen.
 * - When authenticated: native-stack containing the bottom-tab navigator
 *   plus modal screens (Result, Report) on top.
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AuditResult } from '@/lib/api';

import SignInScreen from '@/screens/SignInScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import UploadScreen from '@/screens/UploadScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ResultScreen from '@/screens/ResultScreen';
import ReportScreen from '@/screens/ReportScreen';

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  Result: { result: AuditResult };
  Report: { result: AuditResult };
};

export type MainTabsParamList = {
  Dashboard: undefined;
  Upload: undefined;
  History: undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

function MainTabs(): JSX.Element {
  const { colors } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<keyof MainTabsParamList, React.ComponentProps<typeof Ionicons>['name']> = {
            Dashboard: 'home-outline',
            Upload: 'cloud-upload-outline',
            History: 'time-outline',
            Settings: 'settings-outline',
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="Upload" component={UploadScreen} />
      <Tabs.Screen name="History" component={HistoryScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export default function AppNavigator(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, colors } = useTheme();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const navTheme =
    theme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: colors.bg,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            primary: colors.accent,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: colors.bg,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            primary: colors.accent,
          },
        };

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={SignInScreen} />
        ) : (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen
              name="Result"
              component={ResultScreen}
              options={{ presentation: 'card' }}
            />
            <RootStack.Screen
              name="Report"
              component={ReportScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
