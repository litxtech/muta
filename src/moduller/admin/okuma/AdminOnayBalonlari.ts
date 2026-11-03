import { AdminDogrulamaDashboardGetir } from '../dogrulama/AdminDogrulamaIslemleri';
import type { AdminPlatformOzeti } from '../tipler/PlatformTipleri';
import { AdminSatinAlmaItirazListele } from '../../cuzdan/itiraz/SatinAlmaItirazIslemleri';
import { AdminVerifyDashboard } from '../kimlik-dogrulama/AdminKimlikIslemleri';
import { AdminYayinciOnaySayilari } from '../finance/AdminYayinciFinanceApi';

export type AdminOnayBalonu = {
  id: string;
  adet: number;
  etiket: string;
  href: string;
};

/** Bekleyen onay kuyrukları. Bir kaynak düşerse diğerleri durur. */
export async function AdminOnayBalonlariGetir(
  platform?: AdminPlatformOzeti | null,
): Promise<AdminOnayBalonu[]> {
  const [dogrulama, itiraz, verify, yayinci] = await Promise.all([
    AdminDogrulamaDashboardGetir().catch(() => null),
    AdminSatinAlmaItirazListele('pending', 40).catch(() => []),
    AdminVerifyDashboard().catch(() => null),
    AdminYayinciOnaySayilari().catch(() => null),
  ]);

  const verifyBekleyen = verify
    ? verify.inceleme_bekleyen + verify.ek_dogrulama + verify.acik_itiraz
    : 0;

  const adaylar: AdminOnayBalonu[] = [
    {
      id: 'verify',
      adet: verifyBekleyen,
      etiket: 'Tamuso Verify',
      href: '/admin/kimlik-dogrulama',
    },
    {
      id: 'kimlik',
      adet: dogrulama?.pending_kyc ?? 0,
      etiket: 'Kimlik onayı (eski)',
      href: '/admin/kyc',
    },
    {
      id: 'ajans',
      adet: (dogrulama?.pending_applications ?? 0) + (dogrulama?.in_review ?? 0),
      etiket: 'Ajans doğrulama',
      href: '/admin/dogrulama',
    },
    {
      id: 'itiraz',
      adet: itiraz.length,
      etiket: 'Satın alma itirazı',
      href: '/admin/satin-alma-itirazlar',
    },
    {
      id: 'yayinci_odeme',
      adet: yayinci?.onay_bekleyen_toplam ?? 0,
      etiket: 'Yayıncı ödeme onayı',
      href: '/admin/finance/yayinci/onaylar',
    },
    {
      id: 'yayinci_kazanc',
      adet: yayinci?.kazanc ?? 0,
      etiket: 'Yayıncı kazancı',
      href: '/admin/finance/yayinci/bekleyen',
    },
    {
      id: 'rapor',
      adet: platform?.sosyal.acik_rapor ?? 0,
      etiket: 'Açık rapor',
      href: '/admin/moderasyon',
    },
  ];

  return adaylar.filter((b) => b.adet > 0);
}
