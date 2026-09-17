/**
 * Realm of Storms — Admin müzik playlist paneli.
 * Varsayılan: oyunun kendi BGM. Müzik yüklenince otomatik playlist moda geçer.
 * Parçalar süre bitince sıradakine geçer; loop admin kontrolünde.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  kaskadAdminMuzikAyar,
  kaskadAdminMuzikGuncelle,
  kaskadAdminMuzikList,
  kaskadAdminMuzikSil,
  kaskadAdminMuzikSirala,
  type KaskadMusicAdminState,
  type KaskadMusicTrackRow,
} from '../../oyunlar/kaskad/servisler/KaskadAdminApi';
import {
  kaskadAdminMuzikDosyaYukle,
  kaskadAdminMuzikStorageSil,
} from '../../oyunlar/kaskad/servisler/KaskadMuzikYukle';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  state: KaskadMusicAdminState | null;
  onChange: (next: KaskadMusicAdminState) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
};

function sureMetin(ms: number | null): string {
  if (ms == null || ms <= 0) return 'süre yok';
  const sn = Math.round(ms / 1000);
  const dk = Math.floor(sn / 60);
  const kalan = sn % 60;
  return dk > 0 ? `${dk}:${String(kalan).padStart(2, '0')}` : `${sn}s`;
}

export function KaskadAdminMuzikPaneli({
  state,
  onChange,
  busy,
  setBusy,
}: Props) {
  const [baslik, setBaslik] = useState('');
  const [sureSn, setSureSn] = useState('');
  const [gerekce, setGerekce] = useState('müzik ayarı');
  const [sureDuzenId, setSureDuzenId] = useState<string | null>(null);
  const [sureDuzenDeger, setSureDuzenDeger] = useState('');

  const uygula = useCallback(
    (next: KaskadMusicAdminState) => {
      onChange(next);
    },
    [onChange],
  );

  const gerekceOk = (): string | null => {
    const g = gerekce.trim();
    if (g.length < 3) {
      Alert.alert('Müzik', 'Gerekçe en az 3 karakter (audit).');
      return null;
    }
    return g;
  };

  const yenile = async () => {
    setBusy(true);
    try {
      uygula(await kaskadAdminMuzikList());
    } catch (e) {
      Alert.alert('Müzik', e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setBusy(false);
    }
  };

  const yukle = async () => {
    setBusy(true);
    try {
      const sn = Number(sureSn);
      const durationMs =
        Number.isFinite(sn) && sn > 0 ? Math.round(sn * 1000) : null;
      const next = await kaskadAdminMuzikDosyaYukle({
        title: baslik.trim() || undefined,
        durationMs,
        autoPlaylist: true,
      });
      uygula(next);
      setBaslik('');
      setSureSn('');
      Alert.alert(
        'Müzik yüklendi',
        next.mode === 'playlist'
          ? 'Playlist aktif — oyunun kendi BGM kapandı. Parçalar sırayla çalar.'
          : 'Parça eklendi.',
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'IPTAL') return;
      Alert.alert('Yükleme', e instanceof Error ? e.message : 'Başarısız');
    } finally {
      setBusy(false);
    }
  };

  const modaGec = async (mode: 'builtin' | 'playlist') => {
    const reason = gerekceOk();
    if (!reason) return;
    setBusy(true);
    try {
      uygula(await kaskadAdminMuzikAyar({ mode, reason }));
    } catch (e) {
      Alert.alert('Mod', e instanceof Error ? e.message : 'Değiştirilemedi');
    } finally {
      setBusy(false);
    }
  };

  const loopToggle = async () => {
    if (!state) return;
    const reason = gerekceOk();
    if (!reason) return;
    setBusy(true);
    try {
      uygula(
        await kaskadAdminMuzikAyar({
          loop: !state.loop,
          reason,
        }),
      );
    } catch (e) {
      Alert.alert('Loop', e instanceof Error ? e.message : 'Değiştirilemedi');
    } finally {
      setBusy(false);
    }
  };

  const sil = (t: KaskadMusicTrackRow) => {
    Alert.alert('Parçayı sil', `"${t.title}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const next = await kaskadAdminMuzikSil(t.id);
              await kaskadAdminMuzikStorageSil(
                next.deletedStoragePath ?? t.storagePath,
              );
              uygula(next);
            } catch (e) {
              Alert.alert('Sil', e instanceof Error ? e.message : 'Silinemedi');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const aktifToggle = async (t: KaskadMusicTrackRow) => {
    setBusy(true);
    try {
      uygula(await kaskadAdminMuzikGuncelle(t.id, { aktif: !t.aktif }));
    } catch (e) {
      Alert.alert('Durum', e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setBusy(false);
    }
  };

  const tasi = async (t: KaskadMusicTrackRow, yon: -1 | 1) => {
    if (!state) return;
    const ids = state.tracks.map((x) => x.id);
    const i = ids.indexOf(t.id);
    const j = i + yon;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const nextIds = [...ids];
    const tmp = nextIds[i]!;
    nextIds[i] = nextIds[j]!;
    nextIds[j] = tmp;
    setBusy(true);
    try {
      uygula(await kaskadAdminMuzikSirala(nextIds));
    } catch (e) {
      Alert.alert('Sıra', e instanceof Error ? e.message : 'Sıralanamadı');
    } finally {
      setBusy(false);
    }
  };

  const sureKaydet = async (t: KaskadMusicTrackRow) => {
    const sn = Number(sureDuzenDeger.trim());
    const durationMs =
      sureDuzenDeger.trim() === ''
        ? null
        : Number.isFinite(sn) && sn > 0
          ? Math.round(sn * 1000)
          : null;
    if (sureDuzenDeger.trim() !== '' && durationMs == null) {
      Alert.alert('Süre', 'Pozitif saniye girin veya boş bırakın.');
      return;
    }
    setBusy(true);
    try {
      uygula(await kaskadAdminMuzikGuncelle(t.id, { durationMs }));
      setSureDuzenId(null);
      setSureDuzenDeger('');
    } catch (e) {
      Alert.alert('Süre', e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const tumunuTemizleVeVarsayilan = () => {
    if (!state || state.tracks.length === 0) {
      void modaGec('builtin');
      return;
    }
    const reason = gerekceOk();
    if (!reason) return;
    Alert.alert(
      'Varsayılana dön',
      'Tüm yüklenen müzikler silinir, oyunun kendi BGM geri gelir. Devam?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil ve varsayılan',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                let next = state;
                for (const t of [...state.tracks]) {
                  next = await kaskadAdminMuzikSil(t.id);
                  await kaskadAdminMuzikStorageSil(
                    next.deletedStoragePath ?? t.storagePath,
                  );
                }
                if (next.mode !== 'builtin') {
                  next = await kaskadAdminMuzikAyar({
                    mode: 'builtin',
                    reason,
                  });
                }
                uygula(next);
                Alert.alert('Tamam', 'Playlist temizlendi — oyun sesi aktif.');
              } catch (e) {
                Alert.alert(
                  'Temizle',
                  e instanceof Error ? e.message : 'Başarısız',
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  if (!state) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Müzik</Text>
        <ActivityIndicator color={RenkTokenlari.accent} />
        <Pressable style={styles.btn} onPress={() => void yenile()}>
          <Text style={styles.btnText}>Yenile</Text>
        </Pressable>
      </View>
    );
  }

  const aktifSayisi = state.tracks.filter((t) => t.aktif).length;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>Nasıl çalışır?</Text>
        <Text style={styles.hint}>
          1) Varsayılan modda oyunun kendi BGM + ambient çalar.{'\n'}
          2) Admin müzik yükleyince otomatik playlist açılır; oyun BGM kapanır.
          {'\n'}
          3) Her parça kendi süresi kadar çalar, bitince sıradaki gelir.{'\n'}
          4) Loop açıkken liste başa döner; kapalıysa son parçada durur.{'\n'}
          5) Varsayılan seçilince yüklenen müzikler çalmaz (oyun sesi). İstersen
          tüm playlisti silip tamamen sıfırlayabilirsin.{'\n'}
          6) SFX (efektler) her zaman oyuncunun cihaz ayarına bağlıdır —
          playlist sadece müzik kanalını değiştirir.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Müzik kaynağı</Text>
        <View style={styles.rowBetween}>
          <View style={styles.flex1}>
            <Text style={styles.gameName}>
              Aktif mod:{' '}
              {state.mode === 'playlist'
                ? 'PLAYLIST'
                : 'OYUN SESİ (varsayılan)'}
            </Text>
            <Text style={styles.meta}>
              {aktifSayisi} aktif parça · loop{' '}
              {state.loop ? 'açık (başa dön)' : 'kapalı (bitince dur)'}
            </Text>
          </View>
        </View>
        <View style={styles.chips}>
          <Pressable
            style={[styles.chip, state.mode === 'builtin' && styles.chipOn]}
            disabled={busy}
            onPress={() => void modaGec('builtin')}
          >
            <Text
              style={[
                styles.chipText,
                state.mode === 'builtin' && styles.chipTextOn,
              ]}
            >
              Varsayılan (oyun sesi)
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, state.mode === 'playlist' && styles.chipOn]}
            disabled={busy}
            onPress={() => void modaGec('playlist')}
          >
            <Text
              style={[
                styles.chipText,
                state.mode === 'playlist' && styles.chipTextOn,
              ]}
            >
              Playlist (yüklenen müzikler)
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, state.loop && styles.chipOn]}
            disabled={busy}
            onPress={() => void loopToggle()}
          >
            <Text style={[styles.chipText, state.loop && styles.chipTextOn]}>
              Loop {state.loop ? 'Açık' : 'Kapalı'}
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.btnOutline, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={tumunuTemizleVeVarsayilan}
        >
          <Text style={styles.btnOutlineText}>
            Playlisti sil → varsayılan oyun sesi
          </Text>
        </Pressable>
        <Text style={styles.label}>Gerekçe (audit)</Text>
        <TextInput
          style={styles.input}
          value={gerekce}
          onChangeText={setGerekce}
          placeholder="örn. sezon müziği"
          placeholderTextColor={RenkTokenlari.textMuted}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Müzik yükle</Text>
        <Text style={styles.hint}>
          Desteklenen: mp3, wav, m4a, aac, ogg, flac, webm, opus, aiff, midi ve
          diğer yaygın ses dosyaları (max ~50 MB). MIME bilinmese de
          seçilebilir. İlk yüklemede otomatik playlist açılır.
        </Text>
        <Text style={styles.label}>Başlık (opsiyonel)</Text>
        <TextInput
          style={styles.input}
          value={baslik}
          onChangeText={setBaslik}
          placeholder="Dosya adından alınır"
          placeholderTextColor={RenkTokenlari.textMuted}
        />
        <Text style={styles.label}>
          Süre saniye (önerilir — sıradaki parçaya geçiş)
        </Text>
        <TextInput
          style={styles.input}
          value={sureSn}
          onChangeText={setSureSn}
          keyboardType="number-pad"
          placeholder="örn. 180"
          placeholderTextColor={RenkTokenlari.textMuted}
        />
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void yukle()}
        >
          <Text style={styles.btnText}>
            {busy ? 'Yükleniyor…' : 'Dosya seç ve yükle'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Playlist ({state.tracks.length})</Text>
        <Text style={styles.hint}>
          Sıra = çalma sırası. Pasif parçalar atlanır. Silince storage da
          temizlenir; aktif parça kalmazsa otomatik oyun sesine dönülür.
        </Text>
        {state.tracks.length === 0 ? (
          <Text style={styles.meta}>Henüz müzik yok.</Text>
        ) : (
          state.tracks.map((t, idx) => (
            <View key={t.id} style={styles.track}>
              <View style={styles.flex1}>
                <Text style={styles.gameName}>
                  {idx + 1}. {t.title}
                  {!t.aktif ? ' (pasif)' : ''}
                </Text>
                <Text style={styles.meta}>
                  {t.fileExt ?? '?'} · {t.mimeType ?? 'mime yok'} ·{' '}
                  {sureMetin(t.durationMs)}
                </Text>
              </View>
              {sureDuzenId === t.id ? (
                <View style={styles.sureRow}>
                  <TextInput
                    style={[styles.input, styles.sureInput]}
                    value={sureDuzenDeger}
                    onChangeText={setSureDuzenDeger}
                    keyboardType="number-pad"
                    placeholder="sn"
                    placeholderTextColor={RenkTokenlari.textMuted}
                  />
                  <Pressable
                    style={styles.smallBtn}
                    disabled={busy}
                    onPress={() => void sureKaydet(t)}
                  >
                    <Text style={styles.smallBtnText}>Kaydet</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => {
                      setSureDuzenId(null);
                      setSureDuzenDeger('');
                    }}
                  >
                    <Text style={styles.smallBtnText}>İptal</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.trackActions}>
                <Pressable
                  style={styles.smallBtn}
                  disabled={busy || idx === 0}
                  onPress={() => void tasi(t, -1)}
                >
                  <Text style={styles.smallBtnText}>↑</Text>
                </Pressable>
                <Pressable
                  style={styles.smallBtn}
                  disabled={busy || idx === state.tracks.length - 1}
                  onPress={() => void tasi(t, 1)}
                >
                  <Text style={styles.smallBtnText}>↓</Text>
                </Pressable>
                <Pressable
                  style={styles.smallBtn}
                  disabled={busy}
                  onPress={() => {
                    setSureDuzenId(t.id);
                    setSureDuzenDeger(
                      t.durationMs != null
                        ? String(Math.round(t.durationMs / 1000))
                        : '',
                    );
                  }}
                >
                  <Text style={styles.smallBtnText}>Süre</Text>
                </Pressable>
                <Pressable
                  style={styles.smallBtn}
                  disabled={busy}
                  onPress={() => void aktifToggle(t)}
                >
                  <Text style={styles.smallBtnText}>
                    {t.aktif ? 'Pasif' : 'Aktif'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.smallBtn, styles.dangerBtn]}
                  disabled={busy}
                  onPress={() => sil(t)}
                >
                  <Text style={styles.smallBtnText}>Sil</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
        <Pressable
          style={styles.btn}
          disabled={busy}
          onPress={() => void yenile()}
        >
          <Text style={styles.btnText}>Listeyi yenile</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 16,
    padding: BoslukTokenlari.md,
    gap: 10,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  title: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '700',
  },
  meta: {
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  hint: {
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  input: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: RenkTokenlari.text,
    backgroundColor: RenkTokenlari.bg,
  },
  sureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sureInput: {
    flex: 1,
    paddingVertical: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flex1: { flex: 1 },
  gameName: {
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chipOn: {
    backgroundColor: RenkTokenlari.violet,
    borderColor: RenkTokenlari.violet,
  },
  chipText: { color: RenkTokenlari.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  btn: {
    backgroundColor: RenkTokenlari.violet,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnOutline: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  btnOutlineText: {
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: '#fff', fontWeight: '700' },
  track: {
    borderTopWidth: 1,
    borderTopColor: RenkTokenlari.border,
    paddingTop: 10,
    gap: 8,
  },
  trackActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: RenkTokenlari.bg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  dangerBtn: { borderColor: '#c44' },
  smallBtnText: {
    color: RenkTokenlari.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
