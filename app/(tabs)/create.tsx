import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { OdaModSecimKarti } from '../../src/moduller/oda-olusturma/bilesenler/OdaModSecimKarti';
import { ODA_MODLARI } from '../../src/moduller/oda-olusturma/katalog/OdaModKatalogu';
import {
  ODA_KAPASITELER,
  OdaKapasitesiniCoz,
} from '../../src/moduller/oda-olusturma/katalog/OdaKapasiteKatalogu';
import { YeniOdaOnbellegeYaz } from '../../src/moduller/ses-odalari/onbellek/YeniOdaOnbellek';
import { MedyaIzinleriniIste } from '../../src/moduller/livekit/izin/MedyaIzinleriniIste';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Mod → varsayılan tema / düzen (sihirbaz adımları kaldırıldı) */
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
  const { user, isGuest, refreshProfile, refreshWallet, profile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);

  const [title, setTitle] = useState('');
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
        // Mikrofon iznini odaya girmeden al — bağlanma süresini kısaltır
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

        const room = await createRoom({
          hostId: user.id,
          title: baslik,
          mode,
          maxSeats: kapasite.mikrofon,
          layoutCode: varsayilan.duzen,
          themeCode: varsayilan.tema,
          capacityTierCode: kapasite.kod,
          audienceCapacity: kapasite.dinleyici,
          microphoneCapacity: kapasite.mikrofon,
        });

        // Host zaten seat 0'da — room ekranı anında açılsın
        YeniOdaOnbellegeYaz(room, [
          {
            id: `local-${room.id}-0`,
            room_id: room.id,
            seat_index: 0,
            user_id: user.id,
            is_muted: false,
            is_locked: false,
            profile: profile
              ? {
                  ...profile,
                }
              : null,
          },
          ...Array.from({ length: Math.max(0, (room.max_seats ?? kapasite.mikrofon) - 1) }, (_, i) => ({
            id: `local-${room.id}-${i + 1}`,
            room_id: room.id,
            seat_index: i + 1,
            user_id: null,
            is_muted: false,
            is_locked: false,
            profile: null,
          })),
        ]);

        router.replace(`/lobi/${room.id}` as any);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        Alert.alert(
          'Oda açılamadı',
          /policy|yaptirim|room_create|forbidden|check/i.test(msg)
            ? 'Ses odası açma yasağın olabilir veya yetkin yok.'
            : msg || 'Supabase migration çalıştırıldığından emin ol.',
        );
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="oda-olusturma">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <OdaOlusturMarkaBasligi ozet="Başlık yaz, mod seç, hemen yayına çık." />

          <KlavyeKapatan style={styles.panel}>
            <LinearGradient
              colors={['rgba(232,64,145,0.14)', 'rgba(33,28,46,0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroKart}
            >
              <View style={styles.heroUst}>
                <View style={styles.liveRozet}>
                  <View style={styles.liveNokta} />
                  <Text style={styles.liveYazi}>CANLI</Text>
                </View>
                <Text style={styles.heroMeta}>
                  {kapasite.mikrofon} mic · {kapasite.dinleyici} dinleyici
                </Text>
              </View>
              <TextField
                label="Oda başlığı"
                value={title}
                onChangeText={setTitle}
                placeholder={baslikOnerisi || 'Gece sohbeti...'}
                maxLength={40}
                autoFocus
              />
            </LinearGradient>

            <Text style={styles.bolum}>Mod</Text>
            <View style={styles.grid}>
              {ODA_MODLARI.map((m) => (
                <OdaModSecimKarti
                  key={m.kod}
                  mod={m}
                  secili={mode === m.kod}
                  onPress={() => setMode(m.kod)}
                />
              ))}
            </View>

            <Text style={styles.bolum}>Boyut</Text>
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
                    style={[styles.chip, secili && styles.chipAktif]}
                  >
                    <Text style={[styles.chipAd, secili && styles.chipAdAktif]}>
                      {k.ad}
                    </Text>
                    <Text style={[styles.chipAlt, secili && styles.chipAltAktif]}>
                      {k.mikrofon} mic
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <GradientButton
              title={loading ? 'Açılıyor…' : 'Ses odasını aç'}
              onPress={onCreate}
              loading={loading}
              style={styles.cta}
            />
            <View style={styles.ipucu}>
              <Ionicons name="flash" size={14} color={RenkTokenlari.primarySoft} />
              <Text style={styles.ipucuYazi}>
                Tek ekran — oda anında açılır, ses bağlantısı arka planda kurulur.
              </Text>
            </View>
          </KlavyeKapatan>
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
  panel: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.lg,
  },
  heroKart: {
    borderRadius: YaricapTokenlari.md + 4,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: BoslukTokenlari.md,
  },
  heroUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(232,64,145,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
  },
  liveNokta: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.live,
  },
  liveYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroMeta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  bolum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: -4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.md,
  },
  chipSerit: {
    gap: BoslukTokenlari.sm,
    paddingRight: BoslukTokenlari.md,
  },
  chip: {
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 2,
  },
  chipAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: 'rgba(232,64,145,0.16)',
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
  chipAltAktif: {
    color: RenkTokenlari.textMuted,
  },
  cta: {
    marginTop: BoslukTokenlari.sm,
  },
  ipucu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  ipucuYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    flex: 1,
    lineHeight: 16,
  },
});
