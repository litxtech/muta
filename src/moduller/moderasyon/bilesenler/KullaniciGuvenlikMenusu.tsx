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
  KullaniciBildir,
  KullaniciEngelle,
} from '../islemler/ModerasyonIslemleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  visible: boolean;
  targetUserId: string;
  targetName?: string | null;
  roomId?: string | null;
  contentType?:
    | 'user'
    | 'dm_message'
    | 'room_chat'
    | 'live_chat'
    | 'room'
    | 'profile'
    | 'status_post'
    | 'status_comment'
    | 'other';
  contentId?: string | null;
  contentPreview?: string | null;
  contentMediaUrl?: string | null;
  onClose: () => void;
  onBlocked?: () => void;
  onReported?: () => void;
};

/**
 * Apple / Google uyumlu: Engelle + Bildir menusu
 */
export function KullaniciGuvenlikMenusu({
  visible,
  targetUserId,
  targetName,
  roomId,
  contentType,
  contentId,
  contentPreview,
  contentMediaUrl,
  onClose,
  onBlocked,
  onReported,
}: Props) {
  const [adim, setAdim] = useState<'menu' | 'bildir'>('menu');
  const [sebepId, setSebepId] = useState<string | null>(null);
  const [detay, setDetay] = useState('');
  const [busy, setBusy] = useState(false);

  const kapat = () => {
    setAdim('menu');
    setSebepId(null);
    setDetay('');
    onClose();
  };

  const engelle = () => {
    Alert.alert(
      'Engelle',
      `${targetName ?? 'Bu kişi'} engellenecek. Sizi platformda bulamaz, mesaj / arama / takip yapamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await KullaniciEngelle(targetUserId);
              setBusy(false);
              if (!r.ok) {
                Alert.alert('Engelle', r.hata ?? 'Başarısız');
                return;
              }
              Alert.alert('Engellendi', 'Engeli Profil → Engellenen kullanıcılar’dan kaldırabilirsin.');
              onBlocked?.();
              kapat();
            })();
          },
        },
      ],
    );
  };

  const bildir = async () => {
    if (!sebepId) {
      Alert.alert('Bildir', 'Bir sebep seç.');
      return;
    }
    const etiket =
      BILDIRME_SEBEPLERI.find((s) => s.id === sebepId)?.label ?? sebepId;
    setBusy(true);
    const r = await KullaniciBildir({
      reason: etiket,
      reasonCode: sebepId,
      targetUserId,
      roomId: roomId ?? undefined,
      details: detay.trim() || contentPreview || undefined,
      contentType: contentType ?? (contentId ? 'other' : 'user'),
      contentId: contentId ?? undefined,
      context: {
        body: (contentPreview ?? detay.trim()) || null,
        media_url: contentMediaUrl ?? null,
        target_name: targetName ?? null,
      },
    });
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Bildir', r.hata ?? 'Gönderilemedi');
      return;
    }
    Alert.alert(
      'Rapor alındı',
      'İnceleme ekibine iletildi. İstersen bu kişiyi de engelleyebilirsin.',
      [
        { text: 'Tamam', onPress: () => { onReported?.(); kapat(); } },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await KullaniciEngelle(targetUserId);
              onBlocked?.();
              onReported?.();
              kapat();
            })();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={kapat}>
      <Pressable style={styles.backdrop} onPress={kapat}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {busy ? (
            <ActivityIndicator color={RenkTokenlari.primarySoft} style={{ marginVertical: 24 }} />
          ) : adim === 'menu' ? (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {targetName ?? 'Kullanıcı'}
              </Text>
              <Text style={styles.hint}>
                Apple ve Google kurallarına uygun güvenlik işlemleri
              </Text>
              <Pressable style={styles.row} onPress={() => setAdim('bildir')}>
                <Text style={styles.rowText}>Bildir</Text>
              </Pressable>
              <Pressable style={[styles.row, styles.rowDanger]} onPress={engelle}>
                <Text style={[styles.rowText, styles.danger]}>Engelle</Text>
              </Pressable>
              <Pressable style={styles.row} onPress={kapat}>
                <Text style={styles.rowMuted}>Vazgeç</Text>
              </Pressable>
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Bildir</Text>
              <Text style={styles.hint}>Ne için raporluyorsun?</Text>
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
                    {s.label}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                value={detay}
                onChangeText={setDetay}
                placeholder="Ek detay (isteğe bağlı)"
                placeholderTextColor={RenkTokenlari.textDim}
                style={styles.input}
                multiline
                maxLength={500}
              />
              <Pressable style={styles.gonder} onPress={() => void bildir()}>
                <Text style={styles.gonderText}>Raporu gönder</Text>
              </Pressable>
              <Pressable style={styles.row} onPress={() => setAdim('menu')}>
                <Text style={styles.rowMuted}>Geri</Text>
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
    zIndex: 3,
    elevation: 24,
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
  row: {
    paddingVertical: BoslukTokenlari.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
  },
  rowDanger: {},
  rowText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  danger: { color: RenkTokenlari.danger },
  rowMuted: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
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
});
