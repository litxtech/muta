import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { useAuth } from '../../src/contexts/AuthContext';
import { createRoom } from '../../src/services/api';
import type { Room } from '../../src/types/models';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { OdaOlusturMarkaBasligi } from '../../src/moduller/oda-olusturma/bilesenler/OdaOlusturMarkaBasligi';
import {
  CanliAcilisModKarti,
  type CanliAcilisMod,
} from '../../src/moduller/oda-olusturma/bilesenler/CanliAcilisModKarti';
import { OdaModSecimKarti } from '../../src/moduller/oda-olusturma/bilesenler/OdaModSecimKarti';
import { ODA_MODLARI } from '../../src/moduller/oda-olusturma/katalog/OdaModKatalogu';
import {
  ODA_KAPASITELER,
  OdaKapasitesiniCoz,
} from '../../src/moduller/oda-olusturma/katalog/OdaKapasiteKatalogu';
import { YeniOdaOnbellegeYaz } from '../../src/moduller/ses-odalari/onbellek/YeniOdaOnbellek';
import {
  OdaKapakSec,
  OdaKapakUriIleYukle,
} from '../../src/moduller/ses-odalari/islemler/OdaKapakMedyasiYukle';
import { MedyaIzinleriniIste } from '../../src/moduller/livekit/izin/MedyaIzinleriniIste';
import { ImagePickerOnIsit } from '../../src/ortak/medya/ImagePickerHazirMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type AcilisAdim = 'hub' | 'ses_odasi';

const HUB_MODLARI: CanliAcilisMod[] = [
  {
    kod: 'ses_odasi',
    ad: 'Ses odası',
    alt: 'Mikrofon koltukları · sohbet · hediye',
    rozet: 'SES',
    icon: 'mic',
    tint: RenkTokenlari.primarySoft,
    renkler: [
      'rgba(232,64,145,0.55)',
      'rgba(80,28,90,0.92)',
      'rgba(16,10,24,0.98)',
    ],
  },
  {
    kod: 'canli_yayin',
    ad: 'Canlı yayın',
    alt: 'Kamera ile sahneye çık · izleyici kitlesi',
    rozet: 'CANLI',
    icon: 'videocam',
    tint: '#FF6B6B',
    renkler: [
      'rgba(220,40,60,0.55)',
      'rgba(90,20,40,0.92)',
      'rgba(16,10,20,0.98)',
    ],
  },
  {
    kod: 'durum',
    ad: 'Durum',
    alt: 'Kısa an · foto veya metin paylaş',
    rozet: 'STORY',
    icon: 'sparkles',
    tint: RenkTokenlari.mint,
    renkler: [
      'rgba(61,207,176,0.45)',
      'rgba(24,70,70,0.92)',
      'rgba(12,16,22,0.98)',
    ],
  },
];

const MOD_VARSAYILAN: Record<
  Room['mode'],
  { tema: string; duzen: string }
> = {
  dating: { tema: 'midnight_plum', duzen: 'floating_glass' },
  party: { tema: 'neon_aurora', duzen: 'floating_glass' },
  karaoke: { tema: 'royal_gold', duzen: 'floating_glass' },
  game: { tema: 'cosmic_void', duzen: 'floating_glass' },
  private: { tema: 'midnight_plum', duzen: 'floating_glass' },
};

