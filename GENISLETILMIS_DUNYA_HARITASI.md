# Genişletilmiş Dünya Haritası — 916 Eyalet, 3 Kademeli Etiket LOD'u

**Durum:** Uygulandı ve testlerle doğrulandı  
**Kapsam:** 2026 Modern Dünya + 1444 İmparatorluklar Çağı senaryoları

---

## 1. Sonuç özeti

| Ölçüt | Önce | Sonra |
| --- | --- | --- |
| Toplam eyalet (her iki senaryo) | 448 | **916** |
| Tier-3 ilçe / sancak | 0 | **468** |
| Tarihî dönem adı taşıyan ilçe | 0 | **468** |
| Dünya oluşturma süresi (yerel) | ~125 ms | **~180 ms** |
| Eski eyalet kimlikleri (ID) | 448 | **448 (tamamı korundu)** |

Hedef bant 880–920 eyaletti. İlk teslim 895 ile bandın ortasına yerleşti; ardından sınır
görünümünü bozan seyrek bölgelere (Sibirya, Kuzey Kanada, Alaska, Amazon, Avustralya içi)
21 tundra/çöl sancağı eklenerek 916'ya çıkıldı.

## 2. Ülke bazlı ölçekleme (onaylanan plan)

| Ülke | Önce | Sonra |
| --- | --- | --- |
| Türkiye | 20 | 38 |
| Rusya | 18 | 44 |
| Çin | 15 | 34 |
| ABD | 16 | 36 |
| Hindistan | 10 | 26 |
| Almanya | 11 | 20 |
| Fransa | 10 | 19 |
| İtalya / İspanya | 9 | 18 |
| Kanada / Brezilya | 6 | 24 / 17 |
| Birleşik Krallık / İran | 7–8 | 15 |
| Japonya | 7 | 14 |
| Meksika | 3 | 13 |
| Avustralya / Polonya / Güney Kore | 3–6 | 14 / 12 / 12 |
| Ukrayna, Mısır, Suudi Arabistan, Endonezya, Kazakistan, Romanya | 3–6 | 10 |
| Nijerya, Güney Afrika, Etiyopya | 2 | 8 |

Okuma notu: Rusya, Kanada, ABD, Brezilya ve Avustralya satırlarındaki son sayılar, sınır
çizimindeki ince "kama" illeri bölmek için eklenen 21 tundra/çöl sancağını içerir.

Mikro devletler ve küçük adalar (Kıbrıs, İsviçre, Belçika, Lübnan, Lüksemburg,
Bhutan, İzlanda, Fiji, Bahamalar, Karadağ vb.) bilinçli olarak tek/çift eyalet
olarak bırakıldı; parmakla seçim konforu korunuyor.

## 3. Veri modeli

- `ProvinceSubSeed` (`src/engine/core/provinceSeedTypes.ts`)
  - `isDistrict?: boolean` — yeni ilçe/sancak katmanı (Tier 3)
  - `historicName?: string` — 1444 senaryosunda gösterilecek dönem adı
- `COUNTRY_PROVINCE_SEEDS` = orijinal 448 haritanın küratörlü listeden +
  `DISTRICT_PROVINCE_SEEDS` (`src/engine/districtSeeds.ts`, ~468 yeni çekirdek;
  son 21 tanesi seyrek tundra/çöl bölgelerini bölmek için eklendi).
  Mevcut ID'ler, başkent yuvaları ve koordinatlar hiçbir zaman değiştirilmez.
- `Territory.isDistrict` — kayıtlarla geriye uyumlu (eski kayıtlarda `undefined`).

`getNormalizedProvinceShares()` her ülkenin nüfus, GSYİH ve başlangıç ordusu
paylarını tam **1.00**'a normalleştirir. `allocateProportionalTotal()` ordu
toplamını eyaletlere dağıtıp toplamı ülke değerine geri sabitler; böylece
eyalet sayısı iki katına çıkarken küresel güç dengesi bozulmaz.

