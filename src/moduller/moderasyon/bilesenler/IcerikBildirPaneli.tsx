import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BILDIRME_SEBEPLERI,
  BildirmeSebebiEtiketi,
  KullaniciBildir,
  RaporAlindiMesaj,
} from '../islemler/ModerasyonIslemleri';
import { useCeviri } from '../../../i18n/useCeviri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type IcerikBildirTuru = 'room' | 'live';

type Props = {
  visible: boolean;
  onClose: () => void;
  tur: IcerikBildirTuru;
  /** Oda id veya canlı yayın session id */
  contentId: string;
  /** Ses odası için room_id (live’da genelde null) */
  roomId?: string | null;
  /** Host / yayıncı */
  targetUserId?: string | null;
  title?: string | null;
  isGuest?: boolean;
  onReported?: () => void;
};

/**
 * Ses odası / canlı yayın bildir — sebep seç → gönder.
 */
export function IcerikBildirPaneli({
  visible,
  onClose,
  tur,
  contentId,
  roomId,
  targetUserId,
  title,
  isGuest,
  onReported,
}: Props) {
  const { t } = useCeviri();
  const [sebepId, setSebepId] = useState<string | null>(null);
  const [detay, setDetay] = useState('');
  const [busy, setBusy] = useState(false);

  const kapat = () => {
    setSebepId(null);
    setDetay('');
    onClose();
  };

  const gonder = async () => {
    if (!sebepId) {
      Alert.alert(t('bildir.baslik'), t('moderasyon.sebepSec'));
      return;
    }
    if (!contentId) {
      Alert.alert(t('bildir.baslik'), t('moderasyon.icerikBulunamadi'));
      return;
    }

    const etiket = BildirmeSebebiEtiketi(sebepId);
    setBusy(true);
    const r = await KullaniciBildir({
      reason: etiket,
      reasonCode: sebepId,
      targetUserId: targetUserId ?? undefined,
      roomId: tur === 'room' ? contentId : roomId ?? undefined,
      details: detay.trim() || undefined,
      contentType: tur === 'room' ? 'room' : 'live',
      contentId,
      context: {
        title: title ?? null,
        source: tur === 'room' ? 'voice_room' : 'live_stream',
        host_id: targetUserId ?? null,
      },
    });
    setBusy(false);
    if (!r.ok) {
      Alert.alert(
        t('bildir.baslik'),
        r.hata ?? t('moderasyon.gonderilemedi'),
      );
      return;
    }
    Alert.alert(t('guvenlik.raporAlindi'), RaporAlindiMesaj(), [
      {
        text: t('ortak.tamam'),
        onPress: () => {
          onReported?.();
          kapat();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={kapat}>
      <Pressable style={styles.backdrop} onPress={kapat}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {busy ? (
            <ActivityIndicator
              color={RenkTokenlari.primarySoft}
              style={{ marginVertical: 24 }}
            />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>{t('bildir.baslik')}</Text>
              <Text style={styles.hint}>
                {tur === 'room' ? t('moderasyon.odaNeden') : t('moderasyon.canliNeden')}
                {title ? `\n“${title}”` : ''}
              </Text>
              {BILDIRME_SEBEPLERI.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.sebep, sebepId === s.id && styles.sebepAktif]}
                  onPress={() => setSebepId(s.id)}
                >
                  <Text
                    style={[
                      styles.sebepText,
                      sebepId === s.id && styles.sebepTextAktif,
                    ]}
                  >
                    {BildirmeSebebiEtiketi(s.id)}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                value={detay}
                onChangeText={setDetay}
                placeholder={t('moderasyon.ekDetay')}
                placeholderTextColor={RenkTokenlari.textDim}
                style={styles.input}
                multiline
                maxLength={500}
              />
              <Pressable style={styles.gonder} onPress={() => void gonder()}>
                <Text style={styles.gonderText}>{t('moderasyon.raporuGonder')}</Text>
              </Pressable>
              <Pressable style={styles.vazgec} onPress={kapat}>
                <Text style={styles.vazgecText}>{t('ortak.vazgec')}</Text>
              </Pressable>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: RenkTokenlari.bgCard,
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    padding: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxl,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    maxHeight: '85%',
  },
  title: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginBottom: 4,
  },
  hint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginBottom: BoslukTokenlari.md,
  },
  sebep: {
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: BoslukTokenlari.sm,
    backgroundColor: RenkTokenlari.surface,
  },
  sebepAktif: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232,64,145,0.12)',
  },
  sebepText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
  },
  sebepTextAktif: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  input: {
    minHeight: 72,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    color: RenkTokenlari.text,
    padding: BoslukTokenlari.md,
    marginVertical: BoslukTokenlari.md,
    textAlignVertical: 'top',
  },
  gonder: {
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: BoslukTokenlari.md,
    alignItems: 'center',
    marginBottom: BoslukTokenlari.sm,
  },
  gonderText: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  vazgec: {
    paddingVertical: BoslukTokenlari.md,
    alignItems: 'center',
  },
  vazgecText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
  },
});
