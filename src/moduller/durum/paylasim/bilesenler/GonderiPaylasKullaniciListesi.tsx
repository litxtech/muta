import React, { memo } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfilAvatarKucuk } from '../../../canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { MedyaUriGuvenli } from '../../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import type { GonderiPaylasAlici } from '../tipler';

type Props = {
  items: GonderiPaylasAlici[];
  secilen: Set<string>;
  onToggle: (id: string) => void;
  bosMetin?: string;
};

function satir({
  item,
  secili,
  onToggle,
}: {
  item: GonderiPaylasAlici;
  secili: boolean;
  onToggle: (id: string) => void;
}) {
  const avatar = MedyaUriGuvenli(item.avatar_url);
  return (
    <Pressable
      style={styles.satir}
      onPress={() => onToggle(item.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: secili }}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <ProfilAvatarKucuk
          size={44}
          displayName={item.display_name}
          username={item.username}
          avatarUrl={item.avatar_url}
        />
      )}
      <View style={styles.metin}>
        <Text style={styles.isim} numberOfLines={1}>
          {item.display_name}
        </Text>
        {item.username ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{item.username}
          </Text>
        ) : null}
      </View>
      <View style={[styles.check, secili && styles.checkOn]}>
        {secili ? (
          <Ionicons name="checkmark" size={16} color="#fff" />
        ) : null}
      </View>
    </Pressable>
  );
}

function GonderiPaylasKullaniciListesiIc({
  items,
  secilen,
  onToggle,
  bosMetin = 'Kullanıcı bulunamadı',
}: Props) {
  if (items.length === 0) {
    return (
      <View style={styles.bos}>
        <Text style={styles.bosYazi}>{bosMetin}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) =>
        satir({
          item,
          secili: secilen.has(item.id),
          onToggle,
        })
      }
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      style={styles.liste}
    />
  );
}

export const GonderiPaylasKullaniciListesi = memo(
  GonderiPaylasKullaniciListesiIc,
);

const styles = StyleSheet.create({
  liste: { flexGrow: 0 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RenkTokenlari.pressFill,
  },
  metin: { flex: 1, minWidth: 0, gap: 2 },
  isim: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  handle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: RenkTokenlari.primary,
    borderColor: RenkTokenlari.primary,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
    marginLeft: 56,
  },
  bos: { paddingVertical: 28, alignItems: 'center' },
  bosYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
});
