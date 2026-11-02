/**
 * Pazarlama sayfalarının tek stil kaynağı.
 * Sayfa içine satır içi (inline) yazılır: ek istek yok, LCP hızlı, CLS yok.
 */
export const WEB_STIL = `
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#07060d;--bg2:#0c0a15;--kart:#131020;--kart2:#191428;--cam:rgba(255,255,255,.045);
  --cizgi:rgba(255,255,255,.1);--cizgi2:rgba(255,255,255,.2);
  --yazi:#f7f3fb;--soluk:#c3bcd2;--dim:#a49cb8;
  --pembe:#ff3d8b;--pembe2:#ff93c4;--mor:#8b5cff;--mint:#3dffc8;--altin:#ffcf6b;
  --r:20px;--sinir:1180px;
}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--yazi);font:16px/1.68 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
img{display:block;max-width:100%;height:auto}
a{color:var(--pembe2);text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:3px}
main p a,main li a,main dd a,.cevap a,.giris a,.alt p a,footer p a{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
main .kart p a{text-decoration:underline}
:focus-visible{outline:3px solid var(--mint);outline-offset:3px;border-radius:8px}
h1,h2,h3,h4{margin:0;line-height:1.12;letter-spacing:-.02em;font-weight:800;color:#fff}
h1{font-size:clamp(2.05rem,5.4vw,3.6rem);line-height:1.05}
h2{font-size:clamp(1.45rem,3.2vw,2.2rem);letter-spacing:-.015em}
h3{font-size:1.1rem;line-height:1.35;letter-spacing:-.01em}
p{margin:0 0 1rem}
ul,ol{margin:0 0 1rem;padding-left:1.15rem}
li{margin:.35rem 0}
strong{color:#fff;font-weight:700}
.sinir{width:100%;max-width:var(--sinir);margin:0 auto;padding:0 20px}
.atla{position:absolute;left:-9999px;top:0;z-index:60;background:#fff;color:#12040c;padding:14px 20px;font-weight:700;border-radius:0 0 12px 0}
.atla:focus{left:0}
/* ---------- üst bar ---------- */
.ust{position:sticky;top:0;z-index:40;background:rgba(7,6,13,.94);border-bottom:1px solid var(--cizgi)}
.ust-ic{display:flex;align-items:center;gap:12px;min-height:68px}
.marka{display:inline-flex;flex-direction:column;gap:4px;padding:12px 4px;text-decoration:none;flex:0 0 auto}
.marka:hover{text-decoration:none}
.marka-yazi{font-size:1.2rem;font-weight:900;letter-spacing:.34em;color:#fff;line-height:1}
.marka-cizgi{display:block;height:2px;width:58px;border-radius:2px;background:linear-gradient(90deg,var(--pembe),var(--mor))}
.menu-ana{display:flex;align-items:center;gap:2px;margin-left:14px;flex:1 1 auto}
.menu-ana a{color:var(--soluk);font-size:.94rem;font-weight:600;padding:0 12px;min-height:48px;display:inline-flex;align-items:center;border-radius:10px;white-space:nowrap}
.menu-ana a:hover{color:#fff;background:var(--cam);text-decoration:none}
.menu-ana a[aria-current="page"]{color:#fff}
.ust-sag{display:flex;align-items:center;gap:8px;margin-left:auto;flex:0 0 auto}
.dugme{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:999px;font-size:.97rem;font-weight:700;border:1px solid transparent;text-align:center;transition:transform .15s ease,background-color .15s ease}
.dugme:hover{text-decoration:none;transform:translateY(-1px)}
.dugme-dolu{background:linear-gradient(135deg,var(--pembe),#ff6aa8);color:#1a0410}
.dugme-hayalet{background:transparent;border-color:var(--cizgi2);color:#fff}
.dugme-hayalet:hover{background:var(--cam)}
.dugme-buyuk{min-height:54px;padding:0 28px;font-size:1.02rem}
.dugme-tam{width:100%}
.mobil-menu{display:none;margin-left:auto}
.mobil-menu>summary{list-style:none;cursor:pointer;width:48px;height:48px;display:flex;align-items:center;justify-content:center;border:1px solid var(--cizgi);border-radius:12px;background:var(--kart)}
.mobil-menu>summary::-webkit-details-marker{display:none}
.mobil-menu>summary span{display:block;width:20px;height:2px;background:#fff;border-radius:2px;position:relative}
.mobil-menu>summary span::before,.mobil-menu>summary span::after{content:"";position:absolute;left:0;width:20px;height:2px;background:#fff;border-radius:2px}
.mobil-menu>summary span::before{top:-6px}
.mobil-menu>summary span::after{top:6px}
.mobil-panel{position:absolute;left:0;right:0;top:100%;background:var(--bg2);border-bottom:1px solid var(--cizgi);padding:10px 20px 20px;display:grid;gap:2px}
.mobil-panel a{color:#fff;font-size:1rem;font-weight:600;min-height:48px;display:flex;align-items:center;border-bottom:1px solid var(--cizgi)}
/* ---------- hero ---------- */
.kahraman{position:relative;overflow:hidden;padding:clamp(40px,7vw,84px) 0 clamp(36px,6vw,72px)}
.kahraman::before{content:"";position:absolute;inset:-260px -10% auto -10%;height:720px;pointer-events:none;background:
  radial-gradient(40% 58% at 16% 22%,rgba(255,61,139,.3),transparent 68%),
  radial-gradient(38% 56% at 84% 4%,rgba(139,92,255,.26),transparent 70%),
  radial-gradient(30% 40% at 50% 0%,rgba(61,255,200,.08),transparent 70%)}
.kahraman-ic{position:relative;display:grid;grid-template-columns:minmax(0,1.04fr) minmax(0,.96fr);gap:clamp(24px,4vw,54px);align-items:center}
.rozet{display:inline-flex;align-items:center;gap:9px;padding:7px 14px;border-radius:999px;background:rgba(255,61,139,.16);border:1px solid rgba(255,61,139,.34);color:#ffd7e8;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:18px}
/* nabız: box-shadow yerine compositor'da çalışan transform+opacity */
.rozet i{position:relative;width:8px;height:8px;border-radius:50%;background:var(--pembe)}
.rozet i::after{content:"";position:absolute;inset:0;border-radius:50%;background:rgba(255,61,139,.6);animation:nabiz 2.4s ease-out infinite;will-change:transform,opacity}
@keyframes nabiz{0%{transform:scale(1);opacity:.9}70%{transform:scale(2.8);opacity:0}100%{transform:scale(2.8);opacity:0}}
.kahraman h1{max-width:19ch}
.kahraman h1 em{font-style:normal;color:var(--pembe2)}
.kahraman-alt{color:var(--soluk);font-size:clamp(1rem,1.7vw,1.16rem);line-height:1.62;margin-top:18px;max-width:46ch}
.kahraman-btnler{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.guven{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px;padding:0;list-style:none}
.guven li{display:inline-flex;align-items:center;gap:7px;font-size:.82rem;font-weight:600;color:var(--soluk);background:var(--cam);border:1px solid var(--cizgi);border-radius:999px;padding:7px 12px}
.guven li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--mint);flex:0 0 auto}
/* telefon mockup: görsel yok, sıfır bayt */
.sahne{position:relative;display:grid;gap:12px;padding:6px;min-height:380px;align-content:center}
.sahne-kart{position:relative;border-radius:22px;border:1px solid var(--cizgi);background:linear-gradient(160deg,#1b1430,#0f0b1a 68%);box-shadow:0 24px 60px -30px rgba(0,0,0,.9);overflow:hidden}
.sahne-canli{padding:16px 18px 18px;min-height:216px;display:flex;flex-direction:column;justify-content:flex-end;background:
  radial-gradient(60% 70% at 70% 12%,rgba(255,61,139,.34),transparent 70%),
  radial-gradient(50% 60% at 20% 90%,rgba(139,92,255,.3),transparent 72%),
  linear-gradient(160deg,#241736,#0f0b1a 70%)}
.canli-ust{position:absolute;top:14px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.canli-etiket{display:inline-flex;align-items:center;gap:7px;background:rgba(255,61,139,.92);color:#22030f;font-size:.7rem;font-weight:900;letter-spacing:.1em;border-radius:999px;padding:5px 10px}
.canli-etiket b{width:6px;height:6px;border-radius:50%;background:#22030f}
.izleyici{font-size:.72rem;font-weight:700;color:#fff;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 10px}
.yayinci{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;font-size:1.5rem;font-weight:900;color:#2a0417;background:linear-gradient(140deg,#ffd0e4,#ff8fc0 55%,#b98bff);border:2px solid rgba(255,255,255,.7);margin-bottom:12px}
.sahne-ad{color:#fff;font-weight:800;font-size:1.05rem;line-height:1.3;margin:0}
.sahne-not{color:rgba(255,255,255,.76);font-size:.8rem;margin:4px 0 0}
.tepki{display:flex;gap:6px;margin-top:12px}
.tepki span{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2)}
.sahne-sohbet{padding:14px;display:grid;gap:8px;background:linear-gradient(150deg,#161128,#0c0916)}
.balon{max-width:86%;padding:9px 13px;border-radius:16px;font-size:.86rem;line-height:1.4;color:#fff}
.balon-sol{background:#241c38;border-bottom-left-radius:6px;justify-self:start}
.balon-sag{background:linear-gradient(135deg,var(--pembe),#c02d78);color:#210310;font-weight:600;border-bottom-right-radius:6px;justify-self:end}
.sahne-oda{display:flex;align-items:center;gap:12px;padding:12px 14px;background:linear-gradient(120deg,#151029,#0c0916)}
.oda-yuz{display:flex}
.oda-yuz b{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:.72rem;font-weight:800;color:#1a0410;margin-left:-8px;border:2px solid #100c1c}
.oda-yuz b:first-child{margin-left:0}
.oda-yuz b:nth-child(1){background:#ffb3d1}
.oda-yuz b:nth-child(2){background:#c9b6ff}
.oda-yuz b:nth-child(3){background:#9ff3de}
.oda-yazi{font-size:.82rem;font-weight:700;color:#fff;margin:0}
.oda-alt{font-size:.74rem;color:var(--soluk);margin:2px 0 0}
.dalga{display:flex;gap:3px;align-items:flex-end;height:22px;margin-left:auto}
.dalga i{width:3px;border-radius:2px;background:var(--mint);height:8px;animation:dalga 1.1s ease-in-out infinite}
.dalga i:nth-child(2){animation-delay:.15s;height:16px}
.dalga i:nth-child(3){animation-delay:.3s;height:11px}
.dalga i:nth-child(4){animation-delay:.45s;height:20px}
@keyframes dalga{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}
/* ---------- bölümler ---------- */
.bolum{padding:clamp(48px,7vw,88px) 0}
.bolum-dar{padding:clamp(40px,5vw,64px) 0}
.bolum-ust{max-width:64ch;margin-bottom:clamp(24px,3vw,40px)}
.bolum-ust p{color:var(--soluk);margin-top:12px;margin-bottom:0;font-size:1.02rem}
.etiket{display:inline-block;font-size:.76rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--pembe2);margin-bottom:10px}
.izgara{display:grid;gap:16px}
.izgara-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.izgara-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.izgara-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.kart{position:relative;background:linear-gradient(165deg,rgba(255,255,255,.055),rgba(255,255,255,.015));border:1px solid var(--cizgi);border-radius:var(--r);padding:22px}
.kart h3{margin-bottom:8px;color:#fff}
.kart p{color:var(--soluk);font-size:.95rem;margin:0}
.kart-ikon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(255,61,139,.14);border:1px solid rgba(255,61,139,.3);margin-bottom:14px;color:var(--pembe2);font-weight:900;font-size:.9rem}
.kart-bag{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:.88rem;font-weight:700;color:var(--pembe2);min-height:32px}
.adim{background:var(--kart);border:1px solid var(--cizgi);border-radius:var(--r);padding:24px}
.adim-no{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--pembe),var(--mor));color:#fff;font-weight:900;margin-bottom:14px}
.adim h3{margin-bottom:8px}
.adim p{color:var(--soluk);font-size:.95rem;margin:0}
/* ekran görüntüleri */
.ekranlar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.ekran{position:relative;border-radius:22px;overflow:hidden;border:1px solid var(--cizgi);background:#151022}
.ekran img{width:100%;aspect-ratio:3/4;object-fit:cover}
.ekran figcaption{position:absolute;left:0;right:0;bottom:0;padding:34px 16px 14px;font-size:.86rem;font-weight:700;color:#fff;background:linear-gradient(transparent,rgba(7,6,13,.97) 42%)}
/* cta bandı */
.cta-kutu{position:relative;overflow:hidden;border-radius:28px;border:1px solid rgba(255,61,139,.32);background:
  radial-gradient(70% 120% at 12% 0%,rgba(255,61,139,.32),transparent 62%),
  radial-gradient(60% 120% at 88% 100%,rgba(139,92,255,.34),transparent 66%),
  linear-gradient(150deg,#1a1026,#0b0813);
  padding:clamp(28px,4vw,52px);text-align:center}
.cta-kutu h2{max-width:24ch;margin:0 auto}
.cta-kutu p{color:var(--soluk);max-width:52ch;margin:14px auto 0}
.cta-btnler{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:26px}
.cta-not{font-size:.8rem;color:var(--dim);margin:16px 0 0}
/* SSS */
.sss{display:grid;gap:10px;max-width:860px}
.sss details{background:var(--kart);border:1px solid var(--cizgi);border-radius:14px;padding:0 18px}
.sss summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:58px;font-weight:700;color:#fff;font-size:1rem}
.sss summary::-webkit-details-marker{display:none}
.sss summary::after{content:"+";font-size:1.35rem;line-height:1;color:var(--pembe2);font-weight:700}
.sss details[open] summary::after{content:"–"}
.sss .cevap{padding:0 0 18px;color:var(--soluk);font-size:.96rem}
.sss .cevap p:last-child{margin-bottom:0}
/* yazı (içerik sayfaları) */
.yazi{max-width:760px}
.yazi h2{margin:2.2rem 0 .7rem}
.yazi h3{margin:1.6rem 0 .5rem}
.yazi p,.yazi li{color:var(--soluk)}
.yazi ul,.yazi ol{margin:0 0 1.1rem}
.yazi .kutu{background:var(--kart);border:1px solid var(--cizgi);border-left:3px solid var(--pembe);border-radius:0 14px 14px 0;padding:16px 18px;margin:1.4rem 0}
.yazi .kutu p:last-child{margin-bottom:0}
.yazi pre{white-space:pre-wrap;word-break:break-word;font:inherit;color:var(--soluk);margin:0}
.yazi table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.94rem}
.yazi th,.yazi td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--cizgi);color:var(--soluk)}
.yazi th{color:#fff}
.sayfa-bas{position:relative;overflow:hidden;padding:clamp(36px,5vw,60px) 0 clamp(20px,3vw,32px)}
.sayfa-bas::before{content:"";position:absolute;inset:-220px -10% auto;height:520px;background:radial-gradient(45% 60% at 20% 30%,rgba(255,61,139,.22),transparent 70%),radial-gradient(40% 55% at 85% 0%,rgba(139,92,255,.2),transparent 72%);pointer-events:none}
.sayfa-bas-ic{position:relative;max-width:820px}
.sayfa-bas h1{font-size:clamp(1.9rem,4.4vw,3rem)}
.sayfa-bas .giris{color:var(--soluk);font-size:1.06rem;margin-top:16px;max-width:62ch}
.kirinti{display:flex;flex-wrap:wrap;align-items:center;gap:8px;list-style:none;padding:0;margin:0 0 18px;font-size:.82rem;color:var(--dim)}
.kirinti li{display:flex;align-items:center;gap:8px;margin:0}
.kirinti li+li::before{content:"/";color:var(--cizgi2)}
.kirinti a{color:var(--dim)}
.kirinti a:hover{color:#fff}
/* alt bilgi */
.alt{border-top:1px solid var(--cizgi);background:#050409;padding:clamp(36px,5vw,60px) 0 28px;margin-top:0}
.alt-izgara{display:grid;grid-template-columns:1.4fr repeat(3,minmax(0,1fr));gap:28px}
.alt h2{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;font-weight:800}
.alt ul{list-style:none;padding:0;margin:0}
.alt li{margin:0}
.alt li a{display:inline-flex;align-items:center;min-height:40px;color:var(--soluk);font-size:.92rem}
.alt li a:hover{color:#fff;text-decoration:none}
.alt-marka p{color:var(--dim);font-size:.9rem;margin:14px 0 0;max-width:34ch}
.alt-son{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;justify-content:space-between;border-top:1px solid var(--cizgi);margin-top:32px;padding-top:20px;color:var(--dim);font-size:.82rem}
.alt-son p{margin:0}
.yasal-uyari{color:var(--dim);font-size:.82rem;margin:10px 0 0;max-width:70ch}
/* duyarlı */
@media (max-width:1000px){
  .menu-ana{display:none}
  .mobil-menu{display:block}
  .ust-sag .dugme-hayalet{display:none}
  .kahraman-ic{grid-template-columns:minmax(0,1fr)}
  .sahne{max-width:460px;min-height:0}
  .izgara-4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .alt-izgara{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:760px){
  .izgara-2,.izgara-3,.izgara-4{grid-template-columns:minmax(0,1fr)}
  .ekranlar{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .ekran figcaption{font-size:.74rem;padding:24px 8px 8px}
  .ust-sag .dugme{padding:0 16px;font-size:.9rem}
  .kahraman{padding-top:28px}
  .kahraman-btnler .dugme{flex:1 1 100%}
  .alt-izgara{grid-template-columns:minmax(0,1fr)}
  .sahne-canli{min-height:190px}
}
@media (max-width:420px){
  .sahne{display:none}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important}
}
`;
