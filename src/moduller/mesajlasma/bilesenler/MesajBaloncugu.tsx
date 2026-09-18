import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { DirektMesaj } from '../okuma/MesajlariGetir';
import { HostBasvurusuOlustur } from '../../hostlar/islemler/HostBasvuruIslemleri';
import { AjansDavetMesajindanKoduCikar } from '../../ajanslar/yardimcilar/AjansDavetMesajindanKoduCikar';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  item: DirektMesaj;
  mine: boolean;
  onLongPress?: () => void;
};

function saat(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Telegram tarzi baloncuk — metin / resim / video / ajans daveti */
export function MesajBaloncugu({ item, mine, onLongPress }: Props) {
  const sending = item._localStatus === 'sending';
  const failed = item._localStatus === 'failed';
  const isImage = item.message_type === 'image' && !!item.media_url;
  const isVideo = item.message_type === 'video' && !!item.media_url;
  const isSystem = item.message_type === 'system';
  const davet = AjansDavetMesajindanKoduCikar(item.body);
  const [davetBusy, setDavetBusy] = useState(false);
  const [davetGonderildi, setDavetGonderildi] = useState(false);

  const davetiKabulEt = () => {
    if (!davet || mine || davetBusy || davetGonderildi) return;
    const baslik = davet.ajansAdi
      ? `${davet.ajansAdi} ajansına katıl`
      : 'Ajans davetini kabul et';
    Alert.alert(
      baslik,
      `Davet kodu ile ajansa katılım başvurusu gönderilsin mi?\nKod: ${davet.kod}`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kabul et',
          onPress: () => {
            void (async () => {
              setDavetBusy(true);
              const r = await HostBasvurusuOlustur({
                path: 'join_agency',
                inviteCode: davet.kod,
              });
              setDavetBusy(false);
              if (!r.ok) {
                Alert.alert('Davet', r.hata ?? 'Başvuru gönderilemedi.');
                return;
              }
              setDavetGonderildi(true);
              Alert.alert(
                'Başvuru gönderildi',
                'Ajans onaylayınca profilinde ajansın görünür ve üye panelin açılır.',
                [
                  {
                    text: 'Panele git',
                    onPress: () => router.push('/ajans/uye' as any),
                  },
                ],
              );
            })();
          },
        },
      ],
    );
  };

  if (isSystem) {
    return (
      <View style={styles.system}>
        <Text style={styles.systemText}>{item.body}</Text>
      </View>
    );
  }

  const icerik = (
    <>
      {isImage ? (
        <Pressable onPress={() => void Linking.openURL(item.media_url!)}>
          <Image source={{ uri: item.media_url! }} style={styles.media} />
        </Pressable>
      ) : null}
      {isVideo ? (
        <Pressable
          style={styles.videoBox}
          onPress={() => void Linking.openURL(item.media_url!)}
        >
          <Ionicons name="play-circle" size={48} color="#fff" />
          <Text style={styles.videoHint}>Videoyu aç</Text>
        </Pressable>
      ) : null}
      {davet && !isImage && !isVideo ? (
        <View style={mine ? styles.davetKartMine : styles.davetKart}>
          <View style={styles.davetBaslikSatir}>
            <Ionicons
              name="briefcase-outline"
              size={18}
              color={mine ? 'rgba(18,4,12,0.85)' : RenkTokenlari.primarySoft}
            />
            <Text
              style={mine ? styles.davetBaslikMine : styles.davetBaslik}
              numberOfLines={2}
            >
              {davet.ajansAdi
                ? `${davet.ajansAdi} ajans daveti`
                : 'Ajans daveti'}
            </Text>
          </View>
          <Text style={mine ? styles.davetKodMine : styles.davetKod}>
            Kod: {davet.kod}
          </Text>
          {!mine ? (
            <Pressable
              onPress={davetiKabulEt}
              disabled={davetBusy || davetGonderildi}
              style={[
                styles.davetCta,
                (davetBusy || davetGonderildi) && styles.davetCtaDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Daveti kabul et"
            >
              <Text style={styles.davetCtaYazi}>
                {davetGonderildi
                  ? 'Başvuru gönderildi'
                  : davetBusy
                    ? 'Gönderiliyor…'
                    : 'Daveti kabul et'}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.davetMineHint}>Davet gönderildi</Text>
          )}
        </View>
      ) : item.body ? (
        <Text style={mine ? styles.bodyMine : styles.body}>{item.body}</Text>
      ) : null}
      <View style={styles.meta}>
        <Text style={mine ? styles.timeMine : styles.time}>
          {saat(item.created_at)}
        </Text>
        {mine ? (
          <Ionicons
            name={
              failed
                ? 'alert-circle'
                : sending
                  ? 'time-outline'
                  : 'checkmark-done'
            }
            size={14}
            color={failed ? RenkTokenlari.danger : 'rgba(18,4,12,0.55)'}
          />
        ) : null}
      </View>
    </>
  );

  if (mine) {
    return (
      <Pressable onLongPress={onLongPress} delayLongPress={300}>
        <LinearGradient
          colors={[...RenkTokenlari.gradientPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.mine, sending && styles.sending]}
        >
          {icerik}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[styles.bubble, styles.theirs]}
    >
      {icerik}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '82%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 4,
  },
  mine: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderBottomLeftRadius: 4,
  },
  sending: { opacity: 0.7 },
  body: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 21,
  },
  bodyMine: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '600',
    lineHeight: 21,
  },
  davetKart: {
    gap: 8,
    paddingVertical: 4,
    minWidth: 200,
  },
  davetKartMine: {
    gap: 8,
    paddingVertical: 4,
    minWidth: 200,
  },
  davetBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  davetBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    flex: 1,
  },
  davetBaslikMine: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '700',
    flex: 1,
  },
  davetKod: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    letterSpacing: 0.6,
  },
  davetKodMine: {
    ...TipografiTokenlari.caption,
    color: 'rgba(18,4,12,0.7)',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  davetCta: {
    marginTop: 2,
    alignSelf: 'stretch',
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: RenkTokenlari.primary,
    alignItems: 'center',
  },
  davetCtaDisabled: {
    opacity: 0.55,
  },
  davetCtaYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  davetMineHint: {
    ...TipografiTokenlari.micro,
    color: 'rgba(18,4,12,0.55)',
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  time: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
  },
  timeMine: {
    ...TipografiTokenlari.micro,
    color: 'rgba(18,4,12,0.55)',
    fontSize: 10,
  },
  media: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  videoBox: {
    width: 220,
    height: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  videoHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
  },
  system: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.pressFill,
    marginVertical: 4,
  },
  systemText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