export default function CreateRoomScreen() {
  useEffect(() => {
    ImagePickerOnIsit({ izinIste: false });
  }, []);

  const { user, isGuest, refreshProfile, refreshWallet, profile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);

  const [adim, setAdim] = useState<AcilisAdim>('hub');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [kapakUri, setKapakUri] = useState<string | null>(null);
  const [kapakMime, setKapakMime] = useState<string | null>(null);
  const [mode, setMode] = useState<Room['mode']>('dating');
  const [kapasiteKod, setKapasiteKod] = useState('social');
  const [loading, setLoading] = useState(false);

  const kapasite = OdaKapasitesiniCoz(kapasiteKod);
  const varsayilan = MOD_VARSAYILAN[mode];

  const baslikOnerisi = useMemo(() => {
    const ad = profile?.display_name?.trim() || profile?.username?.trim();
    if (!ad) return '';
    return `${ad}'ın odası`;
  }, [profile?.display_name, profile?.username]);

  const hubSec = (kod: string) => {
    if (kod === 'ses_odasi') {
      setAdim('ses_odasi');
      return;
    }
    if (kod === 'canli_yayin') {
      router.push('/canli' as any);
      return;
    }
    if (kod === 'durum') {
      router.push('/durum/olustur' as any);
    }
  };

  const onCreate = () => {
    islemiDene('oda_olustur', async () => {
      if (!user) {
        Alert.alert('Giriş gerekli');
        return;
      }
      const baslik = (title.trim() || baslikOnerisi).trim();
      if (!baslik) {
        Alert.alert('Başlık gerekli', 'Oda için kısa bir başlık yaz.');
        return;
      }

      setLoading(true);
      try {
        void MedyaIzinleriniIste({ mikrofon: true });

        const { YaptirimAktifMi } = await import(
          '../../src/moduller/admin/ses-odalari/AdminSesOdasiIslemleri'
        );
        if (await YaptirimAktifMi('room_create_ban')) {
          Alert.alert(
            'Oda açılamaz',
            'Ses odası açma yasağın var. Süre dolunca veya yönetim kaldırınca tekrar deneyebilirsin.',
          );
          return;
        }

        let coverUrl: string | null = null;
        if (kapakUri) {
          const up = await OdaKapakUriIleYukle(kapakUri, kapakMime);
          if (!up.ok) {
            Alert.alert('Kapak', up.hata);
            return;
          }
          coverUrl = up.url;
        }

        const room = await createRoom({
          hostId: user.id,
          title: baslik,
          topic: topic.trim() || undefined,
          coverUrl,
          mode,
          maxSeats: kapasite.mikrofon,
          layoutCode: varsayilan.duzen,
          themeCode: varsayilan.tema,
          capacityTierCode: kapasite.kod,
          audienceCapacity: kapasite.dinleyici,
          microphoneCapacity: kapasite.mikrofon,
        });

        YeniOdaOnbellegeYaz(room, [
          {
            id: `local-${room.id}-0`,
            room_id: room.id,
            seat_index: 0,
            user_id: user.id,
            is_muted: false,
            is_locked: false,
            profile: profile ? { ...profile } : null,
          },
          ...Array.from(
            { length: Math.max(0, (room.max_seats ?? kapasite.mikrofon) - 1) },
            (_, i) => ({
              id: `local-${room.id}-${i + 1}`,
              room_id: room.id,
              seat_index: i + 1,
              user_id: null,
              is_muted: false,
              is_locked: false,
              profile: null,
            }),
          ),
        ]);

        router.push(`/room/${room.id}` as any);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        const mevcut =
          e &&
          typeof e === 'object' &&
          'code' in e &&
          (e as { code?: string }).code === 'MEVCUT_CANLI_ODA'
            ? (e as { roomId?: string; roomTitle?: string })
            : null;

        if (mevcut?.roomId || msg === 'MEVCUT_CANLI_ODA') {
          const odaId = mevcut?.roomId ?? (e as { roomId?: string })?.roomId;
          Alert.alert(
            'Zaten açık odan var',
            mevcut?.roomTitle
              ? `"${mevcut.roomTitle}" hâlâ canlı. Aynı anda yalnızca bir ses odası açabilirsin.`
              : 'Aynı anda yalnızca bir ses odası açabilirsin. Önce mevcut odana gir veya kapat.',
            [
              { text: 'İptal', style: 'cancel' },
              ...(odaId
                ? [
                    {
                      text: 'Odama git',
                      onPress: () => router.push(`/room/${odaId}` as any),
                    },
                  ]
                : []),
            ],
          );
          return;
        }

        Alert.alert(
          'Oda açılamadı',
          /policy|yaptirim|room_create|forbidden|check|duplicate|unique|tek_canli/i.test(
            msg,
          )
            ? 'Ses odası açma yasağın olabilir, yetkin yok veya zaten açık bir odan var.'
            : msg || 'Supabase migration çalıştırıldığından emin ol.',
        );
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <Screen edges={['top']} tabSayfaKaydir>
      <ModulHataSiniri modulAdi="oda-olusturma">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {adim === 'hub' ? (
            <>
              <OdaOlusturMarkaBasligi
                baslik="Canlıya geç"
                fisilti="OLUŞTUR"
                ozet="Ses odası, yayın veya durum — ne açacağını seç."
              />
              <View style={styles.hubListe}>
                {HUB_MODLARI.map((m) => (
                  <CanliAcilisModKarti
                    key={m.kod}
                    mod={m}
                    onPress={() => hubSec(m.kod)}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <OdaOlusturMarkaBasligi
                baslik="Ses odası aç"
                fisilti="SES ODASI"
                ozet="Kapak, başlık ve mod — oda anında açılır."
                geriMi
                onGeri={() => setAdim('hub')}
              />

              <KlavyeKapatan style={styles.panel}>
                <LinearGradient
                  colors={[
                    'rgba(232,64,145,0.14)',
                    'rgba(33,28,46,0.94)',
                    'rgba(18,14,28,0.98)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroKart}
                >
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        const sec = await OdaKapakSec();
                        if (!sec.ok) {
                          if (!sec.iptal) Alert.alert('Kapak', sec.hata);
                          return;
                        }
                        setKapakUri(sec.uri);
                        setKapakMime(sec.mimeType ?? null);
                      })();
                    }}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.kapakPress,
                      pressed && styles.kapakPressed,
                    ]}
                    accessibilityLabel="Oda kapak resmi"
                  >
                    {kapakUri ? (
                      <Image source={{ uri: kapakUri }} style={styles.kapakImg} />
                    ) : (
                      <LinearGradient
                        colors={[
                          'rgba(232,64,145,0.2)',
                          'rgba(80,40,120,0.15)',
                          'rgba(0,0,0,0.4)',
                        ]}
                        start={{ x: 0.2, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={styles.kapakBos}
                      >
                        <View style={styles.kapakIkon}>
                          <Ionicons
                            name="image-outline"
                            size={24}
                            color={RenkTokenlari.primarySoft}
                          />
                        </View>
                        <Text style={styles.kapakHint}>Kapak resmi ekle</Text>
                        <Text style={styles.kapakAlt}>Kartta ve lobide görünür</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.kapakBadge}>
                      <Ionicons
                        name="camera"
                        size={12}
                        color={RenkTokenlari.textOnOverlay}
                      />
                      <Text style={styles.kapakBadgeYazi}>
                        {kapakUri ? 'Değiştir' : 'Seç'}
                      </Text>
                    </View>
                  </Pressable>

                  <TextField
                    label="Oda başlığı"
                    value={title}
                    onChangeText={setTitle}
                    placeholder={baslikOnerisi || 'Gece sohbeti...'}
                    maxLength={40}
                    autoFocus
                  />
                  <TextField
                    label="Açıklama"
                    value={topic}
                    onChangeText={setTopic}
                    placeholder="Kısa konu — kartta görünür"
                    maxLength={120}
                    multiline
                    numberOfLines={2}
                  />
                </LinearGradient>

                <View style={styles.bolumBlok}>
                  <Text style={styles.bolum}>Mod</Text>
                  <Text style={styles.bolumAlt}>Odanın ruhunu seç</Text>
                  <View style={styles.modListe}>
                    {ODA_MODLARI.map((m) => (
                      <OdaModSecimKarti
                        key={m.kod}
                        mod={m}
                        secili={mode === m.kod}
                        onPress={() => setMode(m.kod)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.bolumBlok}>
                  <Text style={styles.bolum}>Boyut</Text>
                  <Text style={styles.bolumAlt}>Koltuk ve dinleyici kapasitesi</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipSerit}
                  >
                    {ODA_KAPASITELER.map((k) => {
                      const secili = kapasiteKod === k.kod;
                      return (
                        <Pressable
                          key={k.kod}
                          onPress={() => setKapasiteKod(k.kod)}
                          style={({ pressed }) => [
                            styles.chip,
                            secili && styles.chipAktif,
                            pressed && styles.chipPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: secili }}
                        >
                          <Text
                            style={[styles.chipAd, secili && styles.chipAdAktif]}
                          >
                            {k.ad}
                          </Text>
                          <Text
                            style={[styles.chipAlt, secili && styles.chipAltAktif]}
                          >
                            {k.mikrofon} koltuk
                          </Text>
                          <Text
                            style={[
                              styles.chipDinleyici,
                              secili && styles.chipAltAktif,
                            ]}
                          >
                            {k.dinleyici >= 1000
                              ? `${Math.round(k.dinleyici / 1000)}k dinleyici`
                              : `${k.dinleyici} dinleyici`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <GradientButton
                  title={loading ? 'Açılıyor…' : 'Ses odasını aç'}
                  onPress={onCreate}
                  loading={loading}
                  style={styles.cta}
                />
              </KlavyeKapatan>
            </>
          )}
        </ScrollView>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
  },
  hubListe: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.lg,
  },
  panel: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.lg,
  },
  heroKart: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: BoslukTokenlari.md,
  },
  bolumBlok: {
    gap: 6,
  },
  bolum: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 17,
    lineHeight: 22,
  },
  bolumAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginBottom: BoslukTokenlari.sm,
  },
  modListe: {
    gap: BoslukTokenlari.md,
  },
  chipSerit: {
    gap: BoslukTokenlari.sm,
    paddingRight: BoslukTokenlari.md,
  },
  chip: {
    minWidth: 100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 3,
  },
  chipAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: 'rgba(232,64,145,0.16)',
  },
  chipPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  chipAd: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  chipAdAktif: {
    color: RenkTokenlari.primarySoft,
  },
  chipAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  chipDinleyici: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
  },
  chipAltAktif: {
    color: RenkTokenlari.textMuted,
  },
  cta: {
    marginTop: BoslukTokenlari.xs,
  },
  kapakPress: {
    height: 148,
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.28)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  kapakPressed: {
    opacity: 0.92,
  },
  kapakImg: {
    width: '100%',
    height: '100%',
  },
  kapakBos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kapakIkon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,64,145,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.35)',
    marginBottom: 4,
  },
  kapakHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  kapakAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  kapakBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: RenkTokenlari.chipFill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
  },
  kapakBadgeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
    fontSize: 10,
  },
});
