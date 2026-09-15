import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Genel bildirim kanalı */
export const ANDROID_BILDIRIM_KANALI = 'genel';
/** Mesaj / DM — özel 3-ton ses */
export const ANDROID_MESAJ_BILDIRIM_KANALI = 'mesaj';
/** Native sound file (expo-notifications plugin sounds[]) */
export const MESAJ_BILDIRIM_SESI = 'mesaj_uc_ton.wav';

function androidFcmHazirMi(): boolean {
  return Constants.expoConfig?.extra?.androidFcmEnabled === true;
}

async function androidKanallariKur(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_BILDIRIM_KANALI, {
    name: 'Genel',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#E84091',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(ANDROID_MESAJ_BILDIRIM_KANALI, {
    name: 'Mesajlar',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 180, 100, 180, 100, 180],
    lightColor: '#E84091',
    sound: MESAJ_BILDIRIM_SESI,
    enableVibrate: true,
    showBadge: true,
  });
}

async function bildirimIzniAl(): Promise<boolean> {
  await androidKanallariKur();

  if (!Device.isDevice) {
    console.warn('[Push] Fiziksel cihaz gerekli.');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    console.warn('[Push] Bildirim izni yok.');
    return false;
  }
  return true;
}

/**
 * Android: native FCM device token (Firebase).
 * google-services.json + native build gerekir.
 */
export async function AndroidFcmTokeniniAl(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  if (!androidFcmHazirMi()) {
    console.warn(
      '[Push] FCM kapalı — google-services.json ekleyip yeni Android build al.',
    );
    return null;
  }
  if (!(await bildirimIzniAl())) return null;

  try {
    const device = await Notifications.getDevicePushTokenAsync();
    if (device?.type === 'fcm' && typeof device.data === 'string' && device.data) {
      return device.data;
    }
    if (typeof device?.data === 'string' && device.data) {
      return device.data;
    }
    console.warn('[Push] FCM token alınamadı — google-services.json / yeni build gerekli.');
    return null;
  } catch (e) {
    console.warn('[Push] FCM', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Expo Push Token (iOS APNs / Android FCM Expo üzerinden).
 * Android'de asıl kanal FCM native; Expo token yedek / EAS push için.
 */
export async function ExpoPushTokeniniAl(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android' && !androidFcmHazirMi()) {
    console.warn(
      '[Push] Expo token (Android) FCM ister — google-services.json yok.',
    );
    return null;
  }
  if (!(await bildirimIzniAl())) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId || typeof projectId !== 'string') {
    console.warn('[Push] EAS projectId yok.');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data ?? null;
  } catch (e) {
    console.warn('[Push] Expo token', e instanceof Error ? e.message : e);
    return null;
  }
}
