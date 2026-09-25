import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import {
  AiMuzikParcalariGetir,
} from '../../ai-muzik/islemler/AiMuzikApi';
import type { AiMuzikTrackOzet } from '../../ai-muzik/tipler';
import { MsSureFormat } from '../../ai-muzik/utils/SureFormat';
import { MedyaUriGuvenli } from '../yardimcilar/MedyaUriGecerliMi';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSec: (track: AiMuzikTrackOzet) => void;
};

export function MesajMuzikSecimSheet({ visible, onClose, onSec }: Props) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();
  const [liste, setListe] = useState<AiMuzikTrackOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let iptal = false;
    setYukleniyor(true);
    void AiMuzikParcalariGetir({ tab: 'all', limit: 40 })
      .then((rows) => {
        if (!iptal) setListe(rows.filter((r) => r.status === 'ready' || !r.status || r.status === 'completed'));
      })
      .catch(() => {
        if (!iptal) setListe([]);
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [visible]);

  return (
    <TamusoModal
      visible={visible}
      onClose={onClose}
      placement="bottom"
      animationType="slide"
      contentStyle={styles.modalContent}
    >
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Text style={styles.baslik}>{t('mesajV2.shareMusic')}</Text>
        {yukleniyor ? (
          <ActivityIndicator color={RenkTokenlari.mint} style={{ marginVertical: 24 }} />
        ) : liste.length === 0 ? (
          <Text style={styles.bos}>{t('mesajV2.musicUnavailable')}</Text>
        ) : (
          <FlatList
            data={liste}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => {
              const cover = MedyaUriGuvenli(
                item.cover_thumb_url || item.cover_url,
              );
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onClose();
                    onSec(item);
                  }}
                >
                  {cover ? (
                    <Image source={{ uri: cover }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover, styles.coverBos]} />
                  )}
                  <View style={styles.meta}>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.sure}>
                      {MsSureFormat(item.duration_ms)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
        <Pressable style={styles.iptal} onPress={onClose}>
          <Text style={styles.iptalYazi}>{t('mesajV2.cancel')}</Text>
        </Pressable>
      </View>
    </TamusoModal>
  );
}

const styles = StyleSheet.create({
  modalContent: { maxHeight: '70%' },
  sheet: {
    backgroundColor: RenkTokenlari.bgCard,
    borderTopLeftRadius: YaricapTokenlari.lg,
    borderTopRightRadius: YaricapTokenlari.lg,
    paddingTop: 14,
    paddingHorizontal: 12,
    minHeight: 280,
  },
  baslik: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
    color: RenkTokenlari.text,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  list: { maxHeight: 360 },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginVertical: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: RenkTokenlari.pressFill,
  },
  coverBos: {},
  meta: { flex: 1, gap: 2 },
  title: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  sure: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  iptal: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  iptalYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
});
