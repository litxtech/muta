# Mevcut Repository Analizi (FAZ 1)

Tarih: 2026-09-09  
Ürün kimliği: Creator-led Live Social Community & Entertainment Platform  
Geçici marka: merkezi config (`APP_NAME`) üzerinden yönetilir; dosya adlarına yazılmaz.

## Özet

Mevcut kod **MVP kabuk**: Expo 57 + Expo Router + Supabase Auth + coin/elmas/hediye şeması.  
Production planına göre **modüler, tek sorumluluklu, Türkçe ASCII dosya** mimarisine geçiş başlatıldı. Mevcut auth ve monetization SQL sözleşmesi korunur.

## Korunacaklar (kırma)

1. Supabase Auth akışları (kayıt / giriş / şifre sıfırlama)
2. `handle_new_user` + welcome coin + `wallet_ledger`
3. `send_gift` RPC (atomic, server-authoritative fiyat)
4. Expo Router iskeleti ve env ayrımı (dev/test)
5. `service_role` asla mobilde olmaz

## Mevcut riskler

| Risk | Durum |
|------|--------|
| `src/services/api.ts` god service | FAZ 1 sonrası parçalanacak |
| Ekranlarda business logic | Screen = composition kuralı |
| Demo room fallback | Kaldırılacak / feature flag arkasına |
| LiveKit / IAP / City / Agency yok | FAZ 5–8 |
| SecureStore kullanılmıyor | FAZ 2 |
| Navigasyon Wallet tab | Messages tab'a evrilecek |

## Geçiş stratejisi

- Büyük yeniden yazım yok
- Yeni kod `src/moduller/<modul>/` altında
- Eski dosyalar uyumluluk re-export ile yaşar, sonra silinir
- Her faz typecheck + build temiz olmadan sonraki faza geçilmez
