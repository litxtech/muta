import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { SehirDestekle } from '../../src/moduller/sehirler/islemler/SehirDestekle';
import { SehirDestekGeriCek } from '../../src/moduller/sehirler/islemler/SehirDestekGeriCek';
import {
  SehirDetayGetir,
  type SehirDetayOzeti,
} from '../../src/moduller/sehirler/okuma/SehirDetayGetir';
import { SehirDuyuruYayinla } from '../../src/moduller/sehirler/islemler/SehirModernIslemleri';
import { SehirStil } from '../../src/moduller/sehirler/bilesenler/SehirStil';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { TextField } from '../../src/components/TextField';
import { KlavyeScrollView } from '../../src/bilesenler/klavye/KlavyeScrollView';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function rolAdi(role: string) {
  if (role === 'leader') return 'Lider';
  if (role === 'vice_leader') return 'Yardımcı';
  return role;
}

function secimDurum(status: string) {
  const map: Record<string, string> = {
    nominating: 'Adaylık açık',
    voting: 'Oylama sürüyor',
    tallied: 'Sonuçlandı',
  };
  return map[status] ?? status;
}

export default function SehirDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const leagueOn = OzellikBayragiAktifMi('city_league_enabled');

  const [detay, setDetay] = useState<SehirDetayOzeti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [duyuruBaslik, setDuyuruBaslik] = useState('');
  const [duyuruMetin, setDuyuruMetin] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setDetay(await SehirDetayGetir(id));
    } catch (e) {
      Alert.alert('Şehir', e instanceof Error ? e.message : 'Yüklenemedi');
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const destekle = () => {
    if (!id) return;
    islemiDene('oy_kullan', async () => {
      if (!leagueOn) {
        Alert.alert('Kapalı', 'Şehir ligi özelliği şu an kapalı.');
        return;
      }
      setBusy(true);
      const r = await SehirDestekle({ cityId: id, isPrimary: true });
      setBusy(false);
      if (!r.ok) Alert.alert('Destek', r.hata);
      else {
        Alert.alert('Tamam', 'Bu şehir artık ana şehrin. Hediyelerin buraya güç yazar.');
        await load();
      }
    });
  };

  const geriCek = () => {
    if (!id) return;
    islemiDene('oy_kullan', () => {
      Alert.alert('Destek geri çek', 'Bu şehir desteğini kaldırmak istiyor musun?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Geri çek',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await SehirDestekGeriCek({ cityId: id });
              setBusy(false);
              if (!r.ok) Alert.alert('Destek', r.hata);
              else await load();
            })();
          },
        },
      ]);
    });
  };

  const city = detay?.city;

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehirler">
        <EkranBasligi
          title={city?.name ?? 'Şehir'}
          subtitle="Detay · oda · lig · savaş"
          fallbackHref="/sehir"
        />
        <KlavyeScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={yukleniyor} onRefresh={() => void load()} />
          }
        >
          {yukleniyor && !detay ? (
            <ActivityIndicator color={RenkTokenlari.accent} style={{ marginTop: 40 }} />
          ) : null}

          {detay && city ? (
            <>
              <LinearGradient
                colors={[...RenkTokenlari.gradientCard]}
                style={styles.hero}
              >
                <Text style={styles.heroEyebrow}>
                  {detay.is_primary
                    ? 'Senin ana şehrin'
                    : detay.supported
                      ? 'Destekliyorsun'
                      : 'Henüz desteklemiyorsun'}
                </Text>
                <Text style={styles.heroTitle}>{city.name}</Text>
                <Text style={styles.heroAlt}>
                  Güç, lig puanı ve savaş skoru buradan akar. Odada hediye göndererek katkı yap.
                </Text>
                <View style={styles.kpiRow}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiN}>{city.power_score}</Text>
                    <Text style={styles.kpiL}>Güç</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiN}>{city.supporter_count}</Text>
                    <Text style={styles.kpiL}>Destekçi</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiN}>
                      {detay.standing?.rank != null ? `#${detay.standing.rank}` : '—'}
                    </Text>
                    <Text style={styles.kpiL}>Lig sırası</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiN}>{detay.today_power ?? 0}</Text>
                    <Text style={styles.kpiL}>Bugün kattığın</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.aksiyonSatir}>
                {!detay.is_primary ? (
                  <Pressable
                    style={[styles.btnPrimary, busy && { opacity: 0.5 }]}
                    disabled={busy}
                    onPress={destekle}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {detay.supported ? 'Ana şehir yap' : 'Destekle (ana şehir)'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.btnSecondary}
                    onPress={() => router.push('/(tabs)/rooms' as any)}
                  >
                    <Text style={styles.btnSecondaryText}>Odaya git · hediye gönder</Text>
                  </Pressable>
                )}
                {detay.supported ? (
                  <Pressable
                    style={[styles.btnGhost, busy && { opacity: 0.5 }]}
                    disabled={busy}
                    onPress={geriCek}
                  >
                    <Text style={styles.btnGhostText}>Desteği geri çek</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.section}>Nasıl güç kazanılır?</Text>
              <View style={styles.kart}>
                {(detay.how_it_works ?? []).map((adim, i) => (
                  <Text key={i} style={styles.adim}>
                    {i + 1}. {adim}
                  </Text>
                ))}
              </View>

              <Text style={styles.section}>Duyurular</Text>
              <View style={styles.kart}>
                {(detay.announcements ?? []).length === 0 ? (
                  <Text style={styles.meta}>
                    Henüz duyuru yok.
                    {detay.is_leader
                      ? ' Lider olarak aşağıdan yayınlayabilirsin.'
                      : ' Lider yayınladığında burada görünür.'}
                  </Text>
                ) : (
                  (detay.announcements ?? []).map((a) => (
                    <View key={a.id} style={styles.duyuruSatir}>
                      <View style={styles.duyuruUst}>
                        <Text style={styles.kartBaslik}>{a.title}</Text>
                        {a.is_pinned ? (
                          <View style={SehirStil.pill}>
                            <Text style={SehirStil.pillText}>SABİT</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.meta}>{a.body}</Text>
                      <Text style={styles.meta}>
                        {a.author_name ?? 'Lider'}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              {detay.is_leader ? (
                <>
                  <Text style={styles.section}>Lider duyurusu</Text>
                  <View style={styles.kart}>
                    <TextField
                      label="Başlık"
                      value={duyuruBaslik}
                      onChangeText={setDuyuruBaslik}
                      placeholder="Örn: Bu hafta savaş var"
                    />
                    <TextField
                      label="Mesaj"
                      value={duyuruMetin}
                      onChangeText={setDuyuruMetin}
                      placeholder="Destekçilere kısa mesaj…"
                    />
                    <Pressable
                      style={[SehirStil.btnPrimary, busy && { opacity: 0.5 }]}
                      disabled={busy}
                      onPress={() => {
                        islemiDene('oy_kullan', async () => {
                          setBusy(true);
                          const r = await SehirDuyuruYayinla({
                            cityId: id!,
                            title: duyuruBaslik,
                            body: duyuruMetin,
                            pinned: true,
                          });
                          setBusy(false);
                          if (!r.ok) Alert.alert('Duyuru', r.hata);
                          else {
                            setDuyuruBaslik('');
                            setDuyuruMetin('');
                            Alert.alert('Yayınlandı', 'Şehir duyurusu göründü.');
                            await load();
                          }
                        });
                      }}
                    >
                      <Text style={SehirStil.btnPrimaryText}>Duyuru yayınla</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {detay.standing ? (
                <>
                  <Text style={styles.section}>Bu sezon</Text>
                  <View style={styles.kart}>
                    <Satir e="Puan" d={String(detay.standing.points)} />
                    <Satir e="Hediye skoru" d={String(detay.standing.gifts_score)} />
                    <Satir e="Savaş galibiyeti" d={String(detay.standing.battle_wins)} />
                    <Pressable onPress={() => router.push('/sehir/lig' as any)}>
                      <Text style={styles.link}>Lig sıralamasına git →</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {detay.battle ? (
                <>
                  <Text style={styles.section}>Savaş</Text>
                  <Pressable
                    style={styles.savasKart}
                    onPress={() => router.push('/sehir/savas' as any)}
                  >
                    <Text style={styles.savasDurum}>
                      {detay.battle.status === 'live' ? 'CANLI' : 'Planlandı'}
                    </Text>
                    <Text style={styles.savasSkor}>
                      {detay.battle.city_a_name} {detay.battle.score_a} —{' '}
                      {detay.battle.score_b} {detay.battle.city_b_name}
                    </Text>
                    <Text style={styles.savasHint}>
                      Ana şehrinse hediye göndererek skora katkı yaparsın.
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {detay.election ? (
                <>
                  <Text style={styles.section}>Seçim</Text>
                  <Pressable
                    style={styles.kart}
                    onPress={() =>
                      router.push(`/sehir/secim/${detay.election!.id}` as any)
                    }
                  >
                    <Text style={styles.kartBaslik}>{detay.election.title}</Text>
                    <Text style={styles.meta}>
                      {secimDurum(detay.election.status)} ·{' '}
                      {detay.election.role_target === 'leader' ? 'Lider' : 'Yardımcı'}
                    </Text>
                    <Text style={styles.link}>Seçime git →</Text>
                  </Pressable>
                </>
              ) : null}

              <Text style={styles.section}>Liderlik</Text>
              <View style={styles.kart}>
                {detay.roles.length === 0 ? (
                  <Text style={styles.meta}>
                    Aktif lider yok. Seçim açılınca aday olabilir / oy kullanabilirsin.
                  </Text>
                ) : (
                  detay.roles.map((r) => (
                    <View key={`${r.role}-${r.user_id}`} style={styles.rolSatir}>
                      <Text style={styles.rolEtiket}>{rolAdi(r.role)}</Text>
                      <Text style={styles.rolAd}>
                        {r.display_name ?? r.username ?? r.user_id.slice(0, 8)}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <Text style={styles.section}>Resmi odalar</Text>
              <View style={styles.kart}>
                {detay.rooms.length === 0 ? (
                  <Text style={styles.meta}>
                    Bu şehre bağlı resmi oda henüz yok. Genel odalardan hediye göndersen de
                    gücün ana şehrine yazılır.
                  </Text>
                ) : (
                  detay.rooms.map((o) => (
                    <Pressable
                      key={o.id}
                      style={styles.odaSatir}
                      onPress={() => {
                        if (!o.room_id) {
                          Alert.alert('Oda', 'Bu resmi oda henüz bir ses odasına bağlı değil.');
                          return;
                        }
                        router.push(`/lobi/${o.room_id}` as any);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.odaBaslik}>{o.title}</Text>
                        <Text style={styles.meta}>
                          {o.is_live ? 'Canlı' : 'Kapalı'} · {o.listener_count} dinleyici
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={RenkTokenlari.textDim}
                      />
                    </Pressable>
                  ))
                )}
              </View>
            </>
          ) : null}
        </KlavyeScrollView>

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

function Satir({ e, d }: { e: string; d: string }) {
  return (
    <View style={styles.satir}>
      <Text style={styles.meta}>{e}</Text>
      <Text style={styles.satirDeger}>{d}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  hero: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: 8,
  },
  heroEyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: { ...TipografiTokenlari.title, color: RenkTokenlari.text, fontSize: 28 },
  heroAlt: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, lineHeight: 18 },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  kpi: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: YaricapTokenlari.sm,
    padding: 10,
    gap: 2,
  },
  kpiN: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '800' },
  kpiL: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  aksiyonSatir: { gap: 8 },
  btnPrimary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.primary,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
  btnSecondary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.violet,
  },
  btnSecondaryText: { color: '#fff', fontWeight: '800' },
  btnGhost: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  btnGhostText: { color: RenkTokenlari.textMuted, fontWeight: '700' },
  section: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  kart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 8,
  },
  kartBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  adim: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, lineHeight: 18 },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  link: { ...TipografiTokenlari.caption, color: RenkTokenlari.mint, fontWeight: '700' },
  satir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  satirDeger: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  savasKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(232,75,106,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,75,106,0.35)',
    gap: 6,
  },
  savasDurum: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    fontWeight: '900',
    letterSpacing: 1,
  },
  savasSkor: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, fontWeight: '800' },
  savasHint: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  rolSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  rolEtiket: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent, fontWeight: '800' },
  rolAd: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '600' },
  odaSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
  },
  odaBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  duyuruSatir: {
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
  },
  duyuruUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
