/**
 * Mesajlar → Görüşmeler sekmesi: devam eden + geçmiş, silinebilir.
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GorusmeGecmisiniGetir,
  GorusmeGecmisSil,
  type GorusmeGecmisKayit,
} from '../islemler/GorusmeIslemleri';
import { GorusmeOturumAl, GorusmeOturumSunumAyarla } from '../oturum/GorusmeOturumYoneticisi';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

function formatTarih(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const saat = d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (sameDay) return `Bugün · ${saat}`;
  return `${d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })} · ${saat}`;
}

function durumEtiket(k: GorusmeGecmisKayit): string {
  if (k.is_ongoing) {
    return k.status === 'ringing' ? 'Aranıyor…' : 'Devam ediyor';
  }
  switch (k.status) {
    case 'missed':
      return 'Cevapsız';
    case 'rejected':
      return 'Reddedildi';
    case 'cancelled':
      return 'İptal';
    case 'ended':
      return k.is_outgoing ? 'Giden' : 'Gelen';
    default:
      return k.status;
  }
}

type Props = {
  misafir?: boolean;
};

export function GorusmeGecmisPaneli({ misafir }: Props) {
  const [liste, setListe] = useState<GorusmeGecmisKayit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);

  const yukle = useCallback(async (pull = false) => {
    if (misafir) {
      setListe([]);
      return;
    }
    try {
      if (pull) setYenileniyor(true);
      else setYukleniyor(true);
      const data = await GorusmeGecmisiniGetir(120);
      setListe(data);
    } catch {
      setListe([]);
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, [misafir]);

  useFocusEffect(
    useCallback(() => {
      void yukle(false);
    }, [yukle]),
  );

  const ac = (k: GorusmeGecmisKayit) => {
    if (k.is_ongoing) {
      const yerel = GorusmeOturumAl();
      if (yerel?.callId === k.id) {
        GorusmeOturumSunumAyarla('fullscreen');
      }
      router.push(`/gorusme/${k.id}` as any);
      return;
    }
    if (k.thread_id) {
      router.push(`/mesaj/${k.thread_id}` as any);
    }
  };

  const sil = (k: GorusmeGecmisKayit) => {
    Alert.alert(
      'Görüşmeyi sil',
      'Bu kayıt yalnızca senden silinir. Karşı tarafın geçmişi etkilenmez.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const r = await GorusmeGecmisSil(k.id);
              if (!r.ok) Alert.alert('Silinemedi', r.hata);
              else await yukle(false);
            })();
          },
        },
      ],
    );
  };

  if (misafir) {
    return (
      <View style={styles.bos}>
        <Text style={styles.bosYazi}>Görüşme geçmişi için hesabını tamamla</Text>
      </View>
    );
  }

  const devam = liste.filter((k) => k.is_ongoing);
  const gecmis = liste.filter((k) => !k.is_ongoing);

  return (
    <FlatList
      data={[
        ...(devam.length
          ? ([{ __tip: 'baslik', id: '__devam', yazi: 'Devam eden' }] as const)
          : []),
        ...devam.map((k) => ({ __tip: 'kayit' as const, ...k })),
        ...(gecmis.length
          ? ([{ __tip: 'baslik', id: '__gecmis', yazi: 'Geçmiş' }] as const)
          : []),
        ...gecmis.map((k) => ({ __tip: 'kayit' as const, ...k })),
      ]}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={yenileniyor}
          onRefresh={() => void yukle(true)}
          tintColor={RenkTokenlari.primary}
        />
      }
      contentContainerStyle={[
        styles.list,
        liste.length === 0 && styles.listEmpty,
      ]}
      ListEmptyComponent={
        <View style={styles.bos}>
          <Ionicons
            name="call-outline"
            size={36}
            color={RenkTokenlari.textDim}
          />
          <Text style={styles.bosYazi}>
            {yukleniyor ? 'Yükleniyor…' : 'Henüz görüşme yok'}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.__tip === 'baslik') {
          return (
            <Text style={styles.bolum}>
              {'yazi' in item ? item.yazi : ''}
            </Text>
          );
        }
        const k = item as GorusmeGecmisKayit & { __tip: 'kayit' };
        const ad =
          k.peer_display_name?.trim() ||
          k.peer_username?.trim() ||
          'Kullanıcı';
        const harf = ad.charAt(0).toLocaleUpperCase('tr-TR');
        const avatar = MedyaUriGuvenli(k.peer_avatar_url);
        const video = k.call_type === 'video';

        return (
          <Pressable
            onPress={() => ac(k)}
            onLongPress={() => sil(k)}
            delayLongPress={350}
            style={({ pressed }) => [styles.satir, pressed && styles.pressed]}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                style={styles.avatar}
              >
                <Text style={styles.harf}>{harf}</Text>
              </LinearGradient>
            )}
            <View style={styles.orta}>
              <Text style={styles.ad} numberOfLines={1}>
                {ad}
              </Text>
              <View style={styles.meta}>
                <Ionicons
                  name={
                    k.is_outgoing
                      ? 'arrow-up-outline'
                      : 'arrow-down-outline'
                  }
                  size={12}
                  color={
                    k.status === 'missed'
                      ? RenkTokenlari.danger
                      : RenkTokenlari.textDim
                  }
                />
                <Ionicons
                  name={video ? 'videocam' : 'call'}
                  size={12}
                  color={RenkTokenlari.textDim}
                />
                <Text
                  style={[
                    styles.durum,
                    k.is_ongoing && styles.durumCanli,
                    k.status === 'missed' && styles.durumKacirilan,
                  ]}
                  numberOfLines={1}
                >
                  {durumEtiket(k)}
                </Text>
              </View>
            </View>
            <View style={styles.sag}>
              <Text style={styles.tarih}>
                {formatTarih(k.is_ongoing ? k.started_at : k.ended_at || k.started_at)}
              </Text>
              <Pressable
                onPress={() => sil(k)}
                hitSlop={10}
                accessibilityLabel="Sil"
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={RenkTokenlari.textDim}
                />
              </Pressable>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: 120,
  },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  bolum: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.sm,
    paddingHorizontal: 4,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
  },
  orta: { flex: 1, minWidth: 0, gap: 4 },
  ad: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  durum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flexShrink: 1,
  },
  durumCanli: { color: RenkTokenlari.mint, fontWeight: '700' },
  durumKacirilan: { color: RenkTokenlari.danger },
  sag: { alignItems: 'flex-end', gap: 8 },
  tarih: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  bos: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 48,
  },
  bosYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
});
