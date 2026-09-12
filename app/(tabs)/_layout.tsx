import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';

/**
 * Ana sekmeler (plan): Home · Rooms · Create · Messages · Profile
 * Cuzdan Profile altindan / ayri route ile erisilir.
 */
export default function TabsLayout() {
  return (
    <ModulHataSiniri modulAdi="ana-navigasyon">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#16121F',
            borderTopColor: RenkTokenlari.border,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: RenkTokenlari.primarySoft,
          tabBarInactiveTintColor: RenkTokenlari.textDim,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="rooms"
          options={{
            title: 'Rooms',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="radio" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="cihazlar"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </ModulHataSiniri>
  );
}
