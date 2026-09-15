import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import {
  BelgePdfPaylas,
  BelgeYazdir,
  PdfDosyasiOlustur,
  WhatsAppBelgeGonder,
} from '../BelgePaylasimIslemleri';
import type { BelgeIcerik } from '../BelgeSablonlari';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  visible: boolean;
  onKapat: () => void;
  icerik: BelgeIcerik | null;
  telefon?: string | null;
};

type Aksiyon = {
  key: string;
  label: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  calistir: () => Promise<void>;
};

/** Uygulama geneli: PDF · Yazdır · WhatsApp · Paylaş */
export function BelgePaylasimPaneli({
  visible,
  onKapat,
  icerik,
  telefon,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  if (!icerik) return null;

  const calistir = async (key: string, fn: () => Promise<{ ok: boolean; hata?: string }>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Belge', r.hata ?? 'İşlem başarısız');
      return;
    }
    if (key === 'pdf') {
      Alert.alert('PDF hazır', 'Dosya oluşturuldu.');
    }
    onKapat();
  };

  const aksiyonlar: Aksiyon[] = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      alt: 'PDF veya metin gönder',
      icon: 'logo-whatsapp',
      tint: '#25D366',
      calistir: () =>
        calistir('whatsapp', () => WhatsAppBelgeGonder(icerik, telefon)),
    },
    {
      key: 'pdf',
      label: 'PDF oluştur',
      alt: 'Belgeyi kaydet',
      icon: 'document-text-outline',
      tint: RenkTokenlari.violet,
      calistir: () => calistir('pdf', () => PdfDosyasiOlustur(icerik)),
    },
    {
      key: 'paylas',
      label: 'Paylaş',
      alt: 'PDF olarak paylaş',
      icon: 'share-outline',
      tint: RenkTokenlari.primarySoft,
      calistir: () => calistir('paylas', () => BelgePdfPaylas(icerik)),
    },
    {
      key: 'yazdir',
      label: 'Yazdır',
      alt: 'Yazıcıya gönder',
      icon: 'print-outline',
      tint: RenkTokenlari.accent,
      calistir: () => calistir('yazdir', () => BelgeYazdir(icerik)),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKapat}>
      <View style={styles.kok}>
        <Pressable style={styles.perde} onPress={onKapat} />
        <CamArkaplan
          intensity={24}
          tint="dark"
          style={StyleSheet.absoluteFill}
          fallbackColor="rgba(0,0,0,0.55)"
          pointerEvents="none"
        />
        <View style={styles.panel}>
          <LinearGradient colors={['#2A1C34', '#16101F']} style={styles.panelIc}>
            <View style={styles.ust}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fisilti}>BELGE</Text>
                <Text style={styles.baslik} numberOfLines={2}>
                  {icerik.baslik}
                </Text>
              </View>
              <Pressable onPress={onKapat} style={styles.kapat} hitSlop={8}>
                <Ionicons name="close" size={18} color={RenkTokenlari.text} />
              </Pressable>
            </View>

            <View style={styles.liste}>
              {aksiyonlar.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => void a.calistir()}
                  disabled={!!busy}
                  style={({ pressed }) => [styles.oge, pressed && { opacity: 0.88 }]}
                >
                  <View
                    style={[
                      styles.ikon,
                      { backgroundColor: `${a.tint}22`, borderColor: `${a.tint}55` },
                    ]}
                  >
                    {busy === a.key ? (
                      <ActivityIndicator color={a.tint} size="small" />
                    ) : (
                      <Ionicons name={a.icon} size={18} color={a.tint} />
                    )}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.label}>{a.label}</Text>
                    <Text style={styles.alt}>{a.alt}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
                </Pressable>
              ))}
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

/** Küçük tetikleyici buton — ekranlara gömülebilir */
export function BelgePaylasDugmesi({
  onPress,
  label = 'PDF / WhatsApp',
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dugme, pressed && { opacity: 0.9 }]}
    >
      <Ionicons name="share-outline" size={16} color="#12040C" />
      <Text style={styles.dugmeYazi}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  perde: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    elevation: 1,
  },
  panel: {
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    borderBottomWidth: 0,
    zIndex: 3,
    elevation: 24,
  },
  panelIc: {
    padding: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.lg,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.md,
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.4,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: 2,
  },
  kapat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  liste: { gap: 8 },
  oge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: 'rgba(33,28,46,0.75)',
  },
  ikon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  copy: { flex: 1, gap: 2 },
  label: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primarySoft,
  },
  dugmeYazi: {
    ...TipografiTokenlari.caption,
    color: '#12040C',
    fontWeight: '800',
  },
});
