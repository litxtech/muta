import React, { useEffect, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  KullanicilariAra,
  type ArananKullanici,
} from '../okuma/KullanicilariAra';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { MedyaUriGuvenli } from '../yardimcilar/MedyaUriGecerliMi';
import { DogrulanmisTik } from '../../kullanici-profili/bilesenler/DogrulanmisTik';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  haricUserId?: string | null;
  onSec: (kullanici: ArananKullanici) => void;
  seciliyor?: boolean;
};

/** Yeni sohbet — yazdıkça öneri (ilk harften) */
export function MesajKullaniciAramaPaneli({
  haricUserId,
  onSec,
  seciliyor,
}: Props) {
  const { t } = useCeviri();
  const [sorgu, setSorgu] = useState('');
  const [sonuclar, setSonuclar] = useState<ArananKullanici[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const istekNo = useRef(0);

  useEffect(() => {
    const q = sorgu.trim();
    if (q.length < 1) {
      setSonuclar([]);
      setYukleniyor(false);
      setHata(null);
      return;
    }

    const no = ++istekNo.current;
    setYukleniyor(true);
    setHata(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const liste = await KullanicilariAra({
            sorgu: q,
            haricUserId,
            limit: 24,
          });
          if (istekNo.current !== no) return;
          setSonuclar(liste);
        } catch {
          if (istekNo.current !== no) return;
          setSonuclar([]);
          setHata(t('mesajlar.aramaHata'));
        } finally {
          if (istekNo.current === no) setYukleniyor(false);
        }
      })();
    }, 180);

    return () => clearTimeout(timer);
  }, [sorgu, haricUserId]);

  return (
    <View style={styles.wrap}>
      <View style={styles.aramaKutu}>
        <Ionicons name="search" size={18} color={RenkTokenlari.primarySoft} />
        <TextInput
          value={sorgu}
          onChangeText={setSorgu}
          placeholder={t('mesajlar.aramaPlaceholder')}
          placeholderTextColor={RenkTokenlari.textDim}
          style={styles.input}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={40}
          editable={!seciliyor}
        />
        {sorgu.length > 0 ? (
          <Pressable onPress={() => setSorgu('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={RenkTokenlari.textDim} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.ipucu}>{t('mesajlar.aramaIpucu')}</Text>

      {yukleniyor ? (
        <ActivityIndicator
          color={RenkTokenlari.primary}
          style={styles.loader}
        />
      ) : null}

      {hata ? <Text style={styles.hata}>{hata}</Text> : null}

      {!yukleniyor && sorgu.trim().length >= 1 && sonuclar.length === 0 && !hata ? (
        <View style={styles.bos}>
          <Ionicons name="person-outline" size={28} color={RenkTokenlari.textDim} />
          <Text style={styles.bosBaslik}>{t('mesajlar.sonucYok')}</Text>
          <Text style={styles.bosAlt}>{t('mesajlar.sonucYokBody')}</Text>
        </View>
      ) : null}

      <FlatList
        data={sonuclar}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.liste}
        renderItem={({ item }) => (
          <KullaniciSatiri
            kullanici={item}
            disabled={!!seciliyor}
            onPress={() => onSec(item)}
          />
        )}
      />
    </View>
  );
}

function KullaniciSatiri({
  kullanici,
  onPress,
  disabled,
}: {
  kullanici: ArananKullanici;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { t } = useCeviri();
  const ad =
    kullanici.display_name?.trim() ||
    kullanici.username ||
    t('ortak.kullanici');
  const handle = kullanici.username ? `@${kullanici.username}` : null;
  const avatar = MedyaUriGuvenli(kullanici.avatar_url);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.satir,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <LinearGradient
          colors={[...RenkTokenlari.gradientPrimary]}
          style={styles.avatar}
        >
          <Text style={styles.avatarHarf}>
            {(ad[0] ?? 'K').toUpperCase()}
          </Text>
        </LinearGradient>
      )}
      <View style={styles.copy}>
        <View style={styles.adSatir}>
          <Text style={styles.ad} numberOfLines={1}>
            {ad}
          </Text>
          {kullanici.is_verified ? (
            <DogrulanmisTik size={14} />
          ) : null}
        </View>
        {handle ? (
          <Text style={styles.handle} numberOfLines={1}>
            {handle}
          </Text>
        ) : null}
        {kullanici.public_user_id ? (
          <Text style={styles.id} numberOfLines={1}>
            ID {kullanici.public_user_id}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={18} color={RenkTokenlari.primarySoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.md,
  },
  aramaKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgCard,
  },
  input: {
    flex: 1,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
    paddingVertical: 10,
  },
  ipucu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 10,
    marginBottom: 8,
    marginLeft: 4,
  },
  loader: { marginVertical: BoslukTokenlari.md },
  hata: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    marginBottom: BoslukTokenlari.sm,
  },
  liste: {
    gap: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.xxl,
  },
  bos: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: BoslukTokenlari.xxl,
  },
  bosBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  bosAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHarf: {
    ...TipografiTokenlari.h2,
    color: '#12040C',
    fontSize: 16,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  adSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ad: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.text,
    flexShrink: 1,
  },
  handle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  id: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
  },
});
