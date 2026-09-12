# Cuzdan ve Ledger Modeli

## Ayri bakiyeler

| Varlik | Kim | Amac |
|--------|-----|------|
| Coin | Kullanici | Satin alma + harcama (hediye) |
| Host Earnings (Diamond) | Creator/Host | Kazanc / cekim |
| Agency Distribution Balance | Authorized distributor | Platform tahsisli dagitim |

Coin ve Host Earnings **ayni wallet degildir**.

## Immutable ledger

Her finans hareketi ledger satiri uretir:
- Coin Purchase
- Gift Sent / Received
- Admin Adjustment
- Refund
- Agency Distribution
- Bonus
- Withdrawal
- Reversal

Silme yok. Duzeltme = yeni **reversal** satiri.

## Gift settlement (atomic RPC)

1. Gift fiyatini DB'den oku
2. Balance kontrol
3. Coin dus
4. gift_transactions olustur
5. Host earnings hesapla
6. Agency commission snapshot
7. Ledger kayitlari
8. Idempotency key kontrol

Balance negatif olamaz. Client giftPrice kabul edilmez.

## IAP

- StoreKit / Play localized price authoritative UI fiyatidir
- Server-side receipt verify
- Duplicate transaction engeli
- Idempotency zorunlu

## Reconciliation (cron)

- Wallet balance vs ledger sum
- IAP tx vs wallet credit  
Uyumsuzluk → Critical Finance Alert

## Kill switch

- `kill_coin_purchase`
- `kill_gift_send`
- `kill_withdrawal`
- `kill_agency_coin_transfer`
