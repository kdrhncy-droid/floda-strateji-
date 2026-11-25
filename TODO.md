# AOH3 referansıyla kalite ve sistem işleri

## Tamamlanmış çıktılar

- [x] Dünya haritası 448 → 918 eyalete genişletildi (880–920 hedef bandı; 21 tundra/çöl + 2 Kuzey Ural sancağı sonradan eklendi); eski 448 eyalet kimliği, başkent yuvaları ve kayıt uyumu korunuyor. Ayrıntılar: `GENISLETILMIS_DUNYA_HARITASI.md`.
- [x] 3 kademeli etiket LOD'u: uzakta devlet adları, orta zoom'da başkent + ana şehirler, ≥2.4x (mobil ≥2.8x) ilçe/sancak adları; seçili eyalet her zoom'da görünür.
- [x] 1444 senaryosunda yeni ilçeler dönem adlarıyla (Saruhan, Ruha, Ayıntab, Pskov, Echigo, Flandre) ve tarihî sahiplerle gösteriliyor; 2026 modern adları koruyor.
- [x] Nüfus/GSYİH/ordu payları ülke başına 1.00'a normalleştirildi; ilçeler bina kapasitesi ve manpower tavanını şişirmiyor.
- [x] Dar-yatay drawer 667×375, 800×400 ve 896×414 viewportlarında haritanın çoğunluğunu görünür bırakıyor; açık panelin üstüne sabit müzik widget'ı binmiyor.
- [x] Ambargo yönü uygulayan ülkeyi kaydediyor; yalnız hedefin ticaret geliri etkileniyor, iki tarafın ambargoları bağımsız açılıp kapanıyor ve eski yönsüz kayıt tek deterministik yöne eşleniyor.
- [x] Küçük garnizonda bombardıman asker sayısını artırmıyor; taktik ve kuşatma metinleri gerçek sur/asker etkilerini bildiriyor.
- [x] Ordu sevki, geri çekilme ve araştırma ilerlemesi invariantları regresyon testleriyle doğrulandı.

## Oyun durumu ve askerî tutarlılık

- [x] Araştırma projeleri teknoloji kimliğine göre ilerleme saklıyor. Başka projeye geçmek, projeyi durdurup yeniden başlatmak veya kayıt-yükleme ilerlemeyi silmiyor; yalnız aktif proje günlük araştırma alıyor.
- [x] Taktik bombardıman mevcut düşman kuvvetini hiçbir sayıda artırmıyor. 200 altındaki kuvvet için bombardıman uygulanınca hedef asker sayısı yükselmiyor; bildirilen sonuç gerçek değişime uyuyor.
- [x] Kuşatma bombardımanı bildirilen garnizon kaybını uyguluyor ve düşük garnizonu yapay biçimde 500'e yükseltmiyor. Garnizon toplamı ve birlik bileşimi aynı oransal değişimi koruyor.
- [x] Ordu sevkinde kaynakta korunması gereken garnizon hesaba katılıyor. Gönderilen hareket kuvveti, kaynakta kalan askerlerle başlangıç toplamını aşmıyor ve arayüz gerçek sevk sayısını gösteriyor.
- [x] Manuel geri çekilme sağ kalan askerleri ve birlik bileşimini dost eyalete aktarıyor. Kaynak eyalet artık oyuncunun değilse düşman garnizonu artmıyor; dost hedef bulunmadığında güvenli biçimde reddediliyor.
- [x] Muharebe bombardımanı metni gerçek sur/asker etkisini anlatıyor; kuşatmada etkisiz düğme görünmüyor. Turan emri saldırı yüzdesi vaat etmiyorsa gerçek etkisi olan moral artışını ve üst sınırını doğru anlatıyor.

## Ekonomi ve diplomasi

