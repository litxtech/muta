import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="kesfet" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="mesaj/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="lobi/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="canli/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pk/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="siralamalar/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ajans/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="host/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/lig" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/savas" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/secim" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="platform/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="duyuru/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="politika/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="guvenlik/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="bildirimler/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sertifikasyon/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="room/[id]"
            options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
