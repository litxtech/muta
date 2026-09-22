import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import {
  MusicFavoriteToggle,
  MusicLibraryList,
  msMetni,
  type MusicLibraryItem,
} from '../islemler/OdaMuzikApi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { supabase } from '../../../lib/supabase';
import { ODA_UST_BTN } from '../../ses-odalari/bilesenler/OdaButonOlculeri';

type Tab = 'all' | 'popular' | 'new' | 'favorites';

type Props = {
  visible: boolean;
  onClose: () => void;
  canManage: boolean;
  onSelect: (trackId: string) => void;
  onQueue?: (trackId: string) => void;
};

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'popular', label: 'Popüler' },
  { key: 'new', label: 'Yeni' },
  { key: 'favorites', label: 'Favoriler' },
];

/** Üst bar müzik butonunun altında açılan kütüphane kartı */
export function OdaMuzikKutuphanesiSheet({
  visible,
  onClose,
  canManage,
  onSelect,
  onQueue,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [liste, setListe] = useState<MusicLibraryItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const rows = await MusicLibraryList({
        query: query.trim() || undefined,
        tab,
        limit: 60,
      });
      setListe(Array.isArray(rows) ? rows : []);
    } catch {
      setListe([]);
    } finally {
      setYukleniyor(false);
    }
  }, [query, tab]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => void yukle(), query ? 280 : 0);
    return () => clearTimeout(t);
  }, [visible, yukle, query]);

  useEffect(() => {
    if (!visible) return;
    const ch = supabase
      .channel('music-library')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'music_tracks' },
        () => void yukle(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [visible, yukle]);

  // topBar margin + buton yüksekliği — kart müzik ikonunun hemen altında
  const topPad = insets.top + 6 + ODA_UST_BTN + 8;

  return (
    <TamusoModal
      visible={visible}
      onClose={onClose}
      placement="top"
      animationType="fade"
      contentStyle={{ paddingTop: topPad }}
    >
      <View style={styles.kart}>
        <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(28,22,38,0.94)', 'rgba(14,12,20,0.97)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.ustSatir}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.baslik}>Müzik</Text>
            <Text style={styles.alt}>Arka plan müziği seç</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={styles.kapat}
            hitSlop={8}
            accessibilityLabel="Kapat"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={RenkTokenlari.text} />
          </Pressable>
        </View>

        <View style={styles.araSatir}>
          <Ionicons
            name="search"
            size={16}
            color={RenkTokenlari.textDim}
            style={styles.araIkon}
          />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Müzik ara..."
            placeholderTextColor={RenkTokenlari.textDim}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={RenkTokenlari.textDim} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabAktif]}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[styles.tabYazi, tab === t.key && styles.tabYaziAktif]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {yukleniyor && liste.length === 0 ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginVertical: 28 }}
          />
        ) : (
          <FlatList
            data={liste}
            keyExtractor={(i) => i.id}
            style={styles.liste}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.bos}>Henüz müzik yok</Text>
            }
            renderItem={({ item }) => {
              const cover = MedyaUriGuvenli(item.cover_url);
              return (
                <Pressable
                  style={styles.satir}
                  onPress={() => {
                    if (!canManage) return;
                    onSelect(item.id);
                    onClose();
                  }}
                  disabled={!canManage}
                >
                  {cover ? (
                    <Image source={{ uri: cover }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover, styles.coverBos]}>
                      <Ionicons
                        name="musical-notes"
                        size={16}
                        color={RenkTokenlari.primarySoft}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.ad} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.artist_name || 'Tamuso'} · {msMetni(item.duration_ms)}
                      {item.category_name ? ` · ${item.category_name}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      void MusicFavoriteToggle(item.id).then(() => void yukle());
                    }}
                    accessibilityLabel="Favori"
                  >
                    <Ionicons
                      name={item.is_favorite ? 'heart' : 'heart-outline'}
                      size={18}
                      color={
                        item.is_favorite
                          ? RenkTokenlari.primarySoft
                          : RenkTokenlari.textDim
                      }
                    />
                  </Pressable>
                  {canManage ? (
                    <>
                      {onQueue ? (
                        <Pressable
                          hitSlop={8}
                          onPress={() => onQueue(item.id)}
                          accessibilityLabel="Kuyruğa ekle"
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={20}
                            color={RenkTokenlari.text}
                          />
                        </Pressable>
                      ) : null}
                      <Ionicons
                        name="play-circle"
                        size={26}
                        color={RenkTokenlari.primarySoft}
                      />
                    </>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
        {!canManage ? (
          <Text style={styles.hint}>
            Müzik seçmek için oda yetkisi gerekir.
          </Text>
        ) : null}
      </View>
    </TamusoModal>
  );
}

const styles = StyleSheet.create({
  kart: {
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.sm,
    maxHeight: 460,
  },
  ustSatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: BoslukTokenlari.sm,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    marginTop: 2,
  },
  kapat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  araSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.md,
    paddingHorizontal: 10,
    backgroundColor: RenkTokenlari.surface,
    marginBottom: 8,
    gap: 6,
  },
  araIkon: { marginRight: 2 },
  input: {
    flex: 1,
    paddingVertical: 10,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
  },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  tabAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.pressFill,
  },
  tabYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
  tabYaziAktif: { color: RenkTokenlari.text, fontWeight: '700' },
  liste: { maxHeight: 280 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.divider,
  },
  cover: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: RenkTokenlari.surface,
  },
  coverBos: { alignItems: 'center', justifyContent: 'center' },
  ad: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    paddingVertical: 28,
  },
  hint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
});
