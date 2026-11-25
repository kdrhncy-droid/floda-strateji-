# AoH3 HUD Uygulaması (Age of History 3 görsel dili)

`public/assets/aistudio/aoh3_*.jpg` referans ekran görüntülerindeki HUD dili, mevcut
"Obsidyen + Antik Altın" paleti korunarak uygulandı. Oyun mantığı, testler ve mobil
dokunma akışları değişmedi; yalnızca HUD chrome'u ve yeni bir mini harita eklendi.

## Neler eklendi

| Bölge | Bileşen | Not |
| --- | --- | --- |
| Üst şerit | `TopHudBar.tsx` | Sürekli koyu bar (`aoh3-topbar`), sol köşede çift çerçeveli **bayrak kalkanı** + ★ istikrar / eyalet sayacı; **etiketsiz istatistik şeridi** (ikon + büyük serif sayı + küçük alt sayı, hücreler ince altın çizgiyle ayrık); sağda sadece duraklat ikonu, ☰ Divan, −/+ zoom ve **kalın tarih** |
| Divan menüsü | `AoH3TopMenu.tsx` | AoH3'teki tek ☰: zaman (duraklat + 1–5 hız), başkente odak, ulusal marş, haberler, sistem & kayıt. Üst bardaki eski metinli düğmeler buraya taşındı |
| Zoom | `WorldMapCanvas.tsx` / `useMapGestures` | `zoomCommand={{factor, seq}}` prop'u ile üst şeritten harita yakınlaştırma; ayarlardan kapatılabilir (varsayılan açık) |
| Seçim şeridi | `AoH3SelectionChips.tsx` | Makro seçimde (ekonomi / toplu sevk) araç satırının altında **bayraklı eyalet çipleri** + kırmızı ✕ ve "Temizle"; `MapModePillBar`'a eklenen `selectionChipsSlot` üzerinden |
| Alt sol kart | `SelectedProvinceBar.tsx` | Eyalet kartı AoH3 erik-kahve gradyanı + çift altın iç çizgi (`aoh3-quickbar`) |
| Alt sağ | `AoH3Minimap.tsx` | 188×104 px **dünya plakası**: siyasi renkli önbelleklenmiş poligonlar, altın **görüntü alanı dikdörtgeni**, başkent elması, DÜNYA araç şeridi (başkent / + / − / daralt). Tıklama veya sürükleme haritayı o noktaya odaklar |
| Alt sağ üstü | `AoH3ChronicleLog.tsx` | Mini haritanın üstünde **Dünya Gazetesi** kaydı: son 3 olay, ikon + tarih + başlık, tıklayınca haber çekmecesi (yalnızca ≥1280 px) |
| Ordu menüsü | `AoH3OutlinerWidget.tsx` | Panel `aoh3-panel` çerçevesi + bordo (oxblood) **başlık şeridi** "Ordular & Cephe" ve kırmızı ✕ |
| Alt menü | `BottomNavBar.tsx` | `aoh3-nav`: altın hairline, aktif sekmede pirinç plaka; masaüstünde dikey ray korunuyor |
| Görev ipucu | `WorldMapCanvas.tsx` | Ordu/filo hedef seçimi ipuçları AoH3 bordo-altın **`aoh3-hint`** şeridine dönüştürüldü |
| Ayarlar | `CategorizedSettingsPanel.tsx` | "Harita Yakınlaştırma Düğmeleri (AoH3)" anahtarı |

## v2 — "gereksiz yazı" temizliği

Kullanıcı geri bildirimi üzerine üst HUD metinsizleştirildi:

- Kaldırılan metinler: `Menü`, ülke adı + "Monarşi · Diplomasi" alt satırı, `/gün`, `KAPASİTE DOLU`,
  `ORDU`, `ARAŞTIRMA`, `BİLİM BOŞTA`, `+Araştır`, sezon adı, saat, "hız/yıl" etiketi, `1x` rozeti,
  `%` ön eki dışındaki tüm etiketler.
- Üst barda kalanlar: bayrak plakası (★ istikrar + eyalet), 5 istatistik hücresi
  (altın, nüfus, araştırma %, ordu, insan gücü), duraklat ikonu, ☰, −/+ ve tarih.
- İşlev kaybı yok: müzik, haberler, hız 1–5, başkent ve sistem/kayıt **Divan (☰)** menüsünde;
  haber varsa ☰ üzerinde küçük kırmızı nokta görünür.
- Hücreler artık ayrı "pill" değil: tek plaka üzerinde ince altın ayırıcılarla bitişik hücreler;
  sayılar Cinzel serif ile AoH3'teki gibi.

## Tasarım belirteçleri

`src/index.css` sonundaki `AoH3 HUD CHROME` katmanı:

- `--aoh3-ink #0b0907`, `--aoh3-gold-line rgba(200,157,84,.42)`, `--aoh3-gold-bright #e6c07a`,
  `--aoh3-oxblood-a #58241e`, `--aoh3-red #b1454a`
- `.aoh3-topbar`, `.aoh3-crest`, `.aoh3-crest-ribbon`, `.aoh3-stat*`, `.aoh3-dateplaque`,
  `.aoh3-zoom-btn`, `.aoh3-panel`, `.aoh3-panel-title`, `.aoh3-hint`, `.aoh3-minimap*`,
  `.aoh3-quickbar`, `.aoh3-flagchip*`, `.aoh3-plaque`

## Davranış / sınırlar

- Mini harita `lg` (≥1024 px) ve üzerinde görünür; telefonda eyalet kartını örtmesin diye gizli.
- Günlük (chronicle) yalnızca `xl` (≥1280 px) ve alt çekmece kapalıyken görünür.
- Portre telefonda kaynak hücreleri gerekirse yatay kaydırılır; 360 px altında 2×2 ızgaraya düşer.
- Yatay telefon (≤540 px yükseklik) tek satır 44 px chrome'da kalır, ikincil metinler gizlenir.
- Mini harita tabanı yalnızca bir eyalet el değiştirdiğinde yeniden çizilir (`ownershipKey`),
  her tick'te değil; pan sırasında sadece dikdörtgen güncellenir.

## Doğrulama

```
npx tsc --noEmit      # temiz
npm test              # 106/106
npm run check:arch    # 0 döngü, 0 katman ihlali
npm run build         # başarılı
```
