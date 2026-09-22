import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminOzetGetir, type AdminOzet } from '../../src/moduller/admin/okuma/AdminOzetGetir';
import {
  AdminStil,
  SayiKisa,
} from '../../src/moduller/admin/bilesenler/AdminStil';
import {
  BelgePaylasDugmesi,
  BelgePaylasimPaneli,
} from '../../src/moduller/belge-paylasim/bilesenler/BelgePaylasimPaneli';
import { AdminOzetBelgesiOlustur } from '../../src/moduller/belge-paylasim/BelgeIcerikDonustur';
import type { BelgeIcerik } from '../../src/moduller/belge-paylasim/BelgeSablonlari';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Modul = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  alt: string;
  href: string;
  tint: string;
  bolum: string;
};

const MODULLER: Modul[] = [
  {
    icon: 'people-outline',
    label: 'Kullanıcılar',
    alt: 'Dosya · ban · ihtar · harcama',
    href: '/admin/kullanicilar',
    tint: RenkTokenlari.accent,
    bolum: 'İnsanlar',
  },
  {
    icon: 'book-outline',
    label: 'Rehber',
    alt: 'Telefon · e-posta · WhatsApp · mail',
    href: '/admin/rehber',
    tint: RenkTokenlari.mint,
    bolum: 'İnsanlar',
  },
  {
    icon: 'wallet-outline',
    label: 'Finans',
    alt: 'Yükleme · çekim · en çok harcayan',
    href: '/admin/finans',
    tint: RenkTokenlari.primarySoft,
    bolum: 'İnsanlar',
  },
  {
    icon: 'id-card-outline',
    label: 'Kimlik onayı',
    alt: 'KYC · belge · canlılık · onay/red',
    href: '/admin/kyc',
    tint: RenkTokenlari.mint,
    bolum: 'İnsanlar',
  },
  {
    icon: 'swap-horizontal-outline',
    label: 'Coin takas',
    alt: 'Takas · transfer · aylık limit · onay',
    href: '/admin/takas',
    tint: RenkTokenlari.accent,
    bolum: 'İnsanlar',
  },
  {
    icon: 'add-circle-outline',
    label: 'Coin yükle',
    alt: 'İsim yaz · avatar · yükle',
    href: '/admin/coin',
    tint: RenkTokenlari.accent,
    bolum: 'İnsanlar',
  },
  {
    icon: 'pricetags-outline',
    label: 'Coin paketleri',
    alt: 'Product ID · coin · bonus · kampanya',
    href: '/admin/coin-paketleri',
    tint: RenkTokenlari.primarySoft,
    bolum: 'İnsanlar',
  },
  {
    icon: 'color-palette-outline',
    label: 'Cüzdan yönetimi',
    alt: 'Simge · tema · bölüm · yayın / geri al',
    href: '/admin/cuzdan-yonetimi',
    tint: RenkTokenlari.primarySoft,
    bolum: 'İnsanlar',
  },
  {
    icon: 'cash-outline',
    label: 'Ciro',
    alt: 'Anlık · gün · hafta · ay · PDF',
    href: '/admin/ciro',
    tint: RenkTokenlari.accent,
    bolum: 'İnsanlar',
  },
  {
    icon: 'business-outline',
    label: 'Ajanslar',
    alt: 'Coin yükle · limit yükselt/indir',
    href: '/admin/ajanslar',
    tint: RenkTokenlari.accent,
    bolum: 'İnsanlar',
  },
  {
    icon: 'shield-half-outline',
    label: 'Moderasyon',
    alt: 'Rapor kuyruğu · çözüm',
    href: '/admin/moderasyon',
    tint: RenkTokenlari.danger,
    bolum: 'Güvenlik',
  },
  {
    icon: 'call-outline',
    label: 'Görüşme güvenliği',
    alt: 'Kayıt / ekran görüntüsü · uyarı',
    href: '/admin/gorusme-guvenlik',
    tint: RenkTokenlari.danger,
    bolum: 'Güvenlik',
  },
  {
    icon: 'shield-checkmark-outline',
    label: 'Platform güvenliği',
    alt: 'Cihaz · silinen dönüş · benzer mail',
    href: '/admin/platform-guvenlik',
    tint: RenkTokenlari.danger,
    bolum: 'Güvenlik',
  },
  {
    icon: 'accessibility-outline',
    label: 'Çocuk Koruma',
    alt: 'Onaylayanlar · vermeyenler · 18+',
    href: '/admin/cocuk-koruma',
    tint: RenkTokenlari.danger,
    bolum: 'Güvenlik',
  },
  {
    icon: 'headset-outline',
    label: 'Canlı destek',
    alt: 'Toprak · oturum · temsilci ata',
    href: '/admin/destek',
    tint: RenkTokenlari.mint,
    bolum: 'Güvenlik',
  },
  {
    icon: 'bulb-outline',
    label: 'Fikir & Öneriler',
    alt: 'Kuyruk · durum · ödül · kategori',
    href: '/admin/fikirler',
    tint: RenkTokenlari.accent,
    bolum: 'Ürün',
  },
  {
    icon: 'radio-outline',
    label: 'Canlı odalar',
    alt: 'Ses odası · yayın · kapat · yaptırım',
    href: '/admin/odalar',
    tint: RenkTokenlari.live,
    bolum: 'Güvenlik',
  },
  {
    icon: 'musical-notes-outline',
    label: 'Müzik Merkezi',
    alt: 'Oda BGM · yükle · yayınla · arşiv',
    href: '/admin/muzik',
    tint: RenkTokenlari.violet,
    bolum: 'Ürün',
  },
  {
    icon: 'gift-outline',
    label: 'Ekonomi',
    alt: 'Paket · hediye kataloğu',
    href: '/admin/ekonomi',
    tint: RenkTokenlari.violet,
    bolum: 'Ürün',
  },
  {
    icon: 'game-controller-outline',
    label: 'Oyun yönetimi',
    alt: 'Aç/kapa · test · Kaskad RTP',
    href: '/admin/oyunlar',
    tint: RenkTokenlari.accent,
    bolum: 'Ürün',
  },
  {
    icon: 'checkbox-outline',
    label: 'Şehir seçimleri',
    alt: '81 il · başlat · sonuç · push',
    href: '/admin/sehir-secim',
    tint: RenkTokenlari.mint,
    bolum: 'Ürün',
  },
  {
    icon: 'options-outline',
    label: 'Özellikler',
    alt: 'Bayrak · kill · duyuru',
    href: '/admin/ozellikler',
    tint: RenkTokenlari.mint,
    bolum: 'Ürün',
  },
  {
    icon: 'images-outline',
    label: 'Bannerlar',
    alt: 'Kampanya · yerleştirme · CTR',
    href: '/admin/bannerlar',
    tint: RenkTokenlari.magenta,
    bolum: 'Büyüme',
  },
  {
    icon: 'flash-outline',
    label: 'Otomatik bannerlar',
    alt: 'Hediye eşik · yağmur · sabitle',
    href: '/admin/bannerlar/otomatik',
    tint: RenkTokenlari.accent,
    bolum: 'Büyüme',
  },
  {
    icon: 'call-outline',
    label: 'Kurumsal iletişim',
    alt: 'E-posta · WhatsApp · hamburger',
    href: '/admin/iletisim',
    tint: RenkTokenlari.mint,
    bolum: 'Büyüme',
  },
  {
    icon: 'film-outline',
    label: 'Giriş lobisi',
    alt: 'Video · resim · logo · metin',
    href: '/admin/giris-lobisi',
    tint: RenkTokenlari.primarySoft,
    bolum: 'Büyüme',
  },
  {
    icon: 'clipboard-outline',
    label: 'Kayıt alanları',
    alt: 'Zorunlu · gizli · özel alan',
    href: '/admin/kayit-alanlari',
    tint: RenkTokenlari.mint,
    bolum: 'Büyüme',
  },
  {
    icon: 'document-text-outline',
    label: 'Politikalar',
    alt: 'Yaz · güncelle · kayıt/giriş linki',
    href: '/admin/politikalar',
    tint: RenkTokenlari.primarySoft,
    bolum: 'Büyüme',
  },
  {
    icon: 'link-outline',
    label: 'Paylaşım',
    alt: 'İndirme linkleri',
    href: '/admin/paylasim-linkleri',
    tint: RenkTokenlari.primarySoft,
    bolum: 'Büyüme',
  },
  {
    icon: 'notifications-outline',
    label: 'Bildirimler',
    alt: 'Push kuyruğu',
    href: '/bildirimler',
    tint: RenkTokenlari.violet,
    bolum: 'Büyüme',
  },
  {
    icon: 'ribbon-outline',
    label: 'Sertifikasyon',
    alt: 'Kontrol · ağ · stres testi',
    href: '/sertifikasyon',
    tint: RenkTokenlari.accent,
    bolum: 'Operasyon',
  },
  {
    icon: 'grid-outline',
    label: 'Platform',
    alt: 'Etkinlik · görev · kısayollar',
    href: '/platform',
    tint: RenkTokenlari.mint,
    bolum: 'Operasyon',
  },
  {
    icon: 'lock-closed-outline',
    label: 'Güvenlik',
    alt: 'Koruma · bildir · olaylar',
    href: '/guvenlik',
    tint: RenkTokenlari.danger,
    bolum: 'Operasyon',
  },
];

