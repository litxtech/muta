import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ADMIN_BOLUM_SIRASI,
  type AdminModul,
} from '../arama/AdminModulKatalogu';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { AdminOturumuKapat } from './AdminOturumuKapat';

/**
 * Panelin kalıcı yan menüyü gösterdiği en küçük genişlik.
 * Altında yan menü çekmeceye (drawer) dönüşür.
 *
 * 1024 seçildi: iPad dikey (768–834) ve telefonlar çekmece kullanır,
 * yatay tablet ve masaüstü kalıcı menü görür.
 */
export const ADMIN_MASAUSTU_MIN = 1024;

/** Kalıcı yan menü genişliği (masaüstü). */
const YAN_MENU_GENISLIGI = 264;
/** Çekmece en fazla bu kadar geniş olur. */
const CEKMECE_MAKS = 340;

export type AdminKabukProps = {
  /** Yetkiye göre süzülmüş modül listesi. */
  moduller: AdminModul[];
  /** Aktif rota (menüde vurgu için). */
  aktifYol: string;
  kullaniciAdi: string;
  rolEtiketi: string;
  children: React.ReactNode;
};

/** Panelden çıkış — geri alınamaz, iki adımlı onay ister. */
function CikisDugmesi({ dar }: { dar?: boolean }) {
  const [onay, setOnay] = useState(false);
  const [kapaniyor, setKapaniyor] = useState(false);

  if (onay) {
    return (
      <View style={styles.cikisOnay}>
        <Text style={styles.cikisOnayYazi}>Oturum kapatılsın mı?</Text>
        <View style={styles.cikisOnaySatir}>
          <Pressable
            style={[styles.cikisOnayDugme, styles.cikisHayir]}
            onPress={() => setOnay(false)}
            disabled={kapaniyor}
            accessibilityRole="button"
            accessibilityLabel="Vazgeç"
          >
            <Text style={styles.cikisOnayDugmeYazi}>Vazgeç</Text>
          </Pressable>
          <Pressable
            style={[styles.cikisOnayDugme, styles.cikisEvet]}
            onPress={() => {
              setKapaniyor(true);
              void AdminOturumuKapat('manual').finally(() => {
                router.replace('/giris?neden=cikis' as never);
              });
            }}
            disabled={kapaniyor}
            accessibilityRole="button"
            accessibilityLabel="Çıkışı onayla"
          >
            <Text style={styles.cikisEvetYazi}>
              {kapaniyor ? 'Kapatılıyor…' : 'Çıkış yap'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cikisDugme,
        dar && styles.cikisDugmeDar,
        pressed && { opacity: 0.8 },
      ]}
      onPress={() => setOnay(true)}
      accessibilityRole="button"
      accessibilityLabel="Oturumu kapat"
    >
      <Ionicons name="log-out-outline" size={16} color={RenkTokenlari.danger} />
      {!dar ? <Text style={styles.cikisYazi}>Çıkış</Text> : null}
    </Pressable>
  );
}

/** Oturumun elle kapatılmadığını gösteren sabit rozet. */
function OturumRozeti({ dar }: { dar?: boolean }) {
  return (
    <View
      style={styles.oturumRozet}
      accessibilityRole="text"
      accessibilityLabel="Oturum açık. Kapatmak için Çıkış kullanın."
    >
      <Ionicons
        name="shield-checkmark-outline"
        size={13}
        color={RenkTokenlari.mint}
      />
      {!dar ? <Text style={styles.oturumYazi}>Oturum açık</Text> : null}
    </View>
  );
}