## 4. 3 kademeli etiket LOD'u

`getMapLabelThresholds()` (BALANCED):

| Kademe | Masaüstü | Mobil | İçerik |
| --- | --- | --- | --- |
| 1 — Genel bakış | < 1.4x | < 1.5x | Devlet isimleri |
| 2 — Bölgesel | ≥ 1.4x | ≥ 1.5x | Başkentler (★, kalın, altın-krem `#FEF3C7`) |
| 2b — Ana şehir | ≥ 1.8x | ≥ 1.95x | Ana şehirler (600, fildişi `#F1F5F9`) |
| 3 — Cephe / ilçe | ≥ 2.4x | ≥ 2.8x | İlçe/sancak (500, gümüş-krem `#CBD5E1`, ~1 px küçük) |

- Seçilen eyalet her zoom'da etiketini korur (`shouldRenderProvinceLabel`).
- COMPACT daha geç, DETAILED daha erken açar; karar saf fonksiyonla test edilir.
- Etiket çakışma önceliği: **Seçili → Oyuncu başkenti → Başkentler → Ana şehirler → İlçeler**.

## 5. 1444 dönem isimlendirmesi

- Her yeni ilçe `historicName` taşır: Saruhan, Karesi, İznikmid, Ayıntab, Ruha,
  Amid, Engürü, Hüdavendigar, Karaman, Canik, Pskov, Novgorod, Echigo, Kaga,
  Flandre, Languedoc, Edo, Naniwa, Tenochtitlan, Qusqu...
- 1444 senaryosu önce senaryo renames'lerini, sonra `historicName`'i uygular;
  böylece "★ Edirne", "★ Konstantinopolis" gibi küratörlü adlar korunur.
- Yeni ilçeler tarihî sahiplere atanır (Akkoyunlu: Ruha/Harput/Mardin,
  Memlük: Antakya, Burgonya: Flandre, Aragon: Sardinya/Sicilya,
  Habsburg: Trieste).
- 2026 senaryosunda modern adlar aynen kalır (Gaziantep, Manisa, Kocaeli...).

## 6. Dayanıklılık ve performans

- `snapSeedsIntoGeometry()` tohumları ana kara poligonuna kilitler; denize düşen
  koordinatlar kıyıya çekilip içeri itilir.
- `resolveProvinceCentroid()` çok-poligonlu ülkelerde etiketi tohumu içeren ana
  kara poligonuna kilitler; denizde kalan merkezlerde tohum koordinatı kullanılır.
- Boş kalan hücreler için bbox tabanlı yedek hücre üretilir; hiçbir ilçe kaybolmaz.
- Komşuluk ve kıyı hesabı mevcut bounding-box ön elemesiyle çalışır; 916 eyalet
  ile açılış süresi hedefin (350 ms) çok altında.

## 7. Doğrulama

`npm test` içindeki yeni testler:

1. 880–920 eyalet, benzersiz ID, tüm başkentler sahipli ve `isCapital`.
2. Her ilçe poligonunun gerçek alanı, ≥ 1 komşusu ve kara üzerinde etiket merkezi.
3. Plan ölçek hedefleri (Türkiye ≥ 36 ... Etiyopya ≥ 8) ve mikro devlet koruması.
4. Her ülkede normalize pay toplamı 1.00; nüfus/GSYİH/ordu toplamı korunuyor.
5. 2026 modern – 1444 dönem adı çiftleri.
6. 3 kademeli LOD kararları ve yoğunluk ayarı sıralaması.
7. 1444 büyük güç sıralaması (Ming, Osmanlı, Memlük, Timur, Kutsal Roma).
8. Sahte canvas bağlamıyla 5 farklı zoom'da etiket çizimi (çalışma zamanı hatası yok).
9. 916 eyaletli dünya oluşturma süresi bütçesi.
