import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import {
  GuvenlikOlaylarimiGetir,
  type GuvenlikOlayi,
} from '../../src/moduller/guvenlik/okuma/GuvenlikOlaylarimiGetir';
import {
  BILDIRME_SEBEPLERI,
  KullaniciBildir,
} from '../../src/moduller/moderasyon/islemler/ModerasyonIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TextField } from '../../src/components/TextField';

/**
 * Güvenlik + çocuk koruma merkezi
 */
export default function GuvenlikMerkeziEkrani() {
  const { isGuest, refreshProfile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [events, setEvents] = useState<GuvenlikOlayi[]>([]);
  const [cocukDetay, setCocukDetay] = useState('');
  const [cocukBusy, setCocukBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await GuvenlikOlaylarimiGetir());
    } catch {
      setEvents([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const hizliCocukRaporu = () => {
    islemiDene('oy_kullan', () => {
      Alert.alert(
        'Çocuk koruma bildirimi',
        'Bu rapor en yüksek öncelikle incelenir. Detay yazdıysan onunla gönderilir.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Gönder',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setCocukBusy(true);
                const etiket =
                  BILDIRME_SEBEPLERI.find((s) => s.id === 'child_safety')
                    ?.label ?? 'Çocuk istismarı / reşit olmayan içerik';
                const r = await KullaniciBildir({
                  reason: etiket,
                  reasonCode: 'child_safety',
                  contentType: 'other',
                  details:
                    cocukDetay.trim() ||
                    'Güvenlik merkezinden çocuk koruma bildirimi',
                  context: { source: 'safety_center' },
                });
                setCocukBusy(false);
                if (!r.ok) Alert.alert('Bildirim', r.hata);
                else {
                  Alert.alert(
                    'Öncelikli rapor alındı',
                    'Çocuk koruma ekibine iletildi.',
                  );
                  setCocukDetay('');
                  await load();
                }
              })();
            },
          },
        ],
      );
    });
  };

  const genelRapor = (sebepId: string) => {
    islemiDene('oy_kullan', async () => {
      const etiket =
        BILDIRME_SEBEPLERI.find((s) => s.id === sebepId)?.label ?? sebepId;
      const r = await KullaniciBildir({
        reason: etiket,
        reasonCode: sebepId,
        contentType: 'other',
        details: 'Güvenlik merkezinden gönderildi',
      });
      if (!r.ok) Alert.alert('Bildirim', r.hata);
      else {
        Alert.alert(
          sebepId === 'child_safety' ? 'Öncelikli rapor alındı' : 'Alındı',
          sebepId === 'child_safety'
            ? 'Çocuk koruma ekibine iletildi. İnceleme en yüksek öncelikle yapılır.'
            : 'Rapor güvenlik kuyruğuna düştü.',
        );
        await load();
      }
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="guvenlik">
        <EkranBasligi
          title="Güvenlik ve koruma"
          subtitle="18+ · engelle · bildir · çocuk koruma"
        />
        <View style={styles.content}>
          <View style={styles.banner}>
            <Ionicons
              name="shield-checkmark"
              size={22}
              color={RenkTokenlari.mint}
            />
            <View style={styles.bannerCopy}>
              <Text style={styles.bannerTitle}>Çocuk koruma (sıfır tolerans)</Text>
              <Text style={styles.bannerBody}>
                Platform 18+’tır. Reşit olmayan içerik veya katılım bildirildiğinde
                hesap kapatılır; gerekirse mercilere iletilir.
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.dangerBtn, cocukBusy && { opacity: 0.5 }]}
            onPress={hizliCocukRaporu}
            disabled={cocukBusy}
          >
            <Ionicons name="warning" size={18} color="#fff" />
            <Text style={styles.dangerBtnText}>Çocuk istismarı bildir</Text>
          </Pressable>

          <TextField
            label="Çocuk koruma detayı (isteğe bağlı)"
            placeholder="Ne gördün / nerede oldu?"
            value={cocukDetay}
            onChangeText={setCocukDetay}
          />

          <View style={styles.quickRow}>
            {(
              [
                { id: 'harassment', label: 'Taciz' },
                { id: 'sexual', label: 'Cinsel' },
                { id: 'violence', label: 'Şiddet' },
              ] as const
            ).map((s) => (
              <Pressable
                key={s.id}
                style={styles.quickChip}
                onPress={() => genelRapor(s.id)}
              >
                <Text style={styles.quickChipText}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/politika/child_safety' as any)}
          >
            <Text style={styles.linkText}>Çocuk koruma politikası</Text>
            <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
          </Pressable>

          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/engellenen-kullanicilar' as any)}
          >
            <Text style={styles.linkText}>Engellenen kullanıcılar</Text>
            <Text style={styles.linkHint}>Engeli kaldır</Text>
          </Pressable>

          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/destek' as any)}
          >
            <Text style={styles.linkText}>Canlı destek</Text>
            <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
          </Pressable>

          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/hesap-sil' as any)}
          >
            <Text style={styles.linkText}>Hesabı sil</Text>
            <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
          </Pressable>

          <Text style={styles.section}>Olaylar</Text>
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <BosDurum
                icon="shield-checkmark-outline"
                title="Olay yok"
                body="Güvenlik olayları burada listelenir."
              />
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{item.event_type}</Text>
                  <View style={styles.riskBadge}>
                    <Text style={styles.riskText}>Risk {item.risk_score}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{item.severity}</Text>
              </View>
            )}
          />
        </View>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => void refreshProfile()}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
  },
  banner: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(64, 200, 160, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(64, 200, 160, 0.28)',
  },
  bannerCopy: { flex: 1, gap: 4 },
  bannerTitle: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  bannerBody: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.danger,
  },
  dangerBtnText: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
  },
  quickChipText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  linkText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  linkHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
  },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: BoslukTokenlari.sm,
  },
  list: { flexGrow: 1, gap: BoslukTokenlari.sm, paddingBottom: BoslukTokenlari.lg },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: BoslukTokenlari.sm,
  },
  cardTitle: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
    flex: 1,
  },
  riskBadge: {
    paddingHorizontal: BoslukTokenlari.sm,
    paddingVertical: 2,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(232, 64, 145, 0.16)',
  },
  riskText: { ...TipografiTokenlari.micro, color: RenkTokenlari.primarySoft },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
