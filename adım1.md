# Floda Strateji Oyunu — Master Araştırma, Değerlendirme ve Uygulama Yol Haritası (`adım1.md`)

> **Durum:** **Faz 1** (60 FPS ordu hareketi, harita sınırları, şehir yazıları, gerçekçi zaman hızı, mobil bildirim/uzun basma) ve **Faz 2** (Floda Strateji Oyunu markası, donanım-uyumlu yükleme ekranı, yenilenmiş ana menü, çevrimdışı öneri/şikayet, v6 kayıt sistemi) **tamamlandı**. Aşağıdaki yol haritası yeni onaylanan **Şehir Gelişim Puanı, Kaynak/Üretim Ekonomisi, Canlı Savaş Rozeti & Tek Merkezli Savaş Masası, Liman İnşası ve Genişletilmiş Araştırma/İnşa** sistemlerini de kapsayacak şekilde güncellendi.

---

## 1. AoH2, AoH2: Definitive Edition ve AoH3 — Kapsamlı Araştırma & Bizimle Kıyaslama

### 1.1. Bu Oyunlar Neden Eğlendiriyor ve Tekrar Oynama İsteği ("Bir Tur Daha") Veriyor?

| Oyun | Görsel & Arayüz Mantığı | Kod / Motor Mantığı | Oyuncuyu Bağlayan & Tekrar Oynatan Sır |
| :--- | :--- | :--- | :--- |
| **Age of History II (AoH2)** | Sade, yüksek kontrastlı siyasi harita; tek tıkla renk değiştiren eyaletler; hızlı okunan harita modları. | Tur bazlı (turn-based) deterministik motor; her eyalette serbest asker yığma; düşük sistem tüketimi. | **Anında tatmin ("harita boyama" döngüsü):** Karmaşık bürokrasiye boğmadan hızlı fetih, alternatif tarih kurma özgürlüğü, sınırsız senaryo ve modlanabilirlik. |
| **Age of History II: Definitive Edition (AoH2 DE)** | Yenilenen çakışmasız menüler, yakınlaştırmaya göre zarifçe solup açılan harita üstü eyalet adları, pürüzsüzleştirilmiş ülke sınırları ve kıyı derinliği. | **Toplu işlem (Batch Actions)** motoru (toplu asimilasyon, festival, yatırım), **otomatik teslimiyet (kapitülasyon)** (%75+ işgal & %50+ savaş skoru), ölü ittifak temizliği (14 turda bir), 32 din sistemi, çoklu ordu sürükle-seç. | **Geç oyun yorgunluğunu yok etmesi:** Oyuncunun 100 eyalete tek tek tıklamasını bitiriyor, sonsuz uzayan anlamsız savaşları kapitülasyonla çözüyor ve daha yüksek harita detayıyla taze hissettiriyor. |
| **Age of History III (AoH3)** | Modern büyük strateji HUD'u, üst-sol bayrak merkezli diplomasi/devlet görünümü, dönem illüstrasyonlu olay ve birim kartları, net cephe/kuşatma göstergeleri. | **Gerçek zamanlı duraklatmalı (Real-Time with Pause)** saatlik/günlük simülasyon; ön hat + arka hat (regiment) muharebesi; insan gücü (manpower), savaş yorgunluğu (war weariness), agresif genişleme (AE) ve teknoloji ağacı. | **Taktiksel derinlik + uzun vadeli ilerleme hissi:** Sadece büyük sayı basmak yetmiyor; doğru ordu kompozisyonu, teknoloji çağı atlamak, büyük güçlerin koalisyonundan kaçınmak ve imparatorluk ekonomisini ayakta tutmak oyuncuyu gerçekten düşündürüyor. |

### 1.2. Biz Şu An Neredeyiz? (Dürüst Durum Analizi)

| Alan | Şu Anki Seviyemiz | Güçlü Yönlerimiz | Eksiklerimiz ve AoH Seviyesine Çıkış Fırsatı |
| :--- | :---: | :--- | :--- |
| **Temel Simülasyon & Savaş** | ★★★★☆ | Gerçek zamanlı saat/gün akışı, ön/arka hat taktik muharebesi, kuşatma, insan gücü, agresif genişleme, boğaz/ticaret koridorları, teknoloji ağacı, barış konferansı, AoH2/AoH3 tarzı bayrak diplomasi özeti. | Uzun savaşlarda **otomatik kapitülasyon**, geç oyunda **toplu yükseltme/asimilasyon**, daha sert savaş yorgunluğu ve stratejik karar baskısı eksik. |
| **Harita Görseli & 60 FPS Akıcılık** | ★★★☆☆ | Offscreen arazi önbelleği, RBush hızlı tıklama indeksi, 28x yakınlaştırma, tam şehir isimleri. | **Askerler tik bazlı sıçradığı için "kare kare" yürüyor** (60 FPS ara-kare enterpolasyonu yok). Ülke dış sınırları ile iç sancak çizgileri yeterince ayrışmıyor. Yakınlaşınca şehir yazıları biraz iri kalıyor. |
| **Yapay Zekâ (AI) Hissi** | ★★★☆☆ | Başkent/kuşatma yardımı, barışta bina inşası, temel AI-AI paktları eklendi. | Henüz "gerçek insan oyuncuyla oynuyormuş" hissi vermiyor: Kişilik profilleri (Fetihçi, Tüccar, İntikamcı), savaş öncesi sınır yığınağı, güçlü komşunun gerçek tehdit baskısı ve akıllı ittifak koalisyonları daha derinleştirilmeli. |
| **Ana Menü, Açılış & Atmosfer** | ★★☆☆☆ | Çevrimdışı PWA ve kayıt sistemi mevcut. | Oyun direkt açılıyor; **donanım-uyumlu gerçek yükleme ekranı**, tarihi yağlıboya/gravür ana menü kimliği (**Floda Strateji Oyunu**), geri bildirim butonu, daha zengin müzik ve ses efektleri gerekiyor. |
| **Ayarlar & Yaşam Kalitesi (QoL)** | ★★★☆☆ | Temel otomatik kayıt, AI saldırganlığı, etiket yoğunluğu ve UI ölçeği var. | Grafik/FPS kalitesi, sınır kalınlığı, etiket boyutu, ayrı müzik/SFX ses düzeyi, animasyon akıcılığı, kısayol haritası ve toplu yönetim menüsü eklenmeli. |
| **Kod Kalitesi & Mimari** | ★★★☆☆ | 0 `console.log`, 0 `TODO`, 47 birim testi ve temiz TypeScript derlemesi var. | **30 dosya 450 satırın üzerinde**, 5 ana motor/store dosyası **1.050–1.440 satıra** ulaşmış durumda. Geleceğe yönelik büyüme için modüler parçalama ve tekrar temizliği şart. |

