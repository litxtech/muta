import React from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { DirektMesaj } from '../okuma/MesajlariGetir';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

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

/** Telegram tarzi baloncuk — metin / resim / video */
export function MesajBaloncugu({ item, mine, onLongPress }: Props) {
  const sending = item._localStatus === 'sending';
  const failed = item._localStatus === 'failed';
  const isImage = item.message_type === 'image' && !!item.media_url;
  const isVideo = item.message_type === 'video' && !!item.media_url;
  const isSystem = item.message_type === 'system';

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
      {item.body ? (
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
    color: '#12040C',
    fontWeight: '600',
    lineHeight: 21,
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
    color: '#fff',
    fontWeight: '700',
  },
  system: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  systemText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
