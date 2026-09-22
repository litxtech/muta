import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  RaporDurumEtiketiKullanici,
  RaporumuGetir,
  type KullaniciRaporOzeti,
} from '../../src/moduller/moderasyon/okuma/RaporlarimiGetir';
import { RAPOR_DURUM_KART_NOTU_ACIK } from '../../src/moduller/moderasyon/islemler/ModerasyonIslemleri';
import { ProfilAvatarKucuk } from '../../src/moduller/canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function RaporDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rapor, setRapor] = useState<KullaniciRaporOzeti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setRapor(await RaporumuGetir(id));
      setHata(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setRapor(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const ad =
    rapor?.target?.display_name?.trim() ||
    (rapor?.target?.username ? `@${rapor.target.username}` : 'Kullanıcı');

  return (
    <Screen>
      <ModulHataSiniri modulAdi="rapor-detay">
        <EkranBasligi
          title="Rapor detayı"
          subtitle="Bildirimin · ekip notu"
          onBack={() => router.back()}
        />
        {yukleniyor && !rapor ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.govde}
            refreshControl={
              <RefreshControl
                refreshing={yukleniyor}
                onRefresh={() => void load()}
                tintColor={RenkTokenlari.primarySoft}
              />
            }
          >
            {hata ? <Text style={styles.hata}>{hata}</Text> : null}
            {rapor ? (
              <>
                <View style={styles.kart}>
                  <View style={styles.satir}>
                    <ProfilAvatarKucuk
                      avatarUrl={rapor.target?.avatar_url}
                      displayName={rapor.target?.display_name}
                      username={rapor.target?.username}
                      size={48}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.baslik}>{ad}</Text>
                      <Text style={styles.alt}>
                        {new Date(rapor.created_at).toLocaleString('tr-TR')}
                      </Text>
                    </View>
                    <View style={styles.durumChip}>
                      <Text style={styles.durumYazi}>
                        {RaporDurumEtiketiKullanici(rapor.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.etiket}>Sebep</Text>
                <View style={styles.kart}>
                  <Text style={styles.metin}>{rapor.reason}</Text>
                </View>

                {rapor.details ? (
                  <>
                    <Text style={styles.etiket}>Senin açıklaman</Text>
                    <View style={styles.kart}>
                      <Text style={styles.metin}>{rapor.details}</Text>
                    </View>
                  </>
                ) : null}

                <Text style={styles.etiket}>Ekip notu / durum</Text>
                <View style={styles.kart}>
                  <Text style={styles.metin}>
                    {rapor.reporter_note?.trim() ||
                      (rapor.status === 'open'
                        ? RAPOR_DURUM_KART_NOTU_ACIK
                        : rapor.status === 'reviewing'
                          ? 'Moderasyon ekibi inceliyor; 24 saat içinde işlem yapılacaktır.'
                          : rapor.status === 'resolved'
                            ? 'İşlem tamamlandı.'
                            : 'Rapor kapatıldı.')}
                  </Text>
                  {rapor.resolved_at ? (
                    <Text style={styles.alt}>
                      Güncelleme:{' '}
                      {new Date(rapor.resolved_at).toLocaleString('tr-TR')}
                    </Text>
                  ) : null}
                </View>

                {rapor.target?.id ? (
                  <Pressable
                    style={styles.link}
                    onPress={() =>
                      router.push(`/kullanici/${rapor.target!.id}` as any)
                    }
                  >
                    <Text style={styles.linkYazi}>Profili gör</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  govde: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: 48,
    gap: 8,
  },
  etiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    marginTop: 8,
  },
  kart: {
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 8,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  baslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  metin: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 22,
  },
  durumChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(232,64,145,0.15)',
  },
  durumYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  hata: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
  },
  link: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgCard,
  },
  linkYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