---

## 2. Söylediğin Fikirler Hakkında Dürüst Mühendislik Değerlendirmesi

### ✅ Çok Mantıklı ve Oyunu Bir Üst Lige Taşıyacak Fikirler
1. **Asker hareketlerindeki "kare kare" (düşük FPS) hissini çözmek:** Kesinlikle en kritik görsel iyileştirme. Kök neden bulundu: Ordular yalnızca simülasyon tiki geldiğinde sıçrıyor. Harita zemini zaten önbellekte olduğu için, yalnızca yürüyen orduları 60 FPS `requestAnimationFrame` ile yumuşak kaydırmak (enterpolasyon) mobil pili yormadan müthiş bir kalite sıçraması sağlar.
2. **Ülke dış sınırlarının belirginleşmesi + yakınlaşınca daha küçük ama cam gibi net şehir isimleri:** Haritanın "amatör" değil, profesyonel büyük strateji haritası gibi görünmesini sağlayan en hızlı dokunuş.
3. **Toplu yükseltmeler ve kısayollar (AoH2 DE tarzı):** 25+ eyalete ulaşınca tek tek bina basmak ve asimilasyon yapmak oyuncuyu oyundan soğutur. Toplu bina, toplu asimilasyon, toplu seferberlik ve klavye/dokunmatik kısayollar tekrar oynanabilirliği doğrudan 2 katına çıkarır.
4. **Gerçek arka plan hazırlığı yapan, donanıma göre hızlanan yükleme ekranı:** Harita geometrisini, bayrak önbelleğini ve ses motorunu yükleme sahnesi arkasında parçalayarak hazırlamak ilk kare donmasını bitirir; hızlı telefonda doğal olarak hızlı açılır, yavaş telefonda takılmadan yüklenir.
5. **Klasik tarihi yağlıboya + harita gravürü sanat dili & sabit renk teması ("Floda Strateji Oyunu"):** Tüm ekranlarda tutarlı, oturaklı, akılda kalan bir marka kimliği oluşturur.
6. **Yapay zekâyı insan gibi hissettirmek ve güçlü ülkeleri gerçek tehdit hâline getirmek:** Oyuncunun sadece "herkesi kolayca yutması" yerine büyük güçlerin sınırına ordu yığması, ambargo/koalisyon kurması, ültimatom/baskı hissettirmesi oyuna gerçek gerilim ve stratejik düşünme zorunluluğu katar.
7. **Kod temizliği, tekrarların azaltılması, modüler dosya yapısı ve sağlam save sistemi:** Oyun büyüdükçe yeni sistemlerin birbirini bozmasını önler; sürümlü ve bozulma korumalı kayıt sistemi oyuncunun saatlerce emeğini güvence altına alır.
8. **Ana menüde çevrimdışı taslak + e-posta/kopyala geri bildirim & şikayet butonu:** İnternetsiz oynanışı hiç bozmadan doğrudan oyuncu geri bildirimi toplamanın en temiz yoludur.
9. **Testleri ve bol ekran görüntülü doğrulamayı sona bırakmak:** Her şeyi bitirip masaüstü + iPhone dikey/yatay ekranlarda toplu test etmek hem zaman kazandırır hem gerçek kullanıcı gözüyle hataları tek seferde yakalar.
10. **Şehir Gelişim Puanı + Koyulaşan Ekonomi Haritası + Üretim Kaynakları & Yatırım Odaklı Değer Sistemi:** Harika ve oyunu gerçek bir büyük stratejiye dönüştüren sistem. Her şehrin nüfus, bina yatırımı, kaynak geliştirme ve teknoloji etkisinden oluşan net bir **Gelişim Puanı** olması; Ekonomi haritasında çok gelişen şehirlerin koyu zengin tonlara bürünmesi; Kaynak haritasında şehirlerin üstünde üretim kaynaklarının (kereste/odun, hayvancılık/sığır, pamuk, altın, demir, tahıl, ipek/baharat, petrol vb.) ufak net simgelerle görünmesi haritayı canlı kılar. Özellikle *"ham maddenin taban değeri olsa da asıl farkı nereye yatırım yapıldığı belirler"* yaklaşımı, kaynak şansını değil oyuncu stratejisini ödüllendirir.
11. **Ekranda Canlı Savaş Rozeti (İki Bayrak + Yeşil/Kırmızı Savaş Skoru %) & Tek Merkezli Savaş Masası:** EU4 / AoH3 düzeyinde en etkili arayüz yükseltmesi. Savaş sırasında ekranda iki devletin bayrağı ve altında dinamik yüzde (+ yeşil / - kırmızı) görünmesi, tıklandığında taraflar, müttefikler, **Müttefik Çağır**, kayıplar, güç dengesi, **Barış Talebi / Galipsiz (Beyaz) Barış / Teslim Ol** aksiyonlarının tek masada toplanması ve eski dağınık savaş kontrollerinin kaldırılması hem oynanışı hızlandırır hem mobil HUD'ı sadeleştirir.
12. **Savaş Puanı Bütçeli Çoklu Barış Konferansı (AoH2 / AoH3 / EU4 Tarzı):** Savaşta kazanılan puanların barış masasında **harcama bütçesi** olması çok mantıklı ve tatmin edici. Her şehrin gelişim puanına göre bir puan bedeli olur; oyuncu aynı masada **tek tek şehir talep etme**, **tek tıkla işgal edilen tüm şehirleri seçme**, tek tek basmadan **Komple İlhak Et**, **Vasal Yap** ve **Haraca Bağla / Savaş Tazminatı** seçeneklerini puan bütçesi elverdiğince birleştirebilir.
13. **Kıyı Şehirlerine Özel Liman İnşası + Genişletilmiş Araştırma ve İnşa Seçenekleri:** Denizle sınırı olan (`isCoastal`) şehirlerde Liman/Tersane inşa edilebilmesi stratejik coğrafyaya gerçek ağırlık katar. Yeni üretim/ekonomi/idari binalar ve daha derin araştırma dalları, yatırım stratejisini doğrudan destekler.
14. **Gerçek Poligon Sınırına Göre Akıllı Ordu Rotası (Dolanma Hatasının Kök Çözümü):** %100 haklı bir tespit — kod incelemesinde kök neden bulundu! Yeni şehirler eklendiğinde komşuluk grafiği her şehri yalnızca en yakın `3` merkeze, ülke sınırlarında ise yalnızca `2` çifte bağladığı için haritada yan yana duran şehirler bağlantısız kalıyor ve A* orduları 3–4 şehir dolaştırıyor. Gerçek poligon kenar temasından komşuluk üretip `cos(enlem)` mesafeli A* kurmak bu sorunu kökten bitirir.
15. **"Sefer" Yerine "Hareket", Zorunlu Yüzde Kaldırılıp %100 Sevk, Ok Kirliliği Olmadan Doğrudan Tıklanan Şehre İlerleme + Böl/Birleştir/Sil + Askerî Menüden Asker Basma:** Oynanışı katbekat hızlandırır ve gereksiz menü sürtünmesini kaldırır. Oyuncu %100'ünü tek tıkla yürütür; isterse haritadan seçtiği orduyu **Böl**, yeni basılanlarla **Birleştir** veya **Sil (Terhis)** yapar; Askerî menüde de doğrudan **Asker Bas** butonuna erişir.
16. **Bayrak Altında "Yapay Zekâya Devret" (Oyuncu İçin Akıllı Savaş Komutanı):** Büyük imparatorluklarda 20–30 cepheyi tek tek yönetmek istemeyen oyuncu için müthiş bir özellik. Öncelik sırası: (1) Kuşatılan şehir/başkente acil destek, (2) İşgal altındaki toprağı geri alma & zayıf sınır savunması, (3) Kazanılabilir güç oranıyla (`>= 1.15x`) fırsatçı taarruz, (4) Arka hat ordularını cepheye birleştirme.

