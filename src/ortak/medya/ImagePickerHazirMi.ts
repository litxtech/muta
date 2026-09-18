import { Platform } from 'react-native';

type ImagePickerModul = typeof import('expo-image-picker');

let nativeHazir: boolean | null = null;
let modulOnbellek: ImagePickerModul | null = null;
let yuklemeSoz: Promise<
  { ok: true; ImagePicker: ImagePickerModul } | { ok: false; hata: string }
> | null = null;
/** true = granted biliniyor; false = reddedildi; null = henüz bilinmiyor */
let galeriIzni: boolean | null = null;
let kameraIzni: boolean | null = null;

/**
 * Expo Modules (SDK 50+) NativeModules'a yazmaz.
 * requireOptionalNativeModule ile gerçek bağlantıyı kontrol et.
 */
export function ImagePickerNativeHazirMi(): boolean {
  if (Platform.OS === 'web') return true;
  if (nativeHazir != null) return nativeHazir;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core') as {
      requireOptionalNativeModule: (name: string) => unknown;
    };
    nativeHazir = requireOptionalNativeModule('ExponentImagePicker') != null;
  } catch {
    nativeHazir = false;
  }
  return nativeHazir;
}

export async function ImagePickerModuluYukle(): Promise<
  | { ok: true; ImagePicker: ImagePickerModul }
  | { ok: false; hata: string }
> {
  if (modulOnbellek) return { ok: true, ImagePicker: modulOnbellek };
  if (yuklemeSoz) return yuklemeSoz;

  if (!ImagePickerNativeHazirMi()) {
    return {
      ok: false,
      hata: 'Medya seçici bu build’de yok. Yeni development build kur.',
    };
  }

  yuklemeSoz = (async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      modulOnbellek = ImagePicker;
      return { ok: true as const, ImagePicker };
    } catch {
      yuklemeSoz = null;
      return {
        ok: false as const,
        hata: 'expo-image-picker yüklenemedi. Development build yenile.',
      };
    }
  })();

  return yuklemeSoz;
}

/**
 * Galeri açılmadan önce JS paketini + izin durumunu ısıtır.
 * Uygulama / medya ekranı mount’ta çağır — tıklamada await maliyeti sıfırlanır.
 * Varsayılan: izin dialog’u açmaz (izinIste: false).
 */
export function ImagePickerOnIsit(opts?: { izinIste?: boolean }): void {
  void (async () => {
    const mod = await ImagePickerModuluYukle();
    if (!mod.ok) return;
    if (galeriIzni === true) return;
    try {
      const mevcut =
        await mod.ImagePicker.getMediaLibraryPermissionsAsync();
      if (mevcut.granted) {
        galeriIzni = true;
        return;
      }
      if (opts?.izinIste === true && mevcut.canAskAgain !== false) {
        const istenen =
          await mod.ImagePicker.requestMediaLibraryPermissionsAsync();
        galeriIzni = istenen.granted;
      }
      // izinIste değilse cache’e false yazma — video seçiminde request edilebilsin
    } catch {
      /* ısıtma sessiz */
    }
  })();
}

/**
 * İzin varsa cache’ten true; yoksa get→request. Zaten granted ise native çağrı yok.
 */
export async function ImagePickerGaleriIzniAl(
  ImagePicker: ImagePickerModul,
): Promise<boolean> {
  if (galeriIzni === true) return true;
  try {
    const mevcut = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (mevcut.granted) {
      galeriIzni = true;
      return true;
    }
    if (mevcut.canAskAgain === false) {
      galeriIzni = false;
      return false;
    }
    const istenen = await ImagePicker.requestMediaLibraryPermissionsAsync();
    galeriIzni = istenen.granted;
    return istenen.granted;
  } catch {
    return false;
  }
}

export type GaleriMedyaTipi = 'images' | 'videos';

export type GaleriAsset = {
  uri: string;
  mimeType?: string | null;
  type?: string | null;
  width?: number;
  height?: number;
  duration?: number | null;
};

export type GaleriSecimSonucu =
  | { ok: true; asset: GaleriAsset }
  | { ok: false; hata: string; iptal?: boolean };

function assetDonustur(a: {
  uri: string;
  mimeType?: string | null;
  type?: string | null;
  width?: number;
  height?: number;
  duration?: number | null;
}): GaleriAsset {
  return {
    uri: a.uri,
    mimeType: a.mimeType,
    type: a.type,
    width: a.width,
    height: a.height,
    duration: a.duration,
  };
}

