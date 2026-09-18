import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { TextField } from '../../src/components/TextField';
import { KlavyeScrollView } from '../../src/bilesenler/klavye/KlavyeScrollView';
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
import { AdminStil } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function olayAdi(type: string): string {
  const map: Record<string, string> = {
    report_submitted: 'Rapor gönderildi',
    child_safety_report: 'Çocuk koruma raporu',
    user_blocked: 'Kullanıcı engellendi',
    user_unblocked: 'Engel kaldırıldı',
    account_restricted: 'Hesap kısıtlandı',
    login_anomaly: 'Şüpheli giriş',
    kill_switch: 'Acil durdurma',
    moderation_action: 'Moderasyon işlemi',
  };
  return map[type] ?? type.replace(/_/g, ' ');
}

function severityEtiketi(sev: string): { label: string; color: string } {
  switch ((sev || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return { label: 'Yüksek', color: RenkTokenlari.danger };
    case 'medium':
      return { label: 'Orta', color: RenkTokenlari.accent };
    case 'low':
      return { label: 'Düşük', color: RenkTokenlari.mint };
    default:
      return { label: sev || '—', color: RenkTokenlari.textMuted };
  }
}

function tarihKisa(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function GuvenlikMerkeziEkrani() {
  const { isGuest, refreshProfile, profile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [events, setEvents] = useState<GuvenlikOlayi[]>([]);
  const [cocukDetay, setCocukDetay] = useState('');
  const [cocukBusy, setCocukBusy] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const adminMi = profile?.is_admin === true;

  const load = useCallback(async () => {
    setYukleniyor(true);
    try {
      setEvents(await GuvenlikOlaylarimiGetir());
    } catch {
      setEvents([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const riskOzet = useMemo(() => {
    const yuksek = events.filter((e) => e.risk_score >= 70 || e.severity === 'critical').length;
    return { toplam: events.length, yuksek };
  }, [events]);

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
                  BILDIRME_SEBEPLERI.find((s) => s.id === 'child_safety')?.label ??
                  'Çocuk istismarı / reşit olmayan içerik';
                const r = await KullaniciBildir({
                  reason: etiket,
                  reasonCode: 'child_safety',
                  contentType: 'other',
                  details:
                    cocukDetay.trim() || 'Güvenlik merkezinden çocuk koruma bildirimi',
                  context: { source: 'safety_center' },
                });
                setCocukBusy(false);
                if (!r.ok) Alert.alert('Bildirim', r.hata);
                else {
                  Alert.alert('Öncelikli rapor alındı', 'Çocuk koruma ekibine iletildi.');
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
      const etiket = BILDIRME_SEBEPLERI.find((s) => s.id === sebepId)?.label ?? sebepId;
      const r = await KullaniciBildir({
        reason: etiket,
        reasonCode: sebepId,
        contentType: 'other',
        details: 'Güvenlik merkezinden gönderildi',
      });
      if (!r.ok) Alert.alert('Bildirim', r.hata);
      else {
        Alert.alert(
          sebepId === 'child_safety' ? 'Öncelikli rapor alındı' : 'Rapor alındı',
          sebepId === 'child_safety'
            ? 'Çocuk koruma ekibine iletildi.'
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
          title="Güvenlik"
          subtitle="Koruma · bildir · engelle · olaylar"
          fallbackHref={adminMi ? '/admin' : undefined}
        />
        <KlavyeScrollView
          contentContainerStyle={AdminStil.content}
          refreshControl={
            <RefreshControl refreshing={yukleniyor} onRefresh={() => void load()} />
          }
        >
          <LinearGradient
            colors={[...RenkTokenlari.gradientCard]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={AdminStil.hero}
          >
            <Text style={AdminStil.heroEyebrow}>18+ · sıfır tolerans</Text>
            <Text style={AdminStil.heroTitle}>Koruma merkezi</Text>
            <Text style={AdminStil.heroAlt}>
              Reşit olmayan içerik veya katılım bildirildiğinde hesap kapatılır; gerekirse
              mercilere iletilir.
            </Text>
          </LinearGradient>

          <View style={AdminStil.kpiGrid}>
            <View style={AdminStil.kpi}>
              <Text style={AdminStil.kpiN}>{riskOzet.toplam}</Text>
              <Text style={AdminStil.kpiL}>Kayıtlı olay</Text>
            </View>
            <View style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, { color: RenkTokenlari.danger }]}>
                {riskOzet.yuksek}
              </Text>
              <Text style={AdminStil.kpiL}>Yüksek risk</Text>
            </View>
          </View>

          <Text style={AdminStil.sectionLabel}>Acil çocuk koruma</Text>
          <View style={AdminStil.kart}>
            <Text style={AdminStil.kartAlt}>
              En yüksek öncelik. Kısa detay yazmak incelemeyi hızlandırır.
            </Text>
            <TextField
              label="Ne gördün? (isteğe bağlı)"
              placeholder="Örn: odada / mesajda / yayınında…"
              value={cocukDetay}
              onChangeText={setCocukDetay}
            />
            <Pressable
              style={[styles.dangerBtn, cocukBusy && { opacity: 0.5 }]}
              onPress={hizliCocukRaporu}
              disabled={cocukBusy}
            >
              <Ionicons name="warning" size={18} color="#fff" />
              <Text style={styles.dangerBtnText}>
                {cocukBusy ? 'Gönderiliyor…' : 'Çocuk istismarı bildir'}
              </Text>
            </Pressable>
          </View>

          <Text style={AdminStil.sectionLabel}>Hızlı bildir</Text>
          <View style={styles.quickGrid}>
            {(
              [
                { id: 'harassment', label: 'Taciz', icon: 'hand-left-outline' as const },
                { id: 'sexual', label: 'Cinsel', icon: 'eye-off-outline' as const },
                { id: 'violence', label: 'Şiddet', icon: 'flash-outline' as const },
                { id: 'spam', label: 'Spam', icon: 'mail-unread-outline' as const },
              ] as const
            ).map((s) => (
              <Pressable key={s.id} style={styles.quickCard} onPress={() => genelRapor(s.id)}>
                <Ionicons name={s.icon} size={18} color={RenkTokenlari.primarySoft} />
                <Text style={styles.quickLabel}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={AdminStil.sectionLabel}>Araçlar</Text>
          <View style={AdminStil.kart}>
            <LinkSatir
              icon="document-text-outline"
              label="Çocuk koruma politikası"
              onPress={() => router.push('/politika/child_safety' as any)}
            />
            <LinkSatir
              icon="ban-outline"
              label="Engellenen kullanıcılar"
              hint="Engeli kaldır"
              onPress={() => router.push('/engellenen-kullanicilar' as any)}
            />
            <LinkSatir
              icon="headset-outline"
              label="Canlı destek"
              onPress={() => router.push('/destek' as any)}
            />
            {adminMi ? (
              <LinkSatir
                icon="shield-half-outline"
                label="Admin moderasyon kuyruğu"
                onPress={() => router.push('/admin/moderasyon' as any)}
              />
            ) : null}
            <LinkSatir
              icon="trash-outline"
              label="Hesabı sil"
              son
              onPress={() => router.push('/hesap-sil' as any)}
            />
          </View>

          <Text style={AdminStil.sectionLabel}>Son güvenlik olayları</Text>
          {events.length === 0 ? (
            <BosDurum
              icon="shield-checkmark-outline"
              title="Olay yok"
              body="Bildirim ve güvenlik kayıtların burada listelenir."
            />
          ) : (
            events.map((item) => {
              const sev = severityEtiketi(item.severity);
              return (
                <View key={item.id} style={styles.olayKart}>
                  <View style={styles.olayUst}>
                    <Text style={styles.olayBaslik}>{olayAdi(item.event_type)}</Text>
                    <View style={styles.riskBadge}>
                      <Text style={styles.riskText}>Risk {item.risk_score}</Text>
                    </View>
                  </View>
                  <View style={styles.olayMetaSatir}>
                    <Text style={[styles.olayMeta, { color: sev.color }]}>{sev.label}</Text>
                    <Text style={styles.olayMeta}>·</Text>
                    <Text style={styles.olayMeta}>{item.status || '—'}</Text>
                    <Text style={styles.olayMeta}>·</Text>
                    <Text style={styles.olayMeta}>{tarihKisa(item.created_at)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </KlavyeScrollView>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => void refreshProfile()}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

function LinkSatir({
  icon,
  label,
  hint,
  onPress,
  son,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  son?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.linkSatir, !son && styles.linkBorder]}
    >
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={16} color={RenkTokenlari.text} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      {hint ? <Text style={styles.linkHint}>{hint}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.danger,
  },
  dangerBtnText: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm,
  },
  quickCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    gap: 8,
  },
  quickLabel: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  linkSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  linkBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
    flex: 1,
  },
  linkHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  olayKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  olayUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  olayBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    flex: 1,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(232,64,145,0.16)',
  },
  riskText: { ...TipografiTokenlari.micro, color: RenkTokenlari.primarySoft, fontWeight: '700' },
  olayMetaSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  olayMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
});
