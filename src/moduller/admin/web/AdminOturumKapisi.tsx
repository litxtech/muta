import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminYetkisiVarMi } from '../yetki/AdminYetkisiVarMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { AdminOturumuKapat } from './AdminOturumuKapat';

/**
 * Oturum yalnızca elle kapatılır.
 *
 * Zaman aşımı yoktur: hareketsizlik veya toplam süre nedeniyle otomatik çıkış
 * yapılmaz. Oturum; kullanıcı "Çıkış" düğmesini kullanana ya da hesabın
 * yönetim yetkisi kalkana kadar açık kalır. Belirteç kalıcı depoda tutulur,
 * bu yüzden sekme/pencerenin kapanması da oturumu düşürmez.
 */

/** Profil yeniden denemeleri arasındaki ilk bekleme. */
const YENIDEN_DENEME_MS = 2_500;
/** Yeniden denemeler arasındaki üst sınır — sunucuyu yormadan beklenir. */
const YENIDEN_DENEME_MAKS_MS = 15_000;

function Bekleme({
  mesaj,
  cikis,
}: {
  mesaj: string;
  /** Bekleme ekranında elle çıkış sunulsun mu? */
  cikis?: boolean;
}) {
  return (
    <View style={styles.bekleme}>
      <ActivityIndicator color={RenkTokenlari.primarySoft} />
      <Text style={styles.beklemeYazi}>{mesaj}</Text>
      {cikis ? (
        <Pressable
          style={({ pressed }) => [styles.cikis, pressed && { opacity: 0.7 }]}
          onPress={() => {
            void AdminOturumuKapat('manual').finally(() => {
              router.replace('/giris?neden=cikis' as never);
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Oturumu kapat"
        >
          <Text style={styles.cikisYazi}>Oturum kapat</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Yönetim panelinin tek oturum kapısı.
 *
 *  - Oturum yoksa /giris'e yönlendirir.
 *  - Oturumu olup personel yetkisi olmayanı çıkarır.
 *  - Otomatik zaman aşımı YOKTUR: oturum yalnızca elle kapatılır.
 *
 * Profil isteği başarısız olursa oturum KAPATILMAZ; artan aralıklarla
 * yeniden denenir (ağ dalgalanması personeli dışarı atmaz).
 *
 * Sunucu tarafı yetki (RLS + is_admin) esastır; bu kapı yalnızca arayüzü
 * korur ve veri isteklerini erkenden keser.
 */
export function AdminOturumKapisi({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, refreshProfile } = useAuth();
  const path = usePathname();
  const girisSayfasi = path === '/giris';

  const cikisBasladiRef = useRef(false);
  const yonlendirildiRef = useRef(false);

  const admin = AdminYetkisiVarMi(profile);

  // Profil gelmezse oturumu kapatma; artan aralıklarla yeniden dene.
  useEffect(() => {
    if (!session?.user?.id || profile) return;

    let iptal = false;
    let gecikme = YENIDEN_DENEME_MS;
    let zaman: ReturnType<typeof setTimeout> | undefined;

    const dene = () => {
      if (iptal) return;
      void refreshProfile();
      gecikme = Math.min(
        Math.round(gecikme * 1.6),
        YENIDEN_DENEME_MAKS_MS,
      );
      zaman = setTimeout(dene, gecikme);
    };

    zaman = setTimeout(dene, gecikme);
    return () => {
      iptal = true;
      if (zaman) clearTimeout(zaman);
    };
  }, [session?.user?.id, profile, refreshProfile]);

  // Oturum yok → girişe
  useEffect(() => {
    if (loading) return;
    if (!session) {
      // Yeni giriş denemesi engellenmesin: çıkış kilidi burada açılır.
      cikisBasladiRef.current = false;
      if (!girisSayfasi && !yonlendirildiRef.current) {
        yonlendirildiRef.current = true;
        router.replace('/giris' as never);
      }
      return;
    }
    yonlendirildiRef.current = false;
  }, [loading, session, girisSayfasi]);

  // Yetki yok → zorunlu çıkış (yalnızca profil gerçekten "yetkisiz" diyorsa).
  useEffect(() => {
    if (loading || !session) return;
    if (cikisBasladiRef.current) return;
    if (!profile || admin) return;

    cikisBasladiRef.current = true;
    void AdminOturumuKapat('yetkisiz').finally(() => {
      router.replace('/giris?neden=yetkisiz' as never);
    });
  }, [loading, session, profile, admin]);

  // Oturum açıkken giriş sayfasına dönülürse panele geri gönder.
  // push (replace değil): /giris girişi geçmişte taban olarak kalsın,
  // böylece tarayıcı geri tuşu panelin dışına düşmez.
  useEffect(() => {
    if (loading || !session || !admin || !girisSayfasi) return;
    router.push('/admin');
  }, [loading, session, admin, girisSayfasi]);

  if (loading) return <Bekleme mesaj="Oturum kontrol ediliyor…" />;

  if (!session) {
    // Giriş ekranının kendisi engellenmez; diğer sayfalar yönlendirilir.
    return girisSayfasi ? (
      <>{children}</>
    ) : (
      <Bekleme mesaj="Giriş ekranına yönlendiriliyorsunuz…" />
    );
  }

  if (cikisBasladiRef.current) {
    return <Bekleme mesaj="Oturum kapatılıyor…" />;
  }

  // Profil gecikirse bekle (oturum açık kalır) — elle çıkış her zaman mümkün.
  if (!profile) {
    return <Bekleme mesaj="Yetkiler doğrulanıyor…" cikis />;
  }

  if (!admin) {
    return <Bekleme mesaj="Bu hesabın yönetim yetkisi yok." cikis />;
  }

  if (girisSayfasi) {
    return <Bekleme mesaj="Kontrol merkezine yönlendiriliyorsunuz…" />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  bekleme: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: RenkTokenlari.bg,
    padding: 24,
  },
  beklemeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  cikis: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cikisYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