export async function ImagePickerKameraIzniAl(
  ImagePicker: ImagePickerModul,
): Promise<boolean> {
  if (kameraIzni === true) return true;
  try {
    const mevcut = await ImagePicker.getCameraPermissionsAsync();
    if (mevcut.granted) {
      kameraIzni = true;
      return true;
    }
    if (mevcut.canAskAgain === false) {
      kameraIzni = false;
      return false;
    }
    const istenen = await ImagePicker.requestCameraPermissionsAsync();
    kameraIzni = istenen.granted;
    return istenen.granted;
  } catch {
    return false;
  }
}

/** Kamera ile foto / video çek → asset */
export async function KameraAc(opts: {
  mediaTypes: GaleriMedyaTipi[];
  quality?: number;
  videoMaxDuration?: number;
}): Promise<GaleriSecimSonucu> {
  const mod = await ImagePickerModuluYukle();
  if (!mod.ok) return { ok: false, hata: mod.hata };

  const { ImagePicker } = mod;
  const izinVar = await ImagePickerKameraIzniAl(ImagePicker);
  if (!izinVar) {
    return { ok: false, hata: 'Kamera izni gerekli.' };
  }

  const videoVar = opts.mediaTypes.includes('videos');
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: opts.mediaTypes,
      allowsEditing: false,
      quality: opts.quality ?? 1,
      videoMaxDuration: opts.videoMaxDuration ?? (videoVar ? 120 : undefined),
      cameraType: ImagePicker.CameraType.back,
    });
    if (result.canceled || !result.assets?.[0]) {
      return { ok: false, hata: 'İptal', iptal: true };
    }
    return { ok: true, asset: assetDonustur(result.assets[0]) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ExponentImagePicker') || msg.includes('native module')) {
      return {
        ok: false,
        hata: 'Kamera bu build’de yok. Yeni development build kur.',
      };
    }
    return { ok: false, hata: msg };
  }
}

/**
 * Sistem galerisini mümkün olan en hızlı şekilde açar.
 *
 * - Foto: izin beklemez (PHPicker / Android Photo Picker).
 * - Video: önce açmayı dene; yalnızca native hata verirse izin iste (dialog
 *   picker’dan önce gelmesin). Isıtma (ImagePickerOnIsit) izin cache’ler.
 * - quality:1 + allowsEditing:false → iOS fast-path (decode/re-encode yok).
 */
export async function GaleriAc(opts: {
  mediaTypes: GaleriMedyaTipi[];
  quality?: number;
  videoMaxDuration?: number;
}): Promise<GaleriSecimSonucu> {
  const mod = await ImagePickerModuluYukle();
  if (!mod.ok) return { ok: false, hata: mod.hata };

  const { ImagePicker } = mod;
  const videoVar = opts.mediaTypes.includes('videos');

  // Yalnız cache’te true ise atla; aksi halde get/request ile picker’ı geciktirme
  if (videoVar && galeriIzni === true) {
    /* izin hazır — launch’a geç */
  } else if (videoVar && Platform.OS === 'ios' && galeriIzni === false) {
    return { ok: false, hata: 'Galeri izni gerekli.' };
  }

  const launchOpts = {
    mediaTypes: opts.mediaTypes,
    allowsEditing: false as const,
    // <1 iOS’ta re-encode tetikler; fast-path için 1 şart
    quality: opts.quality ?? 1,
    selectionLimit: 1,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    ...(opts.videoMaxDuration != null
      ? { videoMaxDuration: opts.videoMaxDuration }
      : {}),
  };

  const birKezAc = async () => {
    const result = await ImagePicker.launchImageLibraryAsync(launchOpts);
    if (result.canceled || !result.assets?.[0]) {
      return { ok: false as const, hata: 'İptal', iptal: true as const };
    }
    return { ok: true as const, asset: assetDonustur(result.assets[0]) };
  };

  try {
    return await birKezAc();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ExponentImagePicker') || msg.includes('native module')) {
      return {
        ok: false,
        hata: 'Medya seçici native modülü yok. Yeni development build kur.',
      };
    }

    // İzin / limited library: bir kez isteyip tekrar aç (foto + video)
    const izinVar = await ImagePickerGaleriIzniAl(ImagePicker);
    if (!izinVar) {
      return { ok: false, hata: videoVar ? 'Galeri izni gerekli.' : msg };
    }
    try {
      return await birKezAc();
    } catch (e2) {
      return {
        ok: false,
        hata: e2 instanceof Error ? e2.message : String(e2),
      };
    }
  }
}
