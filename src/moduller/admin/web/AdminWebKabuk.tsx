import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminYetkisiVarMi } from '../yetki/AdminYetkisiVarMi';
import { useAdminPermissions } from '../yetki/useAdminPermissions';
import { ADMIN_MODULLER } from '../arama/AdminModulKatalogu';
import { AdminOnayBildirimleri } from '../bilesenler/AdminOnayBildirimleri';
import { AdminKabuk } from './AdminKabuk';

/**
 * Yönetim panelinin kabuğu.
 *
 * Yetki ve izin yüklemesi burada yapılır; yerleşim/davranış `AdminKabuk`
 * içindedir (saf sunum bileşeni). Böylece kabuk tek yerden responsive
 * davranır: 1024px altında yan menü çekmeceye dönüşür.
 */
export function AdminWebKabuk() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const { has, isSuper, loading } = useAdminPermissions();
  const path = usePathname();

  const moduller = useMemo(
    () =>
      isSuper || loading
        ? ADMIN_MODULLER
        : ADMIN_MODULLER.filter((m) => has(m.permissionKey)),
    [has, isSuper, loading],
  );

  const kullaniciAdi =
    profile?.display_name?.trim() ||
    (profile?.username ? `@${profile.username}` : 'Personel');

  if (!admin) return <Slot />;

  return (
    <View style={{ flex: 1 }}>
      <AdminKabuk
        moduller={moduller}
        aktifYol={path ?? ''}
        kullaniciAdi={kullaniciAdi}
        rolEtiketi={isSuper ? 'Süper yönetici' : 'Personel'}
      >
        <Slot />
      </AdminKabuk>
      {/* Yeni onay düştüğünde her admin ekranının üstünde beliren baloncuklar. */}
      <AdminOnayBildirimleri />
    </View>
  );
}