- [x] Vasal haraç ulusal ekonomi dökümünde ayrı negatif gider olarak gösteriliyor; bütün görünen gelir/gider kalemleri net günlük altınla uzlaşıyor.
- [x] Abluka kaybı, azaltılmış kervan geliri içinde zaten hesaba katıldığı halde ikinci bir bütçe gideri izlenimi vermiyor; açıklama ham pay, kayıp ve net katkıyı anlaşılır biçimde ayırıyor.
- [x] Lojistik liman ve ikmal deposu kartları gerçek motor etkisini doğru birim, yüzde tabanı ve zaman aralığıyla anlatıyor.
- [x] Askerî geçiş izni açıldığında gösterilen ilişki bonusu gerçek artışla aynı. İzni iptal etmek ilişki puanı kazandırmıyor.
- [x] Kısa krallık görünümü, eyalet diplomasisi ve ayrıntılı savaş kartı savaş skorunu oyuncunun saldıran/savunan perspektifinde aynı işaretle gösteriyor.
- [x] Pakt düğmeleri hedef kabulü beklemiyorsa eylemi “öneri/teklif” gibi göstermiyor; aktifleşme mesajı imzalanan/kurulan paktı doğru anlatıyor.
- [x] Teknoloji kartı vaatleri ile ekonomi, işgal, diplomasi, istikrar, savaş ve enflasyon/enerji mekanikleri uyuşuyor. Uygulanmayan etki vaat edilmiyor; yeni mekanik yalnız açık tasarım niyetiyle ekleniyor.

## Harita, HUD ve etkileşim

- [x] Makro harita eylemi seçimi tam eyalet çekmecesini istemsiz açmıyor. Geçersiz/düşman hedefi eylem yapmadan reddediliyor ve yanlış panel göstermiyor.
- [x] `mapLabelDensity` ayarı kullanıcı tarafından COMPACT, BALANCED veya DETAILED olarak seçilebiliyor ve aynı viewport/zoomdaki harita etiketi kararını gerçekten değiştiriyor.
- [x] Global Space kısayolu yalnız etkileşimli olmayan harita/oyun alanında duraklatıyor. Düğme, bağlantı, form alanı veya düzenlenebilir metin odaktayken doğal Space davranışı çalışıyor.
- [x] Harita lejantı tek semantik düğmeyle klavyeden açılıp kapanıyor; erişilebilir adı, kontrol ettiği bölge ve açık/kapalı durumu bildiriliyor.

## Ses, modal, bildirim ve görsel/metin kalitesi

- [x] Sistem menüsü ses ayarı yalnızca efektleri kapatıyorsa doğru adlandırılıyor; kullanıcıya kapattığı ses türü net anlatılıyor ve müzik için ayrı kontrol görünür kalıyor.
- [x] Sistem, kriz ve haber modal/drawer'ları dialog bağlamını, başlığını ve kapatma düğmesinin Türkçe erişilebilir adını bildiriyor; klavyeyle açma, içeride gezinme, kapatma ve açan kontrole geri dönme davranışı tutarlı.
- [x] Toast mesajları 320–390 px ekranlarda tek satır ellipsis ile anlam kaybetmiyor; uzun metin satıra sarılıyor, kapsayıcı ekrandan taşmıyor ve önemli sonuç görünür kalıyor.
- [x] Toast bildirimleri ekran okuyucu tarafından uygun durum/önem düzeyinde duyuruluyor; uzun mesajlar okunabilir olmadan kaybolmuyor.
- [x] HUD, ekonomi, diplomasi, teknoloji, sistem ve kriz/haber panellerinde kritik Türkçe metin, sayı ve kontrol etiketleri 320×720, 390×844, 844×390 ve 1366×768 görünümlerinde kırpılmıyor, örtüşmüyor veya yatay taşma oluşturmuyor.
- [x] Uzun ülke/eyalet adları, uzun toast'lar ve çok seçenekli kriz içeriği dar ekranlarda okunabilir; tüm gerekli kontroller kaydırmayla erişilebilir.

## Kapsam kanıtı ve depo temizliği

