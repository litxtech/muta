import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type WebAlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type WebAlertDurum = {
  id: number;
  title: string;
  message: string;
  buttons: WebAlertButton[];
};

const dinleyiciler = new Set<(a: WebAlertDurum | null) => void>();

/**
 * Aynı anda birden çok onay istenirse (ör. bir onayın içinde hata mesajı)
 * önceki mesaj kaybolmasın diye sıraya alınır.
 */
const kuyruk: WebAlertDurum[] = [];
let aktif: WebAlertDurum | null = null;
let sira = 0;
let kuruldu = false;

function yayinla(durum: WebAlertDurum | null): void {
  dinleyiciler.forEach((fn) => fn(durum));
}

function siradakiniAc(): void {
  if (aktif || kuyruk.length === 0) return;
  aktif = kuyruk.shift() ?? null;
  yayinla(aktif);
}

/**
 * react-native-web'de `Alert.alert` boş bir fonksiyondur: panelde onay isteyen
 * her düğme (coin eksilt, sil, onayla, yayınla…) sessizce hiçbir şey yapmıyor
 * görünür. Bu yama `Alert.alert`'i gerçek bir onay kartına bağlar.
 *
 * Kurulum modül yüklenirken kendiliğinden yapılır; böylece uygulama kök
 * yerleşiminde ayrıca çağırmayı unutmak mümkün değildir.
 */
export function WebAlertKur(): void {
  if (Platform.OS !== 'web' || kuruldu) return;
  kuruldu = true;
  Alert.alert = (title, message, buttons) => {
    const liste: WebAlertButton[] =
      buttons && buttons.length > 0
        ? [...buttons]
        : [{ text: 'Tamam', style: 'default' }];
    kuyruk.push({
      id: ++sira,
      title: title ?? '',
      message: typeof message === 'string' ? message : '',
      buttons: liste,
    });
    siradakiniAc();
  };
}

/** Görünen kartı kapatır ve sırada bekleyen varsa onu açar. */
function kapat(): void {
  aktif = null;
  yayinla(null);
  siradakiniAc();
}

WebAlertKur();

/** Safari / Chrome — odadan çıkış ve diğer onaylar. */
export function WebAlertKatmani() {
  const [durum, setDurum] = useState<WebAlertDurum | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    dinleyiciler.add(setDurum);
    // Katman sonradan bağlandıysa bekleyen kartı hemen göster.
    if (aktif) setDurum(aktif);
    else siradakiniAc();

    return () => {
      dinleyiciler.delete(setDurum);
      if (dinleyiciler.size === 0) {
        // Kök katman sökülürse yarıda kalan onay yeni ekrana taşınmaz.
        aktif = null;
        kuyruk.length = 0;
      }
    };
  }, []);

  // Esc ile vazgeç (web klavye) — düğmeye basılmış sayılmaz.
  useEffect(() => {
    if (!durum) return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const dinle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        kapat();
      }
    };
    window.addEventListener('keydown', dinle);
    return () => window.removeEventListener('keydown', dinle);
  }, [durum]);

  if (Platform.OS !== 'web' || !durum) return null;

  return (
    <View style={styles.perde} accessibilityViewIsModal accessibilityRole="alert">
      <View style={styles.kart}>
        {durum.title ? <Text style={styles.baslik}>{durum.title}</Text> : null}
        {durum.message ? <Text style={styles.mesaj}>{durum.message}</Text> : null}
        <View style={styles.butonlar}>
          {durum.buttons.map((btn, i) => {
            const destructive = btn.style === 'destructive';
            const cancel = btn.style === 'cancel';
            return (
              <Pressable
                key={`${durum.id}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={btn.text || 'Tamam'}
                onPress={() => {
                  const fn = btn.onPress;
                  kapat();
                  fn?.();
                }}
                style={({ pressed }) => [
                  styles.buton,
                  destructive && styles.butonDestructive,
                  cancel && styles.butonCancel,
                  pressed && styles.butonBasili,
                ]}
              >
                <Text
                  style={[
                    styles.butonYazi,
                    destructive && styles.yaziDestructive,
                    cancel && styles.yaziCancel,
                  ]}
                >
                  {btn.text || 'Tamam'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  perde: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  kart: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#161222',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  baslik: {
    color: '#F7F2E8',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  mesaj: {
    color: 'rgba(247,242,232,0.78)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  butonlar: {
    marginTop: 16,
    gap: 8,
  },
  buton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E84091',
    paddingHorizontal: 12,
  },
  butonBasili: { opacity: 0.85 },
  butonDestructive: {
    backgroundColor: 'rgba(255,59,92,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,92,0.45)',
  },
  butonCancel: {
    backgroundColor: 'transparent',
  },
  butonYazi: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  yaziDestructive: {
    color: '#FF5C7A',
  },
  yaziCancel: {
    color: 'rgba(247,242,232,0.7)',
    fontWeight: '600',
  },
});