function MenuOge({
  modul,
  aktif,
  onGit,
}: {
  modul: AdminModul;
  aktif: boolean;
  onGit: (href: string) => void;
}) {
  const [uzerinde, setUzerinde] = useState(false);
  return (
    <Pressable
      onPress={() => onGit(modul.href)}
      onHoverIn={() => setUzerinde(true)}
      onHoverOut={() => setUzerinde(false)}
      style={[styles.oge, (aktif || uzerinde) && styles.ogeVurgu]}
      accessibilityRole="link"
      accessibilityLabel={modul.label}
      accessibilityState={{ selected: aktif }}
    >
      {aktif ? <View style={styles.ogeSerit} /> : null}
      <Ionicons
        name={modul.icon}
        size={16}
        color={aktif ? RenkTokenlari.text : RenkTokenlari.textMuted}
        style={styles.ogeIkon}
      />
      <Text
        style={[styles.ogeYazi, aktif && styles.ogeYaziAktif]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {modul.label}
      </Text>
    </Pressable>
  );
}

function MenuListesi({
  moduller,
  aktifYol,
  onGit,
}: {
  moduller: AdminModul[];
  aktifYol: string;
  onGit: (href: string) => void;
}) {
  const [sorgu, setSorgu] = useState('');

  const gruplar = useMemo(() => {
    const q = sorgu.trim().toLocaleLowerCase('tr');
    const liste = q
      ? moduller.filter(
          (m) =>
            m.label.toLocaleLowerCase('tr').includes(q) ||
            m.alt.toLocaleLowerCase('tr').includes(q),
        )
      : moduller;

    return ADMIN_BOLUM_SIRASI.map((bolum) => ({
      bolum,
      moduller: liste.filter((m) => m.bolum === bolum),
    })).filter((g) => g.moduller.length > 0);
  }, [moduller, sorgu]);

  return (
    <>
      <View style={styles.aramaKap}>
        <Ionicons name="search" size={14} color={RenkTokenlari.textDim} />
        <TextInput
          style={styles.arama}
          value={sorgu}
          onChangeText={setSorgu}
          placeholder="Menüde ara"
          placeholderTextColor={RenkTokenlari.textDim}
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel="Menüde ara"
        />
        {sorgu ? (
          <Pressable
            onPress={() => setSorgu('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Aramayı temizle"
          >
            <Ionicons name="close-circle" size={14} color={RenkTokenlari.textDim} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuIcerik}
        keyboardShouldPersistTaps="handled"
      >
        {gruplar.map((g) => (
          <View key={g.bolum} style={styles.grup}>
            <Text style={styles.grupAd} numberOfLines={1}>
              {g.bolum}
            </Text>
            {g.moduller.map((m) => (
              <MenuOge
                key={m.href}
                modul={m}
                aktif={aktifYol === m.href || aktifYol.startsWith(`${m.href}/`)}
                onGit={onGit}
              />
            ))}
          </View>
        ))}
        {gruplar.length === 0 ? (
          <Text style={styles.bosMenu}>Eşleşen menü yok</Text>
        ) : null}
      </ScrollView>
    </>
  );
}

function KullaniciPaneli({
  kullaniciAdi,
  rolEtiketi,
}: {
  kullaniciAdi: string;
  rolEtiketi: string;
}) {
  return (
    <View style={styles.altPanel}>
      <View style={styles.kullaniciSatir}>
        <View style={styles.avatar}>
          <Text style={styles.avatarYazi}>
            {kullaniciAdi.replace('@', '').slice(0, 1).toLocaleUpperCase('tr')}
          </Text>
        </View>
        <View style={styles.kullaniciMetin}>
          <Text style={styles.kullaniciAd} numberOfLines={1}>
            {kullaniciAdi}
          </Text>
          <Text style={styles.kullaniciRol} numberOfLines={1}>
            {rolEtiketi}
          </Text>
        </View>
      </View>
      <View style={styles.altSatir}>
        <OturumRozeti />
        <CikisDugmesi />
      </View>
    </View>
  );
}

function MarkaBlok({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.marka}
      accessibilityRole="link"
      accessibilityLabel="Kontrol merkezi"
    >
      <View style={styles.markaIsaret}>
        <Ionicons
          name="shield-checkmark"
          size={16}
          color={RenkTokenlari.textOnPrimary}
        />
      </View>
      <View style={styles.markaMetin}>
        <Text style={styles.markaAd} numberOfLines={1}>
          Tamuso
        </Text>
        <Text style={styles.markaAlt} numberOfLines={1}>
          Kontrol merkezi
        </Text>
      </View>
    </Pressable>
  );
}

export function AdminKabuk({
  moduller,
  aktifYol,
  kullaniciAdi,
  rolEtiketi,
  children,
}: AdminKabukProps) {
  const { width } = useWindowDimensions();
  const masaustu = Platform.OS !== 'web' ? false : width >= ADMIN_MASAUSTU_MIN;

  // Çekmece yalnızca açıkken bağlanır; menü listesi boşta render edilmez.
  const [cekmeceAcik, setCekmeceAcik] = useState(false);
  const ilerleme = useRef(new Animated.Value(0)).current;

  const cekmeceGenisligi = Math.max(
    264,
    Math.min(CEKMECE_MAKS, Math.round(width * 0.88)),
  );

  const cekmeceyiAc = useCallback(() => {
    setCekmeceAcik(true);
    ilerleme.setValue(0);
    Animated.timing(ilerleme, {
      toValue: 1,
      duration: AnimasyonTokenlari.normal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ilerleme]);

  const cekmeceyiKapat = useCallback(() => {
    Animated.timing(ilerleme, {
      toValue: 0,
      duration: AnimasyonTokenlari.hizli,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setCekmeceAcik(false);
    });
  }, [ilerleme]);

  const git = useCallback((href: string) => {
    setCekmeceAcik(false);
    ilerleme.setValue(0);
    router.push(href as never);
  }, [ilerleme]);

  // Rota değişince çekmece kapanır (geride kalmış katman olmasın).
  const ilkYol = useRef(aktifYol);
  useEffect(() => {
    if (ilkYol.current === aktifYol) return;
    ilkYol.current = aktifYol;
    setCekmeceAcik(false);
    ilerleme.setValue(0);
  }, [aktifYol, ilerleme]);

  // Masaüstüne geçildiğinde çekmece durumu temizlenir.
  useEffect(() => {
    if (!masaustu) return;
    setCekmeceAcik(false);
    ilerleme.setValue(0);
  }, [masaustu, ilerleme]);

  // Escape ile kapanma (web klavye).
  useEffect(() => {
    if (!cekmeceAcik) return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const dinle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cekmeceyiKapat();
    };
    window.addEventListener('keydown', dinle);
    return () => window.removeEventListener('keydown', dinle);
  }, [cekmeceAcik, cekmeceyiKapat]);

  return (
    <View style={[styles.kabuk, masaustu && styles.kabukYatay]}>
      {masaustu ? (
        <View style={styles.yan}>
          <MarkaBlok onPress={() => router.push('/admin' as never)} />
          <MenuListesi moduller={moduller} aktifYol={aktifYol} onGit={git} />
          <KullaniciPaneli kullaniciAdi={kullaniciAdi} rolEtiketi={rolEtiketi} />
        </View>
      ) : null}

      <View style={styles.ana}>
        {!masaustu ? (
          <View style={styles.ustBar}>
            <Pressable
              style={({ pressed }) => [
                styles.menuDugme,
                pressed && styles.menuDugmeBasili,
              ]}
              onPress={cekmeceAcik ? cekmeceyiKapat : cekmeceyiAc}
              accessibilityRole="button"
              accessibilityLabel="Menüyü aç"
              accessibilityState={{ expanded: cekmeceAcik }}
            >
              <Ionicons name="menu" size={22} color={RenkTokenlari.text} />
            </Pressable>

            <Pressable
              style={styles.ustMarka}
              onPress={() => router.push('/admin' as never)}
              accessibilityRole="link"
              accessibilityLabel="Kontrol merkezi"
            >
              <View style={styles.ustMarkaIsaret}>
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={RenkTokenlari.textOnPrimary}
                />
              </View>
              <Text style={styles.ustMarkaAd} numberOfLines={1}>
                Tamuso
              </Text>
            </Pressable>

            <View style={styles.ustSag}>
              <OturumRozeti dar />
              <CikisDugmesi dar />
            </View>
          </View>
        ) : null}

        <View style={styles.icerik}>{children}</View>
      </View>

      {!masaustu && cekmeceAcik ? (
        <View style={styles.cekmeceKatman}>
          <Animated.View style={[styles.perde, { opacity: ilerleme }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={cekmeceyiKapat}
              accessibilityRole="button"
              accessibilityLabel="Menüyü kapat"
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.cekmece,
              {
                width: cekmeceGenisligi,
                transform: [
                  {
                    translateX: ilerleme.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-cekmeceGenisligi - 24, 0],
                    }),
                  },
                ],
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.cekmeceUst}>
              <MarkaBlok onPress={() => git('/admin')} />
              <Pressable
                style={({ pressed }) => [
                  styles.kapatDugme,
                  pressed && styles.menuDugmeBasili,
                ]}
                onPress={cekmeceyiKapat}
                accessibilityRole="button"
                accessibilityLabel="Menüyü kapat"
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={RenkTokenlari.text} />
              </Pressable>
            </View>

            <MenuListesi moduller={moduller} aktifYol={aktifYol} onGit={git} />
            <KullaniciPaneli kullaniciAdi={kullaniciAdi} rolEtiketi={rolEtiketi} />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kabuk: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: RenkTokenlari.bg,
  },
  kabukYatay: { flexDirection: 'row' },
  ana: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
  },
  icerik: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
  },

  // ── Kalıcı yan menü (masaüstü) ──────────────────────────────
  yan: {
    width: YAN_MENU_GENISLIGI,
    flexShrink: 0,
    flexGrow: 0,
    borderRightWidth: 1,
    borderRightColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  marka: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.md,
  },
  markaMetin: { flexShrink: 1, minWidth: 0 },
  markaIsaret: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
    flexShrink: 0,
  },
  markaAd: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  markaAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 1,
  },

  aramaKap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  arama: {
    flex: 1,
    minWidth: 0,
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    padding: 0,
  },

  menuIcerik: { paddingBottom: BoslukTokenlari.lg },
  grup: { paddingBottom: 6 },
  grupAd: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: 12,
    paddingBottom: 5,
  },
  oge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 0,
  },
  ogeVurgu: { backgroundColor: RenkTokenlari.surface },
  ogeIkon: { flexShrink: 0 },
  ogeSerit: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 2,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.primarySoft,
  },
  ogeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
    minWidth: 0,
  },
  ogeYaziAktif: { color: RenkTokenlari.text, fontWeight: '600' },
  bosMenu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: 12,
  },

  altPanel: {
    borderTopWidth: 1,
    borderTopColor: RenkTokenlari.border,
    padding: BoslukTokenlari.md,
    gap: 10,
  },
  kullaniciSatir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kullaniciMetin: { flex: 1, minWidth: 0 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    flexShrink: 0,
  },
  avatarYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  kullaniciAd: { ...TipografiTokenlari.caption, color: RenkTokenlari.text },
  kullaniciRol: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  altSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  oturumRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    flexShrink: 0,
  },
  oturumYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },

  cikisDugme: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cikisDugmeDar: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: 8,
  },
  cikisYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.danger },

  cikisOnay: { flex: 1, minWidth: 0, gap: 6 },
  cikisOnayYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  cikisOnaySatir: { flexDirection: 'row', gap: 6 },
  cikisOnayDugme: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  cikisHayir: { borderColor: RenkTokenlari.border },
  cikisEvet: {
    borderColor: RenkTokenlari.danger,
    backgroundColor: RenkTokenlari.danger,
  },
  cikisOnayDugmeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  cikisEvetYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '700',
  },

  // ── Mobil üst bar ───────────────────────────────────────────
  ustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    minWidth: 0,
  },
  menuDugme: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    flexShrink: 0,
  },
  menuDugmeBasili: { opacity: 0.7 },
  ustMarka: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  ustMarkaIsaret: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
    flexShrink: 0,
  },
  ustMarkaAd: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    flexShrink: 1,
  },
  ustSag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
    flexShrink: 0,
  },

  // ── Çekmece (drawer) ────────────────────────────────────────
  cekmeceKatman: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    elevation: 60,
  },
  perde: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4, 4, 12, 0.62)',
  },
  cekmece: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    maxWidth: '92%',
    backgroundColor: RenkTokenlari.bgCard,
    borderRightWidth: 1,
    borderRightColor: RenkTokenlari.border,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 0 },
    elevation: 16,
  },
  cekmeceUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: BoslukTokenlari.md,
    minWidth: 0,
  },
  kapatDugme: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