- [x] AOH3 videosunda gözlendiği raporlanan eyalet bazlı mali döküm, başkent bonusu, ordu yığınlarını ayırma/birleştirme ve diğer olası parity özellikleri resmî metin veya doğrudan oyun kanıtıyla doğrulanmadan kesin AOH3 özelliği sayılmıyor; doğrulananlar ayrı ürün çıktısı olarak kapsama alınıyor. Kanıtlar `AOH3_VIDEO_GAP_AUDIT.md` ile `references/aoh3/` altında korunuyor.
- [x] `npm test` depodaki tüm test dosyalarını çalıştırıyor ve herhangi bir başarısızlıkta non-zero çıkıyor.
- [x] `package.json` temizleme komutu depoda bulunmayan `server.js` yolunu içermiyor. Kaynak ve `public/` taramasında yüksek güvenle kullanılmayan dosya bulunmadı; referans, save-compatibility veya dinamik yüklenen dosyalar silinmiyor.
- [x] Kaynak/build yapılandırmasında kullanılmayan `@google/genai`, `dotenv`, `express`, `@types/express`, `motion` ve `autoprefixer` bağımlılıkları kaldırıldı; taramada referans kalmadı ve `bun.lock` eşitlendi.
- [x] AoH3 referans ekran görüntülerindeki HUD dili uygulandı: pirinç kaynak hücreleri, bayrak kalkanı + ★ şeridi, tarih plakası ve −/+ zoom, seçim bayrak çipleri, bordo-altın ordu paneli, AoH3 eyalet kartı çerçevesi ve yeni **dünya mini haritası** (görüntü alanı dikdörtgeni + tıkla-odakla). Ayrıntı: `AOH3_HUD_UYGULAMASI.md`.
- [x] Harita sınırları AoH3 diline çekildi: sınıflandırıcı her halkayı tek bağlı polyline olarak üretiyor (kopukluk yok), komşu iki il aynı paylaşılan kenarı iki taraftan da çiziyor, birleşim noktaları `round`; kıyı çizgisi mürekkep halesi + keskin kenar, kara sınırı üç geçişli gravür (hale + çekirdek + iç ışık), oyuncu sınırı altın vurgu. Keşfedilmiş kara opak, sadece sis yarı saydam; her dolgu kendi rengiyle 1 px dikiş kapatma yapıyor. Sınır yolları sahiplik imzasıyla önbellekleniyor, simülasyon tick'lerinde yeniden hesaplanmıyor. Ayrıntı/ölçüm: `src/map/borderClassifier.ts`.
- [x] 1444 senaryosunda Büyük Orda ve Sibir toprakları Rusya'nın içinde ada gibi durmuyor: bozkır ve Sibirya provinces'leri açıkça 902/903'e devredildi, Kursk Litvanya'ya, Inverness İskoçya'ya, Batı ABD klanlara geçti; üç realm için bitişiklik testi eklendi. Ayrıntı: `GENISLETILMIS_DUNYA_HARITASI.md` §6.1.

## Kapsam dışı bırakılmış varsayımlar

- Seçilen tek AOH3 videosunda gözlenmemiş olması, özelliğin AOH3'te bulunmadığının kanıtı değildir. Kaynak kodunda ayrı eyalet finans listesi, başkent bonusu veya army split/merge yolu bulunması bu özelliklerin AOH3'te kesin var olduğunu tek başına göstermez. Bu maddeler ancak metinsel/oyun içi kanıtla doğrulanınca uygulama gereksinimine dönüşür.
- Bağımlılık kaldırma kararı, doğrudan kaynak ve proje script referanslarının aranmasıyla sınırlandırıldı; başka çalışma ortamlarındaki harici araç/CI kullanımına ilişkin varsayım yapılmadı.
- Bilinen veri kısıtı (sınır çizimi değil): Sibirya ve Kanada'da il sayısı çok az olduğu için Voronoi hücreleri kutuplara doğru ince kamalar oluşturuyor (ör. Tomsk–Yenisey arasında 27° enlem boyu düz kenar). Kısmen giderildi: Sibirya, Kuzey Kanada, Alaska, Amazon ve Avustralya içine 21 yeni sancak eklendi (895 → 916), en uzun düz kenar 28,7° → 25,9° indi. Tam AoH3 görünümü için bu bölgelerde daha yoğun bir sancak ızgarası (yaklaşık iki katı) gerekir.
