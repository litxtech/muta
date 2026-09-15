import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKlavyeYuksekligi } from '../../../bilesenler/klavye/useKlavyeYuksekligi';
import { ProfilAvatarKucuk } from '../../canli-sohbet/bilesenler/ProfilAvatarKucuk';
import {
  DurumYorumEkle,
  DurumYorumSil,
  DurumYorumlariGetir,
  type DurumYorum,
} from '../islemler/DurumIslemleri';
import { DurumTarihSaat } from '../islemler/DurumZaman';
import { KullaniciGuvenlikMenusu } from '../../moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  visible: boolean;
  statusId: string;
  canModerate?: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onProfil?: (userId: string) => void;
};

export function DurumYorumPaneli({
  visible,
  statusId,
  canModerate,
  onClose,
  onChanged,
  onProfil,
}: Props) {
  const insets = useSafeAreaInsets();
  const { yukseklik: klavyeH, acik: klavyeAcik } = useKlavyeYuksekligi(0);
  const [yorumlar, setYorumlar] = useState<DurumYorum[]>([]);
  const [metin, setMetin] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bildirYorum, setBildirYorum] = useState<DurumYorum | null>(null);

  const yukle = async () => {
    setYukleniyor(true);
    try {
      setYorumlar(await DurumYorumlariGetir(statusId));
    } catch {
      setYorumlar([]);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    if (visible) void yukle();
  }, [visible, statusId]);

  const gonder = async () => {
    if (!metin.trim() || busy) return;
    setBusy(true);
    const r = await DurumYorumEkle(statusId, metin.trim());
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Yorum', r.hata ?? 'Gönderilemedi');
      return;
    }
    setMetin('');
    await yukle();
    onChanged?.();
  };

  const sil = (y: DurumYorum) => {
    if (!y.is_mine && !canModerate) return;
    Alert.alert('Yorumu sil', 'Bu yorum silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await DurumYorumSil(y.id);
            if (!r.ok) Alert.alert('Yorum', r.hata ?? 'Silinemedi');
            else {
              await yukle();
              onChanged?.();
            }
          })();
        },
      },
    ]);
  };

  const yorumMenu = (y: DurumYorum) => {
    if (y.is_mine || canModerate) {
      Alert.alert('Yorum', undefined, [
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => sil(y),
        },
        { text: 'Vazgeç', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('Yorum', undefined, [
      {
        text: 'Bildir',
        style: 'destructive',
        onPress: () => setBildirYorum(y),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View
            style={[
              styles.sheet,
              {
                marginBottom:
                  Platform.OS === 'android' && klavyeAcik ? klavyeH : 0,
                paddingBottom: klavyeAcik
                  ? Platform.OS === 'android'
                    ? BoslukTokenlari.md
                    : Math.max(BoslukTokenlari.md, klavyeH)
                  : Math.max(BoslukTokenlari.lg, insets.bottom + 8),
              },
            ]}
          >
            <View style={styles.handle} />
            <Text style={styles.baslik}>Yorumlar</Text>

            {yukleniyor && !yorumlar.length ? (
              <ActivityIndicator
                color={RenkTokenlari.primarySoft}
                style={{ marginTop: 24 }}
              />
            ) : (
              <FlatList
                data={yorumlar}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                  <Text style={styles.bos}>Henüz yorum yok</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.satir}>
                    <Pressable
                      style={styles.satirSol}
                      onPress={() => onProfil?.(item.user_id)}
                      onLongPress={() => yorumMenu(item)}
                    >
                      <ProfilAvatarKucuk
                        size={36}
                        displayName={item.display_name}
                        username={item.username}
                        avatarUrl={item.avatar_url}
                      />
                      <View style={styles.satirGovde}>
                        <Text style={styles.satirIsim}>
                          {item.display_name}
                          <Text style={styles.satirZaman}>
                            {'  '}
                            {DurumTarihSaat(item.created_at)}
                          </Text>
                        </Text>
                        <Text style={styles.satirBody}>{item.body}</Text>
                      </View>
                    </Pressable>
                    {item.is_mine || canModerate ? (
                      <Pressable onPress={() => sil(item)} hitSlop={10}>
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={RenkTokenlari.textDim}
                        />
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => yorumMenu(item)} hitSlop={10}>
                        <Ionicons
                          name="flag-outline"
                          size={16}
                          color={RenkTokenlari.textDim}
                        />
                      </Pressable>
                    )}
                  </View>
                )}
              />
            )}

            <View style={styles.inputSatir}>
              <TextInput
                style={styles.input}
                value={metin}
                onChangeText={setMetin}
                placeholder="Yorum yaz…"
                placeholderTextColor={RenkTokenlari.textDim}
                maxLength={500}
              />
              <Pressable
                style={[styles.gonder, !metin.trim() && { opacity: 0.4 }]}
                onPress={() => void gonder()}
                disabled={!metin.trim() || busy}
              >
                <Ionicons name="send" size={18} color="#12040C" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {bildirYorum ? (
        <KullaniciGuvenlikMenusu
          visible
          targetUserId={bildirYorum.user_id}
          targetName={bildirYorum.display_name}
          contentType="status_comment"
          contentId={bildirYorum.id}
          contentPreview={bildirYorum.body}
          onClose={() => setBildirYorum(null)}
          onReported={() =>
            Alert.alert(
              'Bildirim alındı',
              'Raporunuz incelenecek. Teşekkürler.',
            )
          }
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 1,
    elevation: 1,
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    zIndex: 3,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.border,
    marginTop: 10,
    marginBottom: 8,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: 12,
    gap: 12,
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    marginTop: 24,
  },
  satir: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  satirSol: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    minWidth: 0,
  },
  satirGovde: { flex: 1, minWidth: 0 },
  satirIsim: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  satirZaman: {
    fontWeight: '500',
    color: RenkTokenlari.textDim,
  },
  satirBody: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    marginTop: 2,
  },
  inputSatir: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    paddingHorizontal: 12,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
  },
  gonder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: RenkTokenlari.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