const BOLUM_SIRASI = ['İnsanlar', 'Güvenlik', 'Ürün', 'Büyüme', 'Operasyon'];

export default function AdminHubEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [ozet, setOzet] = useState<AdminOzet | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [belge, setBelge] = useState<BelgeIcerik | null>(null);
  const [paylasAcik, setPaylasAcik] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setOzet(await AdminOzetGetir());
    } catch {
      setOzet(null);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    if (!admin) router.replace('/(tabs)/profile');
  }, [admin]);

  useFocusEffect(
    useCallback(() => {
      if (!admin) return;
      void yukle();
    }, [admin, yukle]),
  );

  if (!admin) {
    return (
      <Screen edges={['top']}>
        <View style={styles.blocked}>
          <Text style={styles.blockedText}>Yetkisiz erişim</Text>
        </View>
      </Screen>
    );
  }

  const p = ozet?.platform;
  const kpis = [
    {
      id: 'kullanici',
      n: SayiKisa(p?.kullanici.toplam ?? null),
      l: 'Kullanıcı',
      tint: RenkTokenlari.accent,
    },
    {
      id: 'coin',
      n: p ? SayiKisa(p.finans.toplam_yukleme_coin) : '—',
      l: 'Toplam coin',
      tint: RenkTokenlari.primarySoft,
    },
    {
      id: 'cekim_veya_push',
      n: String(p?.finans.bekleyen_cekim ?? ozet?.pendingOutbox ?? '—'),
      l: p ? 'Bekleyen çekim' : 'Push kuyruk',
      tint: RenkTokenlari.warning,
    },
    {
      id: 'rapor',
      n: String(p?.sosyal.acik_rapor ?? ozet?.openReports ?? '—'),
      l: 'Açık rapor',
      tint: RenkTokenlari.danger,
    },
    {
      id: 'canli_oda',
      n: String(p?.canli.odalar ?? ozet?.liveRooms ?? '—'),
      l: 'Canlı oda',
      tint: RenkTokenlari.live,
    },
    {
      id: 'canli_pk',
      n: String(p?.canli.pk ?? ozet?.livePk ?? '—'),
      l: 'Canlı PK',
      tint: RenkTokenlari.violet,
    },
  ];

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Kontrol merkezi"
        subtitle="Platform yönetimi"
        right={
          <BelgePaylasDugmesi
            onPress={() => {
              setBelge(AdminOzetBelgesiOlustur(ozet));
              setPaylasAcik(true);
            }}
            label="Rapor"
          />
        }
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={yukleniyor}
            onRefresh={() => void yukle()}
            tintColor={RenkTokenlari.primarySoft}
          />
        }
      >
        <LinearGradient
          colors={[...RenkTokenlari.gradientCard]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={AdminStil.hero}
        >
          <Text style={AdminStil.heroEyebrow}>Tamuso Admin</Text>
          <Text style={AdminStil.heroTitle}>Platform kontrolü</Text>
          <Text style={AdminStil.heroAlt}>
            Kullanıcılar, harcama, çekimler, odalar, raporlar, ekonomi ve özellik
            bayraklarını tek yerden yönet.
          </Text>
          {yukleniyor && !ozet ? (
            <ActivityIndicator
              color={RenkTokenlari.primarySoft}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </LinearGradient>

        <View style={AdminStil.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.id} style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, { color: k.tint }]}>{k.n}</Text>
              <Text style={AdminStil.kpiL}>{k.l}</Text>
            </View>
          ))}
        </View>

        {BOLUM_SIRASI.map((bolum) => {
          const items = MODULLER.filter((m) => m.bolum === bolum);
          if (!items.length) return null;
          return (
            <View key={bolum} style={{ gap: BoslukTokenlari.sm }}>
              <Text style={AdminStil.sectionLabel}>{bolum}</Text>
              <View style={AdminStil.modulGrid}>
                {items.map((m) => (
                  <Pressable
                    key={m.href}
                    style={({ pressed }) => [
                      AdminStil.modul,
                      pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => router.push(m.href as any)}
                  >
                    <View
                      style={[
                        AdminStil.modulIcon,
                        { backgroundColor: `${m.tint}28` },
                      ]}
                    >
                      <Ionicons name={m.icon} size={18} color={m.tint} />
                    </View>
                    <Text style={AdminStil.modulLabel}>{m.label}</Text>
                    <Text style={AdminStil.modulAlt}>{m.alt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={styles.note}>
          Kritik işlemler denetim kaydına yazılır. Tam finans/moderasyon için
          Supabase’de migration 023’ü uygula.
        </Text>
      </ScrollView>

      <BelgePaylasimPaneli
        visible={paylasAcik}
        onKapat={() => setPaylasAcik(false)}
        icerik={belge}
        telefon={profile?.phone_e164}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { ...TipografiTokenlari.body, color: RenkTokenlari.danger },
  note: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    marginTop: BoslukTokenlari.sm,
    lineHeight: 18,
  },
});
