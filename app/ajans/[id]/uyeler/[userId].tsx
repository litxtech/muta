import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  AjansAltEkranKabuk,
  AjansBolumBaslik,
  AjansCta,
  AjansHint,
  AjansInput,
  AjansKart,
} from '../../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import { useAjansRouteId } from '../../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansCrmGuncelle,
  AjansStaffAta,
  AjansUyeDetayGetir,
} from '../../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import { RenkTokenlari } from '../../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../src/tasarim-sistemi/TipografiTokenlari';

export default function AjansUyeDetayEkrani() {
  const agencyId = useAjansRouteId();
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const [detay, setDetay] = useState<Record<string, unknown> | null>(null);
  const [notlar, setNotlar] = useState('');
  const [etiket, setEtiket] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!agencyId || !userId) return;
    setYukleniyor(true);
    try {
      const d = await AjansUyeDetayGetir(agencyId, userId);
      setDetay(d);
      const crm = d.crm as { notes?: string; tags?: string[] } | null;
      setNotlar(crm?.notes ?? '');
      setEtiket((crm?.tags ?? []).join(', '));
    } catch (e) {
      Alert.alert('Üye', e instanceof Error ? e.message : 'Yüklenemedi');
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [agencyId, userId]);

  useFocusEffect(useCallback(() => { void yukle(); }, [yukle]));

  const profile = detay?.profile as {
    display_name?: string;
    username?: string;
    public_user_id?: string;
  } | undefined;
  const crm = detay?.crm as { agency_status?: string; onboarding_stage?: string } | null;
  const aktivite = detay?.aktivite as {
    ses_dakika_ay?: number;
    yayin_dakika_ay?: number;
    son_aktif?: string;
  } | undefined;
  const audit = (detay?.audit as Array<{ summary: string; created_at: string }>) ?? [];

  return (
    <AjansAltEkranKabuk
      agencyId={agencyId}
      title="Üye Detayı"
      subtitle={profile?.display_name || profile?.username || 'CRM'}
      aktif="uyeler"
      yukleniyor={yukleniyor && !detay}
      refreshing={yukleniyor && !!detay}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Genel</AjansBolumBaslik>
      <AjansKart>
        <Text style={styles.ad}>{profile?.display_name || '—'}</Text>
        <Text style={styles.alt}>@{profile?.username || '—'} · ID {profile?.public_user_id || '—'}</Text>
        <Text style={styles.alt}>
          Rol: {String(detay?.role ?? 'MEMBER')} · Durum: {crm?.agency_status ?? 'active'}
        </Text>
        <Text style={styles.alt}>Onboarding: {crm?.onboarding_stage ?? 'active'}</Text>
      </AjansKart>

      <AjansBolumBaslik>Aktivite</AjansBolumBaslik>
      <AjansKart>
        <Text style={styles.alt}>Ses (ay): {aktivite?.ses_dakika_ay ?? 0} dk</Text>
        <Text style={styles.alt}>Yayın (ay): {aktivite?.yayin_dakika_ay ?? 0} dk</Text>
        <Text style={styles.alt}>
          Son aktif: {aktivite?.son_aktif ? new Date(aktivite.son_aktif).toLocaleString('tr-TR') : 'Henüz veri yok'}
        </Text>
      </AjansKart>

      <AjansBolumBaslik>Notlar / Etiketler</AjansBolumBaslik>
      <AjansKart>
        <AjansInput
          value={notlar}
          onChangeText={setNotlar}
          placeholder="Ajans içi not (public değil)"
          multiline
        />
        <AjansInput
          value={etiket}
          onChangeText={setEtiket}
          placeholder="Etiketler (virgülle: Yeni Host, Gece Ekibi)"
        />
        <AjansCta
          label="CRM Kaydet"
          onPress={() => {
            void (async () => {
              const r = await AjansCrmGuncelle({
                agencyId,
                userId: userId!,
                notes: notlar,
                tags: etiket
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              });
              if (!r.ok) Alert.alert('CRM', r.hata);
              else {
                Alert.alert('Tamam', 'Kaydedildi');
                await yukle();
              }
            })();
          }}
        />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {['active', 'trial', 'leave', 'suspended'].map((s) => (
            <AjansCta
              key={s}
              ghost
              label={s}
              onPress={() => {
                void (async () => {
                  const r = await AjansCrmGuncelle({
                    agencyId,
                    userId: userId!,
                    agencyStatus: s,
                  });
                  if (!r.ok) Alert.alert('Durum', r.hata);
                  else await yukle();
                })();
              }}
            />
          ))}
        </View>
        <AjansCta
          ghost
          label="HOST_MANAGER Yap"
          onPress={() => {
            void (async () => {
              const r = await AjansStaffAta({
                agencyId,
                userId: userId!,
                roleCode: 'HOST_MANAGER',
              });
              if (!r.ok) Alert.alert('Rol', r.hata);
              else Alert.alert('Tamam', 'Rol atandı');
            })();
          }}
        />
      </AjansKart>

      <AjansBolumBaslik>Geçmiş</AjansBolumBaslik>
      <AjansKart>
        {audit.length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          audit.map((a, i) => (
            <Text key={i} style={styles.alt}>
              {new Date(a.created_at).toLocaleString('tr-TR')} · {a.summary}
            </Text>
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}

const styles = StyleSheet.create({
  ad: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  alt: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
});
