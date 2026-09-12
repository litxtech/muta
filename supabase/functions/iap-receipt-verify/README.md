# IAP Receipt Verify (Edge Function)

Production akis:
1. Mobil StoreKit / Play Billing satin alir
2. Receipt + productId + idempotencyKey bu Edge Function'a gider
3. Apple/Google dogrular (service credentials burada)
4. Basariliysa `coin_satin_al_onayla` RPC (service_role veya user JWT + verified flag)

Mobil uygulamada Apple/Google secret **olmaz**.

FAZ 3: mobil gelistirme yolu `CoinSatinAlOnayla` dogrudan RPC cagirir (manual store).
