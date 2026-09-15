import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** iOS/Android uygulama ikonu rozeti */
export async function CihazBildirimRozetiniAyarla(sayi: number): Promise<void> {
  const n = Math.max(0, Math.floor(sayi));
  try {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Notifications.setBadgeCountAsync(n);
    }
  } catch {
    // izin / simulator — sessiz
  }
}
