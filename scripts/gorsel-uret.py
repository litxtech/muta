# -*- coding: utf-8 -*-
"""
Pazarlama sayfalarının görsellerini üretir (Pillow gerekir).

Kullanım:  python scripts/gorsel-uret.py

Üretilenler:
  public/gorsel/ekran-*-360.webp / -720.webp   (3:4 kırpılmış ekran görüntüleri)
  public/gorsel/og.jpg                         (1200x630 paylaşım kartı)
  public/gorsel/logo-512.png                   (şema logosu)

Görseller depoya işlenir; derleme sırasında çalışmaz.
"""
import os
from PIL import Image, ImageDraw, ImageFont

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIKTI = os.path.join(KOK, "public", "gorsel")
os.makedirs(CIKTI, exist_ok=True)

KAYNAKLAR = {
    "ekran-canli": "public/tanitim/canli.jpg",
    "ekran-gorusme": "public/tanitim/gorusme-yeni.jpg",
    "ekran-kesfet": "public/tanitim/arkadas.jpg",
}


def kirp(oransal: float, dikey: bool):
    """Görseli 3:4 (dikey) veya 4:3 (yatay) oranına ortadan kırpar."""
    w, h = oransal.size
    hedef = (3 / 4) if dikey else (4 / 3)
    mevcut = w / h
    if mevcut > hedef:
        yeni_w = int(h * hedef)
        sol = (w - yeni_w) // 2
        return oransal.crop((sol, 0, sol + yeni_w, h))
    yeni_h = int(w / hedef)
    ust = (h - yeni_h) // 2
    return oransal.crop((0, ust, w, ust + yeni_h))


def yaz(kutu, metin, boyut, renk, konum, kalin=False, ortalama=None):
    adaylar = [
        "C:/Windows/Fonts/segoeuib.ttf" if kalin else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if kalin else "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if kalin
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    font = None
    for yol in adaylar:
        if os.path.exists(yol):
            font = ImageFont.truetype(yol, boyut)
            break
    if font is None:
        font = ImageFont.load_default()
    if ortalama is not None:
        kutu_w = kutu.textlength(metin, font=font)
        konum = ((ortalama - kutu_w) // 2, konum[1])
    kutu.text(konum, metin, font=font, fill=renk)
    return font


def ekranlar():
    for ad, goreli in KAYNAKLAR.items():
        tam = os.path.join(KOK, goreli)
        if not os.path.exists(tam):
            print("atlandı (yok):", goreli)
            continue
        kaynak = Image.open(tam).convert("RGB")
        dikey = kirp(kaynak, True)
        for genislik in (360, 720):
            yukseklik = round(genislik * 4 / 3)
            kucuk = dikey.resize((genislik, yukseklik), Image.LANCZOS)
            hedef = os.path.join(CIKTI, f"{ad}-{genislik}.webp")
            kucuk.save(hedef, "WEBP", quality=74, method=6)
            print("yazıldı:", hedef, os.path.getsize(hedef) // 1024, "KB")


def og():
    w, h = 1200, 630
    tuval = Image.new("RGB", (w, h), (7, 6, 13))
    ciz = ImageDraw.Draw(tuval)
    # pembe → mor degrade
    for x in range(w):
        oran = x / w
        r = int(255 * (1 - oran) * 0.34 + 139 * oran * 0.3)
        g = int(61 * (1 - oran) * 0.34 + 92 * oran * 0.3)
        b = int(139 * (1 - oran) * 0.34 + 255 * oran * 0.3)
        ciz.line([(x, 0), (x, h)], fill=(r + 7, g + 6, b + 13))
    # sağ üstte yayın kartı
    kart = Image.new("RGB", (330, 400), (26, 19, 44))
    ciz.rounded_rectangle([820, 130, 1150, 500], radius=34, fill=(28, 20, 48), outline=(70, 55, 100), width=2)
    ciz.ellipse([940, 200, 1030, 290], fill=(255, 147, 196))
    yaz(ciz, "CANLI", 26, (34, 3, 15), (848, 152), kalin=True)
    yaz(ciz, "Elif yayında", 30, (255, 255, 255), (0, 400), kalin=True, ortalama=985)
    yaz(ciz, "1.284 izleyici", 22, (195, 188, 210), (0, 442), ortalama=985)

    yaz(ciz, "TAMUSO", 34, (255, 255, 255), (72, 76), kalin=True)
    yaz(ciz, "Görüntülü sohbet,", 62, (255, 255, 255), (72, 214), kalin=True)
    yaz(ciz, "canlı yayın ve", 62, (255, 255, 255), (72, 292), kalin=True)
    yaz(ciz, "yeni arkadaşlar", 62, (255, 147, 196), (72, 370), kalin=True)
    yaz(ciz, "Sesli odalar · mesajlaşma · keşfet", 28, (195, 188, 210), (72, 468))
    yaz(ciz, "18 yaş ve üzeri · iOS, Android, web", 22, (164, 156, 184), (72, 528))
    hedef = os.path.join(CIKTI, "og.jpg")
    tuval.save(hedef, "JPEG", quality=84, optimize=True, progressive=True)
    print("yazıldı:", hedef, os.path.getsize(hedef) // 1024, "KB")


def logo():
    kaynak = os.path.join(KOK, "assets", "logo-android-512.jpg")
    if not os.path.exists(kaynak):
        print("atlandı (yok):", kaynak)
        return
    gorsel = Image.open(kaynak).convert("RGB")
    kare = kirp(gorsel, False).resize((512, 512), Image.LANCZOS)
    hedef = os.path.join(CIKTI, "logo-512.png")
    kare.save(hedef, "PNG", optimize=True)
    print("yazıldı:", hedef, os.path.getsize(hedef) // 1024, "KB")


if __name__ == "__main__":
    ekranlar()
    og()
    logo()