### ⚠️ Dikkatli ve Ölçülü Uygulanması Gereken (Aşırıya Kaçılırsa Sorun Çıkarabilecek) Noktalar
1. **Yükleme ekranında yapay bekleme (sahte progress bar) YAPILMAMALI:** Yükleme süresi tamamen cihazın gerçek harita/bayrak/ses hazırlığına bağlanmalı; güçlü cihazda 0.6 saniyede bitiyorsa kullanıcıyı zorla 5 saniye bekletmek yerine hızlıca açılmalı (yalnızca anlık göz kırpmasını önlemek için kısa pürüzsüz geçiş animasyonu olur).
2. **Her küçük butondaki ikonları ağır resimlere çevirmek MANTIKSIZDIR, stratejik yüzeylerde illüstrasyon kullanmak MANTIKLIDIR:** Anlamsız emoji ve gereksiz süs ikonları mutlaka temizlenmeli; ancak 32px'lik küçük HUD butonlarına yüksek çözünürlüklü resim koymak okunabilirliği bozar ve RAM tüketir. Bunun yerine **büyük yüzeylerde** (yükleme ekranı tabloları, ana menü sahnesi, savaş/olay kartları, birlik sınıfları) optimize yağlıboya görseller; küçük aksiyon butonlarında ise net metin + sade çizgisel simgeler kullanılmalıdır.
3. **Aşırı fazla ayar karmaşası yerine kategorili gelişmiş ayarlar:** Seçenek sayısı kesinlikle artmalı (Grafik/FPS, Harita/Sınır/Etiket, Ses/Müzik, Oynanış/AI, Kayıt/Arayüz), ancak hepsi tek uzun listede değil, temiz sekmeler hâlinde sunulmalı ki mobilde boğucu olmasın.
4. **Dönem Tutarlılığı (Kaynaklar) ve Bina Kalabalığı Kontrolü:** 1440 senaryosunda Petrol/Yarı İletken yerine döneme uygun **Altın, Demir, Kereste (Odun), Pamuk, Hayvancılık (Sığır), Tahıl, İpek/Baharat, Tuz/Gümüş** aktif olmalı; Petrol, Doğalgaz ve Yarı İletken 2026 (veya ileri sanayi çağı) senaryosunda öne çıkmalıdır. Ayrıca 40 tane birbirinin kopyası bina yerine her biri gerçek etki yapan **10–12 net stratejik bina** ve sadece deniz kıyısında açılan **Liman** kuralı korunmalıdır.
5. **Kaynak Haritasında Görsel Kalabalık Koruması:** Kaynak ikonları yalnızca **Kaynaklar** harita modu seçildiğinde (ve okunabilir yakınlaştırma seviyesinde) çizilmeli; normal siyasi haritada şehir isimleriyle çakışmamalıdır.
6. **"Hareket" Modunda Savaşta Olmadığın Ülkeye Yanlışlıkla Tek Tıkla Savaş Açma Riski:** Zaten savaşta olduğun düşman şehirlerine ve kendi/müttefik şehirlerine **sıfır onay, ok kirliliği olmadan tek tıkla anında** ilerlenmeli; ancak barışta olduğun bir ülkenin şehrine yanlışlıkla dokunulduğunda yalnızca kısa bir *"Savaş İlan Et ve Saldır?"* onayı korunmalıdır.
7. **"Asker Sil" (Terhis) ve "Yapay Zekâya Devret" Güvenlik Sınırları:**
   - Asker silme (terhis) yalnızca **kendi toprağında ve muharebe dışındayken** yapılabilmeli (kuşatma altındayken düşmana savaş skoru vermemek için hileyle silme açığını kapatır) ve terhis edilen askerlerin insan gücü (%75'i) havuza iade edilmelidir.
   - "Yapay Zekâya Devret" açıkken yapay zekâ **ASLA oyuncunun adına yeni ülkelere savaş açmamalı veya barış/toprak vermemelidir**; yalnızca aktif savaşlarda ordu sevk/savunma/taarruz görevini üstlenmeli ve tek tıkla anında devreden çıkarılabilmelidir.

### 🔍 Yapay Zekâ (Diğer Ülkeler) Mevcut Kod Denetimi
| AI Yeteneği | Şu An Var mı? | Şu Anki Kalite | Tespit Edilen Eksikler & Yapılacak İyileştirme |
| :--- | :---: | :---: | :--- |
| **Diplomasi (Ticaret, Savunma Paktı, Saldırmazlık)** | ✅ Var | ★★★☆☆ | Barışta komşularla Ticaret, güçlü/yüksek AE tehdit varsa Savunma Paktı (en fazla 2 ittifak), denk güçlerle Saldırmazlık imzalıyor. **Eksik:** Oyuncuya aktif diplomatik teklif göndermiyor, düşmanın düşmanıyla bölgesel ittifak aramıyor, ambargo/ilişki yönetimini sınırlı kullanıyor. |
| **Asker Basma** | ✅ Var | ★★★☆☆ | Hazinesi ve insan gücü yettiğinde en zayıf sınır şehrine `6.000–9.000` asker basıyor. **Eksik:** Büyük imparatorluklar savaşta ekonomisine orantılı çok cepheli seferberlik yapmıyor, hep sabit küçük paket basıyor. |
| **Şehir Geliştirme (Bina İnşası)** | ✅ Var | ★★★☆☆ | Barışta sınır kalesi, kışla, boğaz ticaret merkezi, fabrika ve üniversite yükseltiyor. **Eksik:** Yeni **Liman**, **Kaynak/Üretim Tesisi** ve **Şehir Gelişim Puanı** öncelikleri henüz eklenmedi. |
| **Teknoloji & Modernizasyon** | ✅ Var | ★★★★☆ | Araştırma puanı yettiğinde önce Askerî, sonra Ekonomi teknolojisini açıp ordusunu bir üst kademeye modernize ediyor. **Eksik:** Devlet kişiliğine göre (Tüccar/Fetihçi/Bilim) stratejik dal uzmanlaşması eklenmeli. |

---

## 3. Son İsteğin: 1440 Yılındaki Tüm Ülkeleri ve Şehirleri Eklemeli miyiz? (Net Fikrim)

**Kısa ve dürüst cevabım:** **Şu an tek seferde "tüm dünyadaki 300+ küçük 1440 beyliği ve 1.500+ şehri" birden eklemek mantıksız ve riskli; ancak Faz 1 (60 FPS + sınır/etiket + kod temizliği) bittikten hemen sonra KADEMELİ olarak 80–120 tarihi devlete ve 600+ şehre çıkarmak için tam zamanı!**

### Neden Bu Kararı Öneriyorum?
- **Şu anki durum:** 1440 senaryomuzda şu an **24 ana devlet** var. Bu sayı Avrupa, Anadolu, İtalya, Almanya ve Asya'daki tarihi zenginliği tam yansıtmaya yetmiyor (örneğin Anadolu beylikleri, Balkan prenslikleri, İtalyan şehir devletleri, Alman/Rus knezlikleri, İslam ve Asya devletleri eksik kalıyor).
- **Neden tek seferde 1.500+ şehir tehlikeli?**
  1. Mobil telefonlarda (özellikle Safari / iOS RAM sınırında) binlerce poligon ve yüzlerce aktif AI devletinin her saat hesaplanması pil tüketimini ve ısınmayı patlatır, FPS'i düşürür.
  2. Küçük telefon ekranında çok ufak eyaletlere parmakla dokunmak zorlaşır.
- **En Akıllı Çözüm (Kademeli 1440 Genişlemesi):**
  - **Önce (Faz 1):** 60 FPS harita motoru + net devlet dış sınırları + küçük/okunaklı yakınlaştırma şehir adları + AI performans optimizasyonu tamamlanır.
  - **Sonra (Faz 5):** 1440 haritası **80–120 önemli tarihi devlet** ve **600+ stratejik şehir** hedefine çıkarılır (Anadolu beylikleri, Balkanlar, İtalya, Kutsal Roma prenslikleri, Rus knezlikleri, Memlük/Safevi-Akkoyunlu/Timur/Hindistan/Ming/Japonya/Afrika krallıkları).
  - **Gelecek Seçeneği (Ayarlar'da):** Güçlü cihazlar için ileride "Standart 1440" ve "Ultra Detay 1440" harita yoğunluk seçeneği eklenebilir.

---

## 4. Floda Strateji Oyunu — Sıralı Uygulama Görev Listesi

> **Uygulama Kuralı:** Tüm fazlar aşağıda onaylanan sıraya göre (önce 60 FPS + harita + kod temizliği) yapılacak; kapsamlı testler ve ekran görüntülü kontroller en son fazda (Faz 6) eksiksiz tamamlanacaktır.

#### Faz 1 — 60 FPS Ordu Hareketi, Harita Sınırları, Şehir Yazıları, Gerçekçi Zaman Hızı ve Mobil Bildirim/Tooltip *(Uygulandı — Kod Modülerleştirme Devam Ediyor)*
- [x] **1.1. 60 FPS Akıcı Ordu Hareketi (Alt-Kare Enterpolasyonu):** Hareketli ordular için `prevProgress → nextProgress` zaman damgalı ara-kare (`lerp`) enterpolasyonu ve sürekli adım animasyonu kuruldu; harita zemini offscreen önbellekten kopyalanırken yalnızca yürüyen ordular 60 FPS katmanında pürüzsüz çiziliyor, oyun duraklatıldığında veya hareket yoksa döngü otomatik uyuyor.
- [x] **1.2. Profesyonel Ülke Sınırları & İç Eyalet Ayrımı:** Çok katmanlı kartografik kenar sınıflandırıcı eklendi: aynı devlet içindeki eyalet/sancak sınırları ince ve göz yormayan çizgilerle, uluslararası devlet dış sınırları çift geçişli kalın gravür konturuyla, deniz kıyıları net kıyı çizgisiyle ve oyuncunun kendi sınırları altın kenar vurgusuyla ayrıştırıldı.
- [x] **1.3. Yakınlaşınca Daha Küçük ve Zarif Şehir İsimleri:** Yakınlaştırma seviyelerindeki şehir yazısı punto ve kenarlık kalınlığı küçültülüp keskinleştirildi (`Plus Jakarta Sans`, dengeli punto, ince koyu hale).
- [x] **1.4. Gerçekçi Zaman Hızı Kalibrasyonu (5x Dahil Takip Edilebilir Akış):** Tüm hız kademeleri ortak saat profiline (`gameClockConfig`) alındı; 5x hızında bile bir oyun yılı 10–15 saniyede geçmeyecek şekilde gerçekçi ve takip edilebilir tempoya (5x: `270ms` / `+4 Saat`) çekildi.
- [x] **1.5. Yatay & Dikey Mobil Uyumlu Otomatik Kaybolan Dünya Diplomasi/Savaş Bildirimleri:** Dünyadaki savaş ilanları, barış antlaşmaları, savunma paktları, koalisyonlar ve isyanlar için ekranı kapatmayan, ~5.6 saniye sonra otomatik kaybolan (tıklanınca detaya giden) canlı bildirim kartları eklendi.
- [x] **1.6. Mobil & iOS Uzun Basma (Basılı Tutma) Tam Metin Açıklama Penceresi:** `…` ile kısaltılmış tüm yazılar, etiketler, ülke/eyalet çipleri ve açıklamalı butonlar üzerinde parmakla ~0.4 saniye basılı tutulduğunda tam metni ve açıklamasını gösteren ekran-güvenli pencere eklendi.
- [x] **1.7. Monolit Motor Dosyalarının Dengeli Modülerleştirilmesi (20–30 Satırlık Mikro Dosya Yasağı):** Büyük motor dosyaları dengeli sorumluluklarla ayrıştırıldı; gereksiz 20–60 satırlık ufak dosyalar ana modüllerine birleştirilerek dosya kalabalığı önlendi.

### Faz 2 — Donanım-Uyumlu Yükleme Ekranı, "Floda Strateji Oyunu" Ana Menüsü, Kayıt Sistemi ve Geri Bildirim *(Uygulandı)*
- [x] **2.1. Marka Kimliği ve Sabit Tema Sistemi:** Oyun başlığı, meta etiketleri, ana menü ve yükleme ekranı **Floda Strateji Oyunu** markasına ve sabit **Klasik Tarihi Yağlıboya & Harita Gravürü** (`--floda-*` CSS tokenları) renk temasına bağlandı.
- [x] **2.2. Gerçek Donanım-Uyumlu Yükleme Ekranı:**
  - [x] Oyuna girişte cihaz donanım profili, kayıt arşivi, harita geometrisi, bayrak önbelleği ve tarihi görseller gerçek arka plan aşamalarıyla hazırlanıyor; cihaz güçlüyse daha hızlı açılıyor.
  - [x] Yükleme sırasında dönen **4 tarihi savaş yağlıboya tablosu** ve 12 Türkçe strateji ipucu gösteriliyor.
- [x] **2.3. Yenilenmiş AoH3 Tarzı Çift Yönlü Ana Menü & Kömür-Bronz Altın Tema:** Yatay (`16:9`) ve dikey (`9:16`) ekranlar için ayrı tarihî yağlıboya tablolar, Age of History 3 tarzı sıcak kömür-bronz & eskitme altın renk paleti, dikey komut dizilimi (*Devam Et, Yeni Oyun, Oyun Yükle, Haritadan Seç, Ayarlar, İpuçları, Öneri ve Şikayet*) tamamlandı.
- [x] **2.4. Çevrimdışı Şikayet ve Geliştirme Önerisi Penceresi:** Kategori seçimi (Öneri, Hata, Denge, Görsel, Mobil HUD), zorunlu alan doğrulaması, anonim cihaz/ekran özeti ekleme, çevrimdışı taslak kaydetme/düzenleme/silme, tek tıkla kopyalama ve `mailto:` e-posta gönderimi eklendi.
- [x] **2.5. Kurşun Geçirmez Kayıt (Save/Load) Sistemi:** Şema v6, deterministik bütünlük özeti (checksum), v3/v4/v5 -> v6 otomatik sürüm göçü, üzerine yazma öncesi otomatik geri dönüş yedeği (rollback), bozuk kayıt kurtarma ve `.json` dışa/içe aktarma eklendi.

### Faz 3 — Akıllı Ordu Rotası/Kontrolleri, "Yapay Zekâya Devret", Ekonomi/Kaynak Puan Sistemi, Canlı Savaş Masası, Limanlar ve Gelişmiş Ayarlar
- [x] **3.0. Akıllı Poligon Rotası, Doğrudan "Hareket" (%100), Ordu Böl/Birleştir/Sil, Asker Basma & "Yapay Zekâya Devret" Komutanı:**
  - [x] **Gerçek Poligon Komşuluk Grafiği + Düzeltilmiş A\*:** Yeni eklenen şehirler dahil haritada fiziksel sınır paylaşan tüm şehirler doğrudan komşu bağlandı; `cos(enlem)` destekli gerçek coğrafi mesafeyle gereksiz dolanmalar tamamen bitirildi.
  - [x] **"Hareket" Akışı (%100 Varsayılan, Ok Kirliliği Yok):** "Sefer" etiketi yerine **Hareket** kullanıldı; zorunlu yüzde seçimi olmadan varsayılan **%100 ordu** sevk ediliyor; Hareket'e basıldığında haritada karmaşık oklar çizilmiyor, tıklanan kendi şehrine veya savaşta olunan düşman şehrine doğrudan en kısa rotayla ilerleniyor.
  - [x] **Haritadan Ordu Yönetimi (Böl / Birleştir / Sil):** Haritada ordusu olan kendi şehri seçildiğinde **Hareket**, **Böl** (%25/%50/%75), **Birleştir** (komşu garnizonları tek orduda toplama) ve **Asker Sil / Terhis** (barışta/kendi toprağında fazla orduyu silip insan gücünün %75'ini geri alma) butonları eklendi.
  - [x] **Askerî Menüde Doğrudan "Asker Bas" Butonu:** Alt çubuktaki Askerî/Ordugâh sekmesine basıldığında doğrudan şehir ve birlik seçip tek tıkla asker basma paneli eklendi.
  - [x] **"Yapay Zekâya Devret" (Akıllı Oyuncu Savaş Komutanı):** Ülke bayrağının hemen altındaki sol üst kontrol çubuğuna tek dokunuşluk **Yapay Zekâya Devret** aç/kapa düğmesi eklendi. Açıkken aktif savaşlarda: (1) Kuşatılan şehir/başkente acil destek, (2) İşgal altındaki toprağı kurtarma ve tehdit altındaki sınırı savunma, (3) Kazanılabilir güç oranıyla (`>= 1.15x`) düşman toprağı fethetme, (4) Yeni basılan/arka hat birliklerini cepheye birleştirme akışını yürütüyor (oyuncu adına asla yeni savaş açmaz, barış vermez veya asker silmez).
- [x] **3.1. Şehir Gelişim Puanı & Koyulaşan Ekonomi Harita Modu:**
  - [x] Her şehir için nüfus, bina seviyeleri, üretim kaynağı yatırımı ve teknoloji çarpanından hesaplanan **Şehir Gelişim Puanı (`calculateProvinceDevelopment`)** formülü eklendi.
  - [x] **Ekonomi** harita moduna basıldığında yüksek gelişim puanına sahip zengin şehirler koyu zümrüt (`#042F2E` / `#064E3B` / `#047857`), az gelişmiş şehirler açık soluk tonlarda (`#6EE7B7` / `#94A3B8`) gösteriliyor; şehirlerin üzerinde `★Puan` rozeti ve şehir seçildiğinde detaylı puan kırılımı yer alıyor.
- [x] **3.2. Şehir Üretim Kaynakları, Kaynak Haritası Modu & Yatırım Odaklı Değer Ekonomisi:**
  - [x] Her şehre döneme ve coğrafyaya uygun üretim kaynağı atandı (**🪵 Odun/Kereste, 🐄 Hayvancılık/Sığır, 🌿 Pamuk Tarlası, 🌾 Tahıl, ⛏ Demir, 🪙 Altın, ⚓ Ticaret Boğazı, 🛢 Petrol, 🔥 Doğalgaz, 🔬 Yarı İletken/Zanaat, 🏛 Finans**) ve her kaynağın ham piyasa değeri tanımlandı.
  - [x] **Yatırım Odaklı Değer Çarpanı:** Kaynağın ham değeri başlangıç avantajı sağlasa da asıl üretim ve gelir artışı **o şehre yapılan bina yatırımı (`×buildingInvestmentMult`) ve ilgili ekonomi/bilim teknolojilerine (`×techInvestmentMult`)** bağlandı; yatırım yapılan bir Pamuk/Odun şehri, yatırımsız kalan bir Petrol/Altın şehrini geride bırakıyor.
  - [x] **Kaynaklar (`RESOURCES`)** harita modu eklendi: basıldığında şehirlerin üstünde üretim kaynaklarının ufak, sade ve okunaklı simgeleri ile yatırımlı üretim değerleri (`🪵 45A`, `🐄 48A`, `🌿 64A`, `🪙 82A`, `🛢 88A`) görünüyor.
- [x] **3.25. Ülke Bayrağı Komuta Menüsü (Yapay Zekâya Devret + Fethedilen Ülkeler), Seçmeli Özel Üretim İnşası, AoH3 Bildirim/Ses Sistemi, Asimilasyon Düzeltmesi ve İşgal Diplomasi Cezası *(Tamamlandı)*:**
  - [x] **"Yapay Zekâya Devret" Butonunun Ülke Bayrağı Menüsüne Taşınması:** Ana harita ekranındaki kalabalığı azaltmak için "Yapay Zekâya Devret" butonu harita üstünden kaldırılıp, sol üstteki **Ülke Bayrağına tıklandığında açılan devlet menüsünün alt kısmındaki özel komuta alanına** taşındı.
  - [x] **Yapay Zekâya Devret FPS Koruması (Sıfır FPS Düşüşü):** `evaluatePlayerAiCommander` barışta hiç çalışmıyor; savaşta ise her alt-saat tiki yerine yalnızca tam gün geçişinde (`dayWrapped`) çalışıyor ve yeni bir hareket emri çıkmadığında `territories` nesnesini klonlamayıp `null` dönüyor (böylece React/Canvas gereksiz yeniden çizim yapmıyor, 60 FPS korunuyor).
  - [x] **Ülke Bayrağı Menüsünde "Fethedilen & Tarihe Karışan Ülkeler" Sicili:** Oyuncu kendi ülke bayrağına (veya başka bir büyük devlete) tıkladığında açılan menüde, o devletin savaşlarla tamamen ilhak ettiği / tarihe gömdüğü veya topraklarını fethettiği ülkelerin bayrakları, isimleri ve fetih durumu listeleniyor.
  - [x] **Kısayollarda "Ekonomi Kur" Yerine Şehir Seçmeli Özel Üretim Tesisi İnşası:** Hızlı İşlem menüsündeki tek tip "Ekonomi Kur" değiştirildi; oyuncu önce yatırım yapacağı şehirleri (tekli veya çoklu) seçiyor, ardından o şehirlere uygun üretim tesisini (**🐄 İnek & Sığır Çiftliği, 🌿 Pamuk Tarlası, 🪵 Kereste & Odun Atölyesi, 🌾 Tahıl Ambarı, ⛏ Demir Ocağı, 🪙 Altın Darphanesi, 🛢 Petrol Rafinerisi**) net **Altın maliyeti** ve **günlük gelir katkısını** görerek kurabiliyor.
  - [x] **Menü Arkasında Kalan Uyarı Bildirimi (Z-Index) Düzeltmesi:** İlişki yüksekken, ateşkes varken veya pakt bulunurken "Savaş İlan Et"e basıldığında çıkan uyarı bildiriminin (`toastMessage`) açık diplomasi penceresinin arkasında (`z-30`) kalması sorunu giderildi (`z-[120]` katmanı + pencere içi anlık uyarı satırı ve "Hakaret Et (-25)" kısayolu).
  - [x] **AoH3 Tarzı Kompakt, Kapatılabilir Bildirim Sistemi & Yumuşatılmış Tarihî Sesler:** Savaş ilanı ve şehir düşmesi sırasında çıkan aşırı büyük, kapatılamayan ve sert/rahatsız edici ses çıkaran bildirimler kaldırıldı; yerine Age of History 3 tarzı **ufak, zarif, sağ üst/orta-üstte tek tıkla (`✕`) anında kapatılabilen, 3.5 saniye sonra kendiliğinden kaybolan** bildirim şeritleri ve kulağı yormayan tok/yumuşak (`BiquadFilterNode` alçak geçiren filtreli) tarihî mühür-davul sesleri getirildi.
  - [x] **Savaş Sonrası Asimilasyon (Öz Vatan / Core) Mantığının Baştan Sona Düzeltilmesi:**
    - Savaş sırasında geçici işgal edilen (`isOccupied: true`) şehirlerle barış antlaşmasıyla/fetihle alınan şehirler ayrıştırıldı; fethedilen her yabancı şehrin `assimilation` değeri net biçimde `%25` ve `coreOwnerId` değeri eski sahibi olarak işaretleniyor.
    - Mobil ve masaüstünde eyalet çekmecesinin hangi sekmesinde olunursa olunsun (ve hızlı şehir çubuğunda) yabancı/entegre olmamış şehirler için **"Asimile Et (180 Altın + Canlı % İlerleme)"** butonu doğrudan görünür oldu; zaten `%100 Core` olan öz vatan şehirlerinde hatalı asimilasyon butonu çıkmıyor.
  - [x] **İşgal ve İlhakta Dost/Müttefik Ülkelerle İlişki Düşüşü (Diplomatik Tepki):** Oyuncu (veya bir devlet) bir ülkeye savaş açtığında, şehirlerini ilhak ettiğinde veya vasallaştırdığında; kurban ülkenin **müttefikleri (`-35`), ticaret/saldırmazlık ortakları ve dostları (`score >= 25` olanlar `-20`), aynı din/kültürden komşuları (`-12`)** ile işgalcinin diplomatik ilişkisi otomatik düşüyor ve koalisyon/tepki bildirimi oluşuyor.
- [x] **3.3. Canlı Savaş Rozeti (HUD), Tek Merkezli Savaş Masası & Puan Bütçeli Barış Konferansı (Eski Dağınık Savaş Arayüzlerinin Kaldırılması) *(Tamamlandı)*:**
  - [x] Oyuncu bir ülkeyle savaştayken ekranda (yatay ve dikey mobil güvenli konumda) **[Oyuncu Bayrağı ⚔ Rakip Bayrağı]** savaş rozeti ve hemen altında anlık **Savaş Skoru %** göstergesi çıkıyor.
  - [x] Toprak alan / üstünlük kuran taraf oyuncuysa yüzde artıp gitgide **yeşile** dönüyor; toprak kaybeden / geriye düşen taraf oyuncuysa eksi (`-`) değere düşüp gitgide **kırmızıya** dönüyor.
  - [x] Rozete tıklandığında **Tek Merkezli Savaş Masası (`UnifiedWarAndPeaceModal`)** açılıyor: ana taraflar, savaşa katılan tüm müttefikler, **Savaşa Müttefik Çağır** butonu, tarafların asker kayıpları, işgal edilen eyalet sayısı, canlı güç dengesi çubuğu ve **Barış Talebi / Galipsiz Barış (Beyaz Barış) / Teslim Ol** butonları tek merkezde sunuluyor.
  - [x] **Savaş Puanı Bütçeli Barış Konferansı:** Savaşta kazanılan puan kadar barış bütçesi (`Harcanan / Kazanılan Puan`) oluşuyor; her şehrin gelişim puanına göre puan maliyeti var. Aynı masada şu seçenekler puan yettiğince birleştirilebiliyor:
    - [x] **Şehir / Toprak Talep Etme** (tek tek seçim + **Tek Tıkla İşgal Edilenleri Seç** kısayolu).
    - [x] **Komple İlhak Et** (tek tek basmadan tüm ülkeyi tek tuşla alma — puan bütçesi yettiğinde ve yüksek AE bedeliyle).
    - [x] **Vasal Yap** (rakibi bağlı devlete dönüştürme).
    - [x] **Haraca Bağla & Savaş Tazminatı** (düzenli gelir payı / yıllık haraç + nakit tazminat).
    - [x] Canlı kabul göstergesi (*Kabul Eder / Puan Aşıldı*) ile net onay akışı.
  - [x] Eski dağınık/mükerrer savaş ve barış erişim katmanları temizlenip tüm savaş akışı bu tek merkezli sisteme bağlandı.
- [x] **3.4. Kıyı Şehirlerine Özel Liman İnşası + Genişletilmiş İnşa ve Araştırma Seçenekleri:**
  - [x] Denizle sınırı olan şehirler (`isCoastal`) otomatik/coğrafi olarak işaretlendi ve **yalnızca kıyı şehirlerinde Liman / Tersane** inşa edilebiliyor (deniz ticareti geliri, boğaz/kıyı savunması ve stratejik liman puanı sağlar; iç kara şehirlerinde kilitlidir).
  - [x] İnşa seçenekleri zenginleştirildi (Mevcut 6 binaya ek olarak **Kıyı Limanı & Tersane**, **Darphane & Vergi Dairesi**, **Erzak & Tahıl Ambarı** + çoklu şehir özel üretim tesisi yatırımları — toplam 9 ayırt edici bina + özel üretim tesisleri).
  - [x] Araştırma (Teknoloji) ağacı **Kademe V (Altın Çağ)** ile genişletildi: her 4 dalda (Askeri, Ekonomi, İdare, Bilim) 1440 ve 2026 dönemlerine özel gerçek motor etkili yeni teknolojiler eklendi.
- [x] **3.5. AoH2 DE / AoH3 Tarzı Toplu Yükseltme & Makro Yönetim Paneli:**
  - [x] Tek tıkla seçilen eyaletlerde özel üretim tesisi (İnek Çiftliği, Pamuk Tarlası, Kereste, Maden), ekonomik/askerî bina yükseltme ve kıyı limanı geliştirme (maliyet ve bütçe önizlemeli).
  - [x] Toplu asimilasyon, toplu istikrar/festival yatırımı ve sınır eyaletlerine toplu garnizon/seferberlik desteği.
  - [x] Mobil Dostu Yarı-Otomatik Cephe Komutanı (seçili ordulara taarruz/savunma duruşu ve toplu cephe sevki).
- [ ] **3.6. Akıllı Kısayollar, Kategorili Gelişmiş Ayarlar ve Görsel/İkon Temizliği:**
  - [ ] Hız kontrolü, başkent odağı, ordu yürütme, harita modları (Ekonomi/Kaynak dahil) ve toplu işlem paneli için tutarlı kısayollar.
  - [ ] *Kategorili Ayarlar:* Grafik & Performans, Harita & Görünüm (sınır kalınlığı, şehir ismi boyutu, savaş sisi, UI ölçeği), Ses (ana/müzik/SFX ayrı sürgüler), Oynanış & AI (zorluk, kriz sıklığı, oto-kayıt, kapitülasyon eşiği).
  - [ ] Anlamsız süs emojileri/ikonları temizlenecek; büyük kart yüzeyleri tutarlı tarihi yağlıboya/gravür diliyle sadeleştirilecek.

### Faz 4 — İnsan Gibi Hissettiren Yapay Zekâ, Derin Diplomasi, İkmal/Mevsim Baskısı ve Ültimatomlar
- [x] **4.1. Yapay Zekâ Kişilik Profilleri, Akıllı Ekonomi/Teknoloji/Seferberlik & Uzun Vadeli Strateji:** Her devlete dinamik stratejik eğilim (Fetihçi, Ticaret İmparatorluğu, Savunmacı, İntikamcı/Rövanşist) atandı; büyük devletler ekonomisine orantılı çok cepheli asker basıyor, yeni **Liman / Kaynak / Gelişim Puanı / Darphane / Ambar** binalarına bilinçli yatırım yapıyor ve kişiliğine uygun teknoloji dalında uzmanlaşıyor.
- [x] **4.2. Canlı Diplomasi (AI-Oyuncu & AI-AI Teklifleri), İşgal Tepkisi, Gerçek Tehdit Hissi ve Sınır Yığınağı:** AI devletler yalnızca sınır komşularıyla değil bölgesel ortak düşmanlara karşı da **Savunma Paktı, Ticaret Anlaşması, Saldırmazlık ve Ambargo** kuruyor; dost/müttefik bir ülke işgal edildiğinde saldırganla ilişkilerini sert şekilde düşürüyor; oyuncuya da canlı diplomatik teklifler gönderiyor; güçlü rakipler savaş öncesi sınıra ordu yığıp uyarı üretiyor.
- [x] **4.3. Ültimatom, Toprak Satın Alma ve Barışçıl Vasal İlhakı:** Zayıf komşulara toprak/vasallık ültimatomu, sınır şehirleri için canlı kabul önizlemeli toprak satın alma teklifi ve sadık vasalların kademeli maliyetli barışçıl ilhakı eklendi.
- [x] **4.4. Mevsim, Arazi ve İkmal Hattı Baskısı + Otomatik Kapitülasyon:** Kış/dağ/çöl yıpranması ve mevsimsel ikmal limiti eklendi; %75+ işgal ve ≥+50 savaş skorunda uzayan savaşları bitiren otomatik kapitülasyon (insan oyuncu korunarak) ve 14 günlük ölü ittifak temizliği devreye alındı.

### Faz 5 — Yenilenen Müzik, Ses Efektleri, Sefer Zaman Çizelgesi (Timelapse) ve Kademeli 1440 Harita Genişlemesi
- [ ] **5.1. Geliştirilmiş Dönem Müziği & Yeni Besteler:** Mevcut çevrimdışı Web Audio müzik motoru çok katmanlı, daha sıcak enstrüman tonlarıyla yenilenecek; barış ve savaş durumuna göre dinamik müzik geçişi eklenecek.
- [ ] **5.2. Yeni Oyun İçi Ses Efektleri (SFX):** Ordu yürüyüşü, kılıç/top çarpışması, kuşatma düşmesi, diplomasi mühür basımı, bina inşası, para/vergi sesi, uyarı borusu ve zarif arayüz tıklama sesleri.
- [ ] **5.3. Sefer Zaman Çizelgesi (Timelapse Replay):** Her oyun yılının hafif sınır kaydı tutulup, seferin 1440'tan bugüne büyüme/çöküş animasyonunu tek tıkla izleme.
- [ ] **5.4. Kademeli 1440 Dünya Genişlemesi (80–120 Tarihi Devlet, 600+ Şehir):** Anadolu beylikleri, Balkan prenslikleri, İtalyan şehir devletleri, Avrupa krallıkları/knezlikleri, Ortadoğu ve Asya devletleri tarihi başkent, bayrak, hükümdar ve sınırlarıyla eklenecek; mobil FPS korunacak.

### Faz 6 — Sona Bırakılan Kapsamlı Doğrulama, iPhone HUD Kontrolü ve Ekran Görüntülü Testler
- [ ] **6.1. Otomatik Testler ve Derleme:** Tüm saf motor kuralları (60 FPS enterpolasyon, şehir gelişim puanı, kaynak değer/yatırım çarpanı, kıyı liman kuralı, savaş skoru & müttefik çağırma, toplu yükseltme, AI kişilik/tehdit/kapitülasyon, kayıt sürüm göçü, 1440 veri bütünlüğü) için genişletilmiş birim testleri + sıfır hatalı `compile` & `lint`.
- [ ] **6.2. iPhone Dikey & Yatay + Masaüstü Görsel Doğrulama (Bol Ekran Görüntülü):**
  - [ ] Yükleme ekranı, yeni **Floda Strateji Oyunu** ana menüsü ve geri bildirim penceresi.
  - [ ] iPhone dikey (`390×844`), iPhone yatay (`844×390`) ve iPhone SE yatay (`667×375`) ekranlarda tüm HUD, canlı savaş rozeti, tek merkezli savaş masası, butonlar, çekmeceler ve dokunma alanları (`≥ 44px`, sıfır üst üste binme).
  - [ ] 60 FPS ordu hareketi, yeni devlet dış sınırları, koyulaşan Ekonomi haritası, ikonlu Kaynak haritası, kıyı liman inşası, genişletilmiş araştırma/inşa, toplu yükseltme paneli, genişletilmiş ayarlar ve kayıt/yükleme döngüsü.
  - [ ] Sıfır tarayıcı konsol hatası ve yüksek performans teyidi.

