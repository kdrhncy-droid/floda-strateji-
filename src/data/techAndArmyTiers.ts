import {
  Nation,
  ReformDefinition,
  TechDefinition,
  Territory,
} from "../types/game";

export const TECH_TREE: TechDefinition[] = [
  // MILITARY MAIN (2026 Modern Era)
  {
    id: 'mil_1',
    name: 'Müşterek Ağ Merkezli Harp',
    shortTitle: 'Ağ Merkezli Harp',
    branch: 'MILITARY',
    tier: 1,
    subRow: 0,
    artKey: 'INFANTRY',
    cost: 120,
    description: 'Uydu destekli komuta zinciri muharebe gücünü artırır ve Nesil II Ordu Modernizasyonunu açar.',
    effectLabel: '+%12 Muharebe Gücü · Nesil II Ordu Açılır',
  },
  {
    id: 'mil_2',
    name: 'SİHA & Otonom Sürü Doktrini',
    shortTitle: 'SİHA Sürü Doktrini',
    branch: 'MILITARY',
    tier: 2,
    subRow: 0,
    artKey: 'ARTILLERY',
    cost: 260,
    prerequisite: 'mil_1',
    description: 'SİHA ve otonom birlik doktrini muharebe gücünü artırır ve Nesil III Ordu Modernizasyonunu açar.',
    effectLabel: '+%18 Muharebe Gücü · Nesil III Ordu Açılır',
  },
  {
    id: 'mil_3',
    name: 'Hipersonik Caydırıcılık',
    shortTitle: 'Hipersonik Füze',
    branch: 'MILITARY',
    tier: 3,
    subRow: 0,
    artKey: 'ARTILLERY',
    cost: 480,
    prerequisite: 'mil_2',
    description: 'Hipersonik caydırıcılık muharebe gücünü artırır ve Nesil IV Ordu Modernizasyonunu açar.',
    effectLabel: '+%25 Muharebe Gücü · Nesil IV Ordu Açılır',
  },
  {
    id: 'mil_4',
    name: 'Entegre Gök Kubbe Savunması',
    shortTitle: 'Gök Kubbe Savunma',
    branch: 'MILITARY',
    tier: 4,
    subRow: 0,
    artKey: 'FORTRESS',
    cost: 750,
    prerequisite: 'mil_3',
    description: 'Ülke sınırları içindeki tüm bölgelerde savunma direncini maksimuma çıkarır ve Nesil V Zirve Ordusunu açar.',
    effectLabel: '+%30 Ulusal Savunma · Nesil V Ordu Açılır',
  },
  {
    id: 'mil_5',
    name: 'Tam Spektrum Muharebe Doktrini',
    shortTitle: 'Tam Spektrum Harp',
    branch: 'MILITARY',
    tier: 5,
    subRow: 0,
    artKey: 'INFANTRY',
    cost: 1080,
    prerequisite: 'mil_4',
    description: 'Müşterek lojistik optimizasyonu ve tam spektrum ateş üstünlüğüyle muharebe gücünü artırır, ordu bakımını düşürür.',
    effectLabel: '+%20 Muharebe Gücü · -%12 Ordu Bakım Gideri',
  },

  // MILITARY SPECIALIST (Donanma, Tahkimat & Lojistik)
  {
    id: 'mil_1b',
    name: 'Kıyı Hücumbot & Deniz İHA Filosu',
    shortTitle: 'Kıyı Donanması',
    branch: 'MILITARY',
    tier: 1,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 115,
    description: 'İnsansız deniz araçları ve hızlı hücumbotlarla deniz muharebelerinde ateş üstünlüğü kurar.',
    effectLabel: '+%15 Deniz Muharebe Gücü',
  },
  {
    id: 'mil_2b',
    name: 'Yeraltı Korunak & Hava Savunma Ağı',
    shortTitle: 'Savunma Korunağı',
    branch: 'MILITARY',
    tier: 2,
    subRow: 1,
    artKey: 'FORTRESS',
    cost: 245,
    prerequisite: 'mil_1b',
    description: 'Katmanlı tahkimat ve sığınak ağlarıyla düşman taarruzlarına karşı tüm eyaletlerin savunmasını güçlendirir.',
    effectLabel: '+%15 Ulusal Savunma Gücü',
  },
  {
    id: 'mil_3b',
    name: 'Uçak Gemisi & Mavi Vatan Görev Grubu',
    shortTitle: 'Açık Deniz Filosu',
    branch: 'MILITARY',
    tier: 3,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 460,
    prerequisite: 'mil_2b',
    description: 'Açık deniz görev gruplarıyla donanma vurucu gücünü ve deniz ticaret koridorlarından alınan payı büyütür.',
    effectLabel: '+%20 Deniz Gücü · +%12 Deniz Ticareti',
  },
  {
    id: 'mil_4b',
    name: 'Stratejik Hava Köprüsü & Lojistik',
    shortTitle: 'Ordu Lojistiği',
    branch: 'MILITARY',
    tier: 4,
    subRow: 1,
    artKey: 'INFANTRY',
    cost: 720,
    prerequisite: 'mil_3b',
    description: 'Kesintisiz cephe ikmal ağıyla eyalet ikmal tavanını yükseltir ve yeni birlik toplama maliyetini düşürür.',
    effectLabel: '+%25 İkmal Limiti · -%10 Asker Maliyeti',
  },
  {
    id: 'mil_5b',
    name: 'Stratejik Füze & Elektronik Harp',
    shortTitle: 'Elektronik Harp',
    branch: 'MILITARY',
    tier: 5,
    subRow: 1,
    artKey: 'ARTILLERY',
    cost: 1040,
    prerequisite: 'mil_4b',
    description: 'Düşman komuta ağlarını felç ederek taarruz gücünü sıçratır ve silahlı kuvvetlerin günlük bakım yükünü hafifletir.',
    effectLabel: '+%20 Taarruz Gücü · -%10 Ordu Bakımı',
  },

  // ECONOMY MAIN (2026 Modern Era)
  {
    id: 'eco_1',
    name: 'Dijital Vergi ve Merkez Bankası',
    shortTitle: 'Dijital Vergi',
    branch: 'ECONOMY',
    tier: 1,
    subRow: 0,
    artKey: 'TREASURY',
    cost: 110,
    description: 'Dijital tahsilat vergi gelirini artırır; enflasyon mevcut vergi ve ekonomi kurallarıyla hesaplanır.',
    effectLabel: '+%15 Vergi Geliri',
  },
  {
    id: 'eco_2',
    name: 'Endüstri 5.0 Robotik Fabrikalar',
    shortTitle: 'Endüstri 5.0',
    branch: 'ECONOMY',
    tier: 2,
    subRow: 0,
    artKey: 'ENGINEERING',
    cost: 240,
    prerequisite: 'eco_1',
    description: 'Sanayi komplekslerinin üretim kapasitesini katlar.',
    effectLabel: '+%25 Üretim Geliri',
  },
  {
    id: 'eco_3',
    name: 'Küresel Enerji ve Koridor Tekeli',
    shortTitle: 'Enerji Koridoru',
    branch: 'ECONOMY',
    tier: 3,
    subRow: 0,
    artKey: 'TRADE',
    cost: 440,
    prerequisite: 'eco_2',
    description: 'Ulusal iç pazar ticaret gelirini artırır.',
    effectLabel: '+%30 İç Pazar Ticareti',
  },
  {
    id: 'eco_4',
    name: 'Dijital Tahsilat ve Vergi Denetim Ağı',
    shortTitle: 'Vergi Denetim Ağı',
    branch: 'ECONOMY',
    tier: 4,
    subRow: 0,
    artKey: 'TREASURY',
    cost: 700,
    prerequisite: 'eco_3',
    description: 'Merkezî tahsilat ve vergi denetimiyle vergi gelirini artırır.',
    effectLabel: '+%20 Vergi Geliri',
  },
  {
    id: 'eco_5',
    name: 'Okyanus Limanları & Küresel Koridor Ağı',
    shortTitle: 'Okyanus Limanları',
    branch: 'ECONOMY',
    tier: 5,
    subRow: 0,
    artKey: 'TRADE',
    cost: 1020,
    prerequisite: 'eco_4',
    description: 'Kıyı limanları, enerji boğazları ve küresel lojistik hatlarından gelen ticaret gelirini ve şehir yatırım verimini artırır.',
    effectLabel: '+%25 Boğaz & Deniz Ticareti · +%0,20 Yatırım',
  },

  // ECONOMY SPECIALIST (Tarım, Maden & Finans)
  {
    id: 'eco_1b',
    name: 'Akıllı Tarım & Gıda Güvenliği',
    shortTitle: 'Akıllı Tarım',
    branch: 'ECONOMY',
    tier: 1,
    subRow: 1,
    artKey: 'AGRICULTURE',
    cost: 105,
    description: 'Yüksek verimli modern tarım sistemleriyle eyalet nüfus artışını ve insan gücü yenilenmesini hızlandırır.',
    effectLabel: '+%25 Nüfus Artışı · +%10 İnsan Gücü',
  },
  {
    id: 'eco_2b',
    name: 'Nadir Toprak & Stratejik Madencilik',
    shortTitle: 'Stratejik Maden',
    branch: 'ECONOMY',
    tier: 2,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 230,
    prerequisite: 'eco_1b',
    description: 'Yerli hammadde zincirini güçlendirerek ulusal üretimi artırır ve tüm bina inşa maliyetlerini ucuzlatır.',
    effectLabel: '+%15 Üretim · -%12 İnşa Maliyeti',
  },
  {
    id: 'eco_3b',
    name: 'Egemen Varlık Fonu & Fintech',
    shortTitle: 'Varlık Fonu',
    branch: 'ECONOMY',
    tier: 3,
    subRow: 1,
    artKey: 'TREASURY',
    cost: 430,
    prerequisite: 'eco_2b',
    description: 'Finansal istikrar mekanizmalarıyla günlük enflasyon baskısını azaltır ve vergi tabanını genişletir.',
    effectLabel: '−0,02 Günlük Enflasyon · +%12 Vergi',
  },
  {
    id: 'eco_4b',
    name: 'Hızlı Tren & Kıtalararası Lojistik',
    shortTitle: 'Kıta Lojistiği',
    branch: 'ECONOMY',
    tier: 4,
    subRow: 1,
    artKey: 'TRADE',
    cost: 680,
    prerequisite: 'eco_3b',
    description: 'Yüksek hızlı demiryolu ve otoyol koridorlarıyla hem iç ticareti hem de eyalet ikmal kapasitesini büyütür.',
    effectLabel: '+%18 Ticaret · +%15 İkmal Limiti',
  },
  {
    id: 'eco_5b',
    name: 'Küresel Rezerv Para & Finans Merkezi',
    shortTitle: 'Rezerv Para',
    branch: 'ECONOMY',
    tier: 5,
    subRow: 1,
    artKey: 'TREASURY',
    cost: 990,
    prerequisite: 'eco_4b',
    description: 'Ulusal para birimini küresel rezerv standardına taşıyarak vergi gelirini katlar ve enflasyonu dizginler.',
    effectLabel: '+%25 Vergi Geliri · −0,025 Enflasyon',
  },

  // ADMINISTRATION MAIN (2026 Modern Era)
  {
    id: 'adm_1',
    name: 'Bölgesel İdari Entegrasyon',
    shortTitle: 'İdari Entegrasyon',
    branch: 'ADMINISTRATION',
    tier: 1,
    subRow: 0,
    artKey: 'COURT',
    cost: 100,
    description: 'Çekirdek dışı eyaletlerdeki pozitif haftalık huzursuzluk artışını azaltır.',
    effectLabel: '-%30 Çekirdek Dışı Huzursuzluk Artışı',
  },
  {
    id: 'adm_2',
    name: 'Stratejik Diplomasi Teşkilatı',
    shortTitle: 'Diplomasi Teşkilatı',
    branch: 'ADMINISTRATION',
    tier: 2,
    subRow: 0,
    artKey: 'COURT',
    cost: 220,
    prerequisite: 'adm_1',
    description: 'Savaş sonrası ve kabine kararlarıyla kazanılan agresif genişlemeyi azaltır.',
    effectLabel: '-%25 Agresif Genişleme Kazanımı',
  },
  {
    id: 'adm_3',
    name: 'Ulusal Seferberlik Yasası',
    shortTitle: 'Seferberlik Yasası',
    branch: 'ADMINISTRATION',
    tier: 3,
    subRow: 0,
    artKey: 'INFANTRY',
    cost: 420,
    prerequisite: 'adm_2',
    description: 'Ülke genelindeki insan gücü (Manpower) havuz tavanını ve yenilenme hızını büyütür.',
    effectLabel: '+%35 İnsan Gücü · +%25 Havuz Tavanı',
  },
  {
    id: 'adm_4',
    name: 'İmparatorluk Federasyon Anayasası',
    shortTitle: 'Federasyon Anayasası',
    branch: 'ADMINISTRATION',
    tier: 4,
    subRow: 0,
    artKey: 'COURT',
    cost: 680,
    prerequisite: 'adm_3',
    description: 'Çok uluslu imparatorluklarda tam istikrar, ikmal ve vasal gelir artışı sağlar.',
    effectLabel: '+%50 Vasal Haraç Geliri · +%20 İkmal',
  },
  {
    id: 'adm_5',
    name: 'İmparatorluk Entegrasyon & İdari Birlik',
    shortTitle: 'İdari Birlik',
    branch: 'ADMINISTRATION',
    tier: 5,
    subRow: 0,
    artKey: 'COURT',
    cost: 980,
    prerequisite: 'adm_4',
    description: 'Yeni eyaletlerin Öz Vatan (Core) entegrasyonunu hızlandırır ve tüm şehirlerde günlük yerel huzursuzluğu düşürür.',
    effectLabel: '+%40 Asimilasyon Hızı · −0,35 Huzursuzluk',
  },

  // ADMINISTRATION SPECIALIST (Hukuk, Elçilik & İmar)
  {
    id: 'adm_1b',
    name: 'E-Devlet & Dijital Kamu Yönetimi',
    shortTitle: 'Dijital Kamu',
    branch: 'ADMINISTRATION',
    tier: 1,
    subRow: 1,
    artKey: 'COURT',
    cost: 105,
    description: 'Bürokrasiyi sadeleştirerek eyaletlerdeki günlük huzursuzluğu azaltır ve kamu inşaat maliyetlerini düşürür.',
    effectLabel: '−0,20 Günlük Huzursuzluk · -%10 İnşa Maliyeti',
  },
  {
    id: 'adm_2b',
    name: 'Çok Taraflı Diplomasi & Yumuşak Güç',
    shortTitle: 'Yumuşak Güç',
    branch: 'ADMINISTRATION',
    tier: 2,
    subRow: 1,
    artKey: 'COURT',
    cost: 225,
    prerequisite: 'adm_1b',
    description: 'Küresel elçilik ağıyla günlük diplomasi puanı kazanımını artırır ve uluslararası tepkiyi yumuşatır.',
    effectLabel: '+1 Günlük Diplomasi Puanı · -%10 AE',
  },
  {
    id: 'adm_3b',
    name: 'Kentsel Dönüşüm & Akıllı Altyapı',
    shortTitle: 'Akıllı Altyapı',
    branch: 'ADMINISTRATION',
    tier: 3,
    subRow: 1,
    artKey: 'AGRICULTURE',
    cost: 410,
    prerequisite: 'adm_2b',
    description: 'Modern şehircilik standartlarıyla tüm bina inşa sürelerini kısaltır ve şehir yatırım çarpanını yükseltir.',
    effectLabel: '-%20 İnşa Süresi · +%12 Şehir Yatırımı',
  },
  {
    id: 'adm_4b',
    name: 'Ulusal Güvenlik & Kriz Merkezi',
    shortTitle: 'Kriz Merkezi',
    branch: 'ADMINISTRATION',
    tier: 4,
    subRow: 1,
    artKey: 'FORTRESS',
    cost: 660,
    prerequisite: 'adm_3b',
    description: 'Seferberlik koordinasyonuyla insan gücü havuz tavanını genişletir ve yeni toprakların entegrasyonunu hızlandırır.',
    effectLabel: '+%20 İnsan Gücü Tavanı · +%20 Asimilasyon',
  },
  {
    id: 'adm_5b',
    name: 'Küresel Liderlik & Federatif Birlik',
    shortTitle: 'Federatif Birlik',
    branch: 'ADMINISTRATION',
    tier: 5,
    subRow: 1,
    artKey: 'COURT',
    cost: 960,
    prerequisite: 'adm_4b',
    description: 'Tâbi devletlerden alınan haraç gelirini artırır ve tüm eyaletlerde kalıcı toplumsal sükûnet kurar.',
    effectLabel: '+%30 Vasal Haracı · −0,25 Huzursuzluk',
  },

  // SCIENCE MAIN (2026 Modern Era)
  {
    id: 'sci_1',
    name: 'Ulusal Süperbilgisayar Ağı',
    shortTitle: 'Süperbilgisayar',
    branch: 'SCIENCE',
    tier: 1,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 130,
    description: 'Üniversite ve araştırma merkezlerinin bilimsel çıktısını artırır.',
    effectLabel: '+%20 Araştırma Hızı',
  },
  {
    id: 'sci_2',
    name: 'Yarı İletken Çip Bağımsızlığı',
    shortTitle: 'Çip Bağımsızlığı',
    branch: 'SCIENCE',
    tier: 2,
    subRow: 0,
    artKey: 'ENGINEERING',
    cost: 280,
    prerequisite: 'sci_1',
    description: 'Üretim gelirini artırır ve yabancı ticaret ambargolarının ekonomi üzerindeki etkisini azaltır.',
    effectLabel: 'Ambargo Etkisi -%50 · +%15 Üretim',
  },
  {
    id: 'sci_3',
    name: 'Kuantum Şifreleme & Harita İstihbaratı',
    shortTitle: 'Kuantum İstihbarat',
    branch: 'SCIENCE',
    tier: 3,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 500,
    prerequisite: 'sci_2',
    description: 'Araştırma hızını artırır ve haritadaki tüm bölgeleri görünür kılar.',
    effectLabel: '+%25 Araştırma · Tüm Harita Görünür',
  },
  {
    id: 'sci_4',
    name: 'Üretim Mühendisliği ve Otomasyon',
    shortTitle: 'Üretim Otomasyonu',
    branch: 'SCIENCE',
    tier: 4,
    subRow: 0,
    artKey: 'ENGINEERING',
    cost: 820,
    prerequisite: 'sci_3',
    description: 'Mühendislik ve otomasyon yatırımları ulusal üretim gelirini artırır.',
    effectLabel: '+%35 Üretim Geliri',
  },
  {
    id: 'sci_5',
    name: 'İleri Kuantum & Endüstriyel Ar-Ge Çağı',
    shortTitle: 'Kuantum Ar-Ge',
    branch: 'SCIENCE',
    tier: 5,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 1120,
    prerequisite: 'sci_4',
    description: 'İleri mühendislik üsleriyle bilimsel araştırmayı, ulusal üretimi ve şehir yatırım çarpanını zirveye taşır.',
    effectLabel: '+%30 Araştırma · +%20 Üretim · +%0,20 Yatırım',
  },

  // SCIENCE SPECIALIST (Tıp, Veri & Enerji)
  {
    id: 'sci_1b',
    name: 'Biyoteknoloji & Modern Sağlık',
    shortTitle: 'Modern Sağlık',
    branch: 'SCIENCE',
    tier: 1,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 120,
    description: 'İleri sağlık hizmetleriyle ülke genelinde nüfus büyümesini ve insan gücü yenilenmesini belirgin biçimde artırır.',
    effectLabel: '+%30 Nüfus Artışı · +%15 İnsan Gücü',
  },
  {
    id: 'sci_2b',
    name: 'Yapay Zekâ & Büyük Veri Merkezleri',
    shortTitle: 'Büyük Veri Ağı',
    branch: 'SCIENCE',
    tier: 2,
    subRow: 1,
    artKey: 'OBSERVATORY',
    cost: 265,
    prerequisite: 'sci_1b',
    description: 'Ulusal veri merkezleri ve araştırma otomasyonu sayesinde günlük bilim üretimini hızlandırır.',
    effectLabel: '+%18 Araştırma Hızı',
  },
  {
    id: 'sci_3b',
    name: 'Alçak Yörünge Uydu Takımyıldızı',
    shortTitle: 'Uydu Takımyıldızı',
    branch: 'SCIENCE',
    tier: 3,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 490,
    prerequisite: 'sci_2b',
    description: 'Küresel seyrüsefer ve deniz gözetleme ağıyla donanma gücünü ve boğaz ticaret gelirlerini yükseltir.',
    effectLabel: '+%15 Deniz Gücü · +%15 Boğaz Ticareti',
  },
  {
    id: 'sci_4b',
    name: 'Füzyon & Temiz Enerji Şebekesi',
    shortTitle: 'Temiz Enerji',
    branch: 'SCIENCE',
    tier: 4,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 790,
    prerequisite: 'sci_3b',
    description: 'Ucuz ve sınırsız enerji arzıyla ulusal üretimi büyütür, tüm eyalet inşa maliyetlerini düşürür.',
    effectLabel: '+%20 Üretim · -%15 İnşa Maliyeti',
  },
  {
    id: 'sci_5b',
    name: 'Teknolojik Tekillik & Uzay Çağı',
    shortTitle: 'Uzay Çağı',
    branch: 'SCIENCE',
    tier: 5,
    subRow: 1,
    artKey: 'OBSERVATORY',
    cost: 1150,
    prerequisite: 'sci_4b',
    description: 'İnsanlığın bilimsel sınırlarını aşarak araştırma hızında ve askeri doktrinde rakipsiz üstünlük kurar.',
    effectLabel: '+%35 Araştırma Hızı · +%15 Muharebe Gücü',
  },
  // TIER 6 (Çağ VI - Modern Zirve Doktrinleri)
  {
    id: 'mil_6',
    name: 'Yörünge Komuta & Kuantum Harp Kalkanı',
    shortTitle: 'Yörünge Kalkanı',
    branch: 'MILITARY',
    tier: 6,
    subRow: 0,
    artKey: 'ARTILLERY',
    cost: 1450,
    prerequisite: 'mil_5',
    description: 'Alçak yörünge sensör ağları ve hipersonik önleme kalkanıyla orduların taarruz ve savunma kudretini zirveye taşır.',
    effectLabel: '+%25 Muharebe Gücü · +%15 Ulusal Savunma',
  },
  {
    id: 'mil_6b',
    name: 'Nükleer Tahrikli Okyanus Donanması',
    shortTitle: 'Okyanus Armadası',
    branch: 'MILITARY',
    tier: 6,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 1400,
    prerequisite: 'mil_5b',
    description: 'Sınırsız menzilli görev kuvvetleriyle tüm açık denizlerde mutlak hakimiyet ve lojistik üstünlük sağlar.',
    effectLabel: '+%25 Deniz Gücü · +%20 İkmal Limiti',
  },
  {
    id: 'eco_6',
    name: 'Otonom Mega Üretim & Küresel Borsa Ağı',
    shortTitle: 'Mega Üretim Ağı',
    branch: 'ECONOMY',
    tier: 6,
    subRow: 0,
    artKey: 'ENGINEERING',
    cost: 1380,
    prerequisite: 'eco_5',
    description: 'Tam otonom sanayi havzaları ve küresel finans entegrasyonuyla üretim ve vergi gelirlerini katlar.',
    effectLabel: '+%25 Üretim Geliri · +%20 Vergi Geliri',
  },
  {
    id: 'eco_6b',
    name: 'Kıtalararası Serbest Ticaret & Varlık Merkezi',
    shortTitle: 'Küresel Hazine',
    branch: 'ECONOMY',
    tier: 6,
    subRow: 1,
    artKey: 'TREASURY',
    cost: 1350,
    prerequisite: 'eco_5b',
    description: 'Uluslararası ticaret koridorlarını ve merkez bankası rezervlerini güçlendirerek ticareti büyütür, enflasyonu bastırır.',
    effectLabel: '+%25 Ticaret Geliri · −0,025 Günlük Enflasyon',
  },
  {
    id: 'adm_6',
    name: 'Kusursuz Dijital Devlet & Hukuk Reformu',
    shortTitle: 'Dijital Devlet',
    branch: 'ADMINISTRATION',
    tier: 6,
    subRow: 0,
    artKey: 'COURT',
    cost: 1340,
    prerequisite: 'adm_5',
    description: 'Başkentten en uzak eyalete kadar şeffaf ve hızlı yönetim kurarak istikrarı, asimilasyonu ve insan gücünü artırır.',
    effectLabel: '+%30 Asimilasyon · −0,20 Huzursuzluk · +%20 İnsan Gücü',
  },
  {
    id: 'adm_6b',
    name: 'Stratejik İttifak & Küresel Prestij Doktrini',
    shortTitle: 'Küresel Prestij',
    branch: 'ADMINISTRATION',
    tier: 6,
    subRow: 1,
    artKey: 'COURT',
    cost: 1310,
    prerequisite: 'adm_5b',
    description: 'Uluslararası meşruiyeti ve başkent prestijini yükselterek agresif genişlemeyi düşürür, vasal gelirlerini artırır.',
    effectLabel: '−%15 Agresif Genişleme · +%35 Vasal Geliri',
  },
  {
    id: 'sci_6',
    name: 'Ulusal Araştırma Üniversiteleri & Bilim Kentleri',
    shortTitle: 'Bilim Kentleri',
    branch: 'SCIENCE',
    tier: 6,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 1480,
    prerequisite: 'sci_5',
    description: 'Üniversite ve araştırma enstitülerinin bilimsel çıktısını katlayarak maksimum teknoloji tavanını yükseltir.',
    effectLabel: '+%35 Araştırma Hızı · +3,0 Maks Teknoloji Tavanı',
  },
  {
    id: 'sci_6b',
    name: 'Yüksek Teknoloji Medeniyeti & Uzay Endüstrisi',
    shortTitle: 'Uzay Endüstrisi',
    branch: 'SCIENCE',
    tier: 6,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 1440,
    prerequisite: 'sci_5b',
    description: 'Bilim, sanayi ve savunma ekosistemini tek çatı altında birleştirerek üretime ve araştırmaya kalıcı ivme kazandırır.',
    effectLabel: '+%25 Araştırma · +%20 Üretim · -%10 İnşa Maliyeti',
  },
];

export const TECH_TREE_1440: TechDefinition[] = [
  // MILITARY MAIN (1440 Historical Era)
  {
    id: 'mil_1',
    name: 'Kapıkulu & Daimi Ocak Nizâmı',
    shortTitle: 'Kapıkulu Ocağı',
    branch: 'MILITARY',
    tier: 1,
    subRow: 0,
    artKey: 'INFANTRY',
    cost: 160,
    description:
      'Merkezi hazineden maaşlı daimi piyade ocakları ve eyalet sipahi alayları kurar; muharebe gücünü artırır ve Nesil II modernizasyonunu açar.',
    effectLabel: '+%12 Muharebe Gücü · Nesil II (Yeniçeri) Açılır',
  },
  {
    id: 'mil_2',
    name: 'Barutlu Arkebüz & Tabur Cengi',
    shortTitle: 'Barutlu Tabur',
    branch: 'MILITARY',
    tier: 2,
    subRow: 0,
    artKey: 'ARTILLERY',
    cost: 320,
    prerequisite: 'mil_1',
    description:
      'Fitilli tüfekli saflar ve tabur düzeni muharebe gücünü artırır; Nesil III Orduyu açar.',
    effectLabel: '+%18 Muharebe Gücü · Nesil III Ordu Açılır',
  },
  {
    id: 'mil_3',
    name: 'Şahi Darbzen & Ağır Kuşatma Dökümhanesi',
    shortTitle: 'Şahi Topçusu',
    branch: 'MILITARY',
    tier: 3,
    subRow: 0,
    artKey: 'ARTILLERY',
    cost: 540,
    prerequisite: 'mil_2',
    description:
      'Şahi topçusu ve kuşatma doktrini muharebe gücünü artırır; Nesil IV Orduyu açar.',
    effectLabel: '+%25 Muharebe Gücü · Nesil IV Ordu Açılır',
  },
  {
    id: 'mil_4',
    name: 'Nizâm-ı Cedîd & Süngülü Tümen Reformu',
    shortTitle: 'Nizâm-ı Cedîd',
    branch: 'MILITARY',
    tier: 4,
    subRow: 0,
    artKey: 'FORTRESS',
    cost: 840,
    prerequisite: 'mil_3',
    description:
      'Modern talimli nizamiye alayları ve seri ateşli sahra bataryalarıyla imparatorluk sınırlarını korur; Nesil V Zirve Orduyu açar.',
    effectLabel: '+%30 Ulusal Savunma · Nesil V Ordu Açılır',
  },
  {
    id: 'mil_5',
    name: 'Cihanşümul Sefer & Menzil Nizâmı',
    shortTitle: 'Menzil Nizâmı',
    branch: 'MILITARY',
    tier: 5,
    subRow: 0,
    artKey: 'INFANTRY',
    cost: 1180,
    prerequisite: 'mil_4',
    description:
      'Menzilhâne ikmal ağı ve daimi sefer disipliniyle orduların vuruş gücünü artırır, günlük ulufe ve bakım yükünü azaltır.',
    effectLabel: '+%20 Muharebe Gücü · -%12 Ordu Bakım Gideri',
  },

  // MILITARY SPECIALIST (1440: Donanma, Hisar & Sefer Lojistiği)
  {
    id: 'mil_1b',
    name: 'Kadırga Tersanesi & Kıyı Donanması',
    shortTitle: 'Kadırga Filosu',
    branch: 'MILITARY',
    tier: 1,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 150,
    description:
      'Kürekli kadırga ve baştarda tersaneleriyle Akdeniz ve Karadeniz sularında deniz muharebe üstünlüğü sağlar.',
    effectLabel: '+%15 Deniz Muharebe Gücü',
  },
  {
    id: 'mil_2b',
    name: 'Hisar Tahkimatı & Burç Mühendisliği',
    shortTitle: 'Hisar & Burç',
    branch: 'MILITARY',
    tier: 2,
    subRow: 1,
    artKey: 'FORTRESS',
    cost: 300,
    prerequisite: 'mil_1b',
    description:
      'Çift surlu taş hisarlar ve topçu burçlarıyla sınır kalelerinin düşman taarruzlarına direncini güçlendirir.',
    effectLabel: '+%15 Ulusal Savunma Gücü',
  },
  {
    id: 'mil_3b',
    name: 'Kalyon Filosu & Açık Deniz Hâkimiyeti',
    shortTitle: 'Büyük Kalyonlar',
    branch: 'MILITARY',
    tier: 3,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 520,
    prerequisite: 'mil_2b',
    description:
      'Ağır toplu yelkenli kalyonlarla açık denizlerde mutlak üstünlük kurar, deniz ticaret gelirlerini büyütür.',
    effectLabel: '+%20 Deniz Gücü · +%12 Deniz Ticareti',
  },
  {
    id: 'mil_4b',
    name: 'Sefer İkmal Kolordusu & Ordugâh Ağı',
    shortTitle: 'Sefer İkmali',
    branch: 'MILITARY',
    tier: 4,
    subRow: 1,
    artKey: 'INFANTRY',
    cost: 800,
    prerequisite: 'mil_3b',
    description:
      'Düzenli erzak arabaları ve zahire ambarlarıyla eyalet ikmal tavanını yükseltir, yeni asker toplama giderini azaltır.',
    effectLabel: '+%25 İkmal Limiti · -%10 Asker Maliyeti',
  },
  {
    id: 'mil_5b',
    name: 'Kuşatma & Humbaracı Akademisi',
    shortTitle: 'Humbaracı Ocağı',
    branch: 'MILITARY',
    tier: 5,
    subRow: 1,
    artKey: 'ARTILLERY',
    cost: 1120,
    prerequisite: 'mil_4b',
    description:
      'Balistik hesaplı havan ve humbara bataryalarıyla taarruz gücünü sıçratır, ordu bakım masraflarını düşürür.',
    effectLabel: '+%20 Taarruz Gücü · -%10 Ordu Bakımı',
  },

  // ECONOMY MAIN (1440 Historical Era)
  {
    id: 'eco_1',
    name: 'Tahrir Defteri & Gümüş Akçe Darphanesi',
    shortTitle: 'Tahrir & Akçe',
    branch: 'ECONOMY',
    tier: 1,
    subRow: 0,
    artKey: 'TREASURY',
    cost: 140,
    description:
      'Tüm sancakların arazi ve vergi gelirlerini kayıt altına alarak vergi kaçağını ve sikke tağşişini önler.',
    effectLabel: '+%15 Vergi Geliri',
  },
  {
    id: 'eco_2',
    name: 'Bedesten, Lonca & Dokuma İmalathaneleri',
    shortTitle: 'Bedesten & Lonca',
    branch: 'ECONOMY',
    tier: 2,
    subRow: 0,
    artKey: 'TRADE',
    cost: 290,
    prerequisite: 'eco_1',
    description:
      'Şehirlerdeki Ahi loncalarını, ipek ve demir işliklerini büyüterek zanaat üretimini katlar.',
    effectLabel: '+%25 Üretim Geliri',
  },
  {
    id: 'eco_3',
    name: 'İpek ve Baharat Yolu Gümrük Tekeli',
    shortTitle: 'İpek Yolu Tekeli',
    branch: 'ECONOMY',
    tier: 3,
    subRow: 0,
    artKey: 'TRADE',
    cost: 500,
    prerequisite: 'eco_2',
    description:
      'Ulusal iç pazar ticaret gelirini artırır.',
    effectLabel: '+%30 İç Pazar Ticareti',
  },
  {
    id: 'eco_4',
    name: 'Hazine-i Hassa & Vakıf Finans Ağı',
    shortTitle: 'Hazine-i Hassa',
    branch: 'ECONOMY',
    tier: 4,
    subRow: 0,
    artKey: 'TREASURY',
    cost: 780,
    prerequisite: 'eco_3',
    description:
      'Merkezî hazine tahsilat ve vergi denetimiyle vergi gelirini artırır.',
    effectLabel: '+%20 Vergi Geliri',
  },
  {
    id: 'eco_5',
    name: 'Akdeniz-Hint Deniz & Kervan Tekeli',
    shortTitle: 'Cihan Kervan Ağı',
    branch: 'ECONOMY',
    tier: 5,
    subRow: 0,
    artKey: 'TRADE',
    cost: 1100,
    prerequisite: 'eco_4',
    description:
      'Kıyı tersaneleri, gümrük boğazları ve büyük kervan yollarından gelen ticaret gelirini ve şehir yatırım verimini büyütür.',
    effectLabel: '+%25 Boğaz & Kervan Ticareti · +%0,20 Yatırım',
  },

  // ECONOMY SPECIALIST (1440: Tarım, Madencilik & Sarraf Bankacılığı)
  {
    id: 'eco_1b',
    name: 'Sulama Kanalları & Hububat Ambarları',
    shortTitle: 'Sulama & Ambar',
    branch: 'ECONOMY',
    tier: 1,
    subRow: 1,
    artKey: 'AGRICULTURE',
    cost: 135,
    description:
      'Taş su kemerleri ve büyük zahire ambarlarıyla tarımsal refahı artırarak nüfus büyümesini ve insan gücünü hızlandırır.',
    effectLabel: '+%25 Nüfus Artışı · +%10 İnsan Gücü',
  },
  {
    id: 'eco_2b',
    name: 'Kraliyet Madenleri & Demir Döküm',
    shortTitle: 'Kraliyet Madenleri',
    branch: 'ECONOMY',
    tier: 2,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 275,
    prerequisite: 'eco_1b',
    description:
      'Gümüş, bakır ve demir madenlerini modernize ederek üretimi büyütür, kale ve şehir inşa giderlerini azaltır.',
    effectLabel: '+%15 Üretim · -%12 İnşa Maliyeti',
  },
  {
    id: 'eco_3b',
    name: 'Sarraf & Poliçe Bankacılığı',
    shortTitle: 'Sarraf & Poliçe',
    branch: 'ECONOMY',
    tier: 3,
    subRow: 1,
    artKey: 'TREASURY',
    cost: 490,
    prerequisite: 'eco_2b',
    description:
      'Güvenilir poliçe ve sarraf loncalarıyla sikke değerini koruyarak günlük enflasyonu düşürür, vergi gelirini artırır.',
    effectLabel: '−0,02 Günlük Enflasyon · +%12 Vergi',
  },
  {
    id: 'eco_4b',
    name: 'İmparatorluk Şoseleri & Kervansaray Ağı',
    shortTitle: 'Kervansaray Ağı',
    branch: 'ECONOMY',
    tier: 4,
    subRow: 1,
    artKey: 'AGRICULTURE',
    cost: 760,
    prerequisite: 'eco_3b',
    description:
      'Taş döşeli ana yollar ve menzil kervansaraylarıyla ticareti canlandırır, orduların ikmal kapasitesini artırır.',
    effectLabel: '+%18 Ticaret · +%15 İkmal Limiti',
  },
  {
    id: 'eco_5b',
    name: 'Cihan Ticaret Borsası & Altın Standart',
    shortTitle: 'Altın Standart',
    branch: 'ECONOMY',
    tier: 5,
    subRow: 1,
    artKey: 'TREASURY',
    cost: 1080,
    prerequisite: 'eco_4b',
    description:
      'Altın sikke standardı ve kıtalararası ticaret borsasıyla hazine vergi gelirlerini zirveye taşır, enflasyonu bastırır.',
    effectLabel: '+%25 Vergi Geliri · −0,025 Enflasyon',
  },

  // ADMINISTRATION MAIN (1440 Historical Era)
  {
    id: 'adm_1',
    name: 'İstimalet & İskân Siyaseti',
    shortTitle: 'İstimalet Siyaseti',
    branch: 'ADMINISTRATION',
    tier: 1,
    subRow: 0,
    artKey: 'COURT',
    cost: 145,
    description:
      'Çekirdek dışı sancaklardaki pozitif haftalık huzursuzluk artışını azaltır.',
    effectLabel: '-%30 Çekirdek Dışı Huzursuzluk Artışı',
  },
  {
    id: 'adm_2',
    name: 'Divan-ı Hümayun & Sefaret Teşkilatı',
    shortTitle: 'Divan-ı Hümayun',
    branch: 'ADMINISTRATION',
    tier: 2,
    subRow: 0,
    artKey: 'COURT',
    cost: 280,
    prerequisite: 'adm_1',
    description:
      'Diplomatik teşkilat, savaş sonrası ve kabine kararlarıyla kazanılan agresif genişlemeyi azaltır.',
    effectLabel: '-%25 Agresif Genişleme Kazanımı',
  },
  {
    id: 'adm_3',
    name: 'Tımar & İltizam Seferberlik Nizâmı',
    shortTitle: 'Tımar Seferberliği',
    branch: 'ADMINISTRATION',
    tier: 3,
    subRow: 0,
    artKey: 'INFANTRY',
    cost: 480,
    prerequisite: 'adm_2',
    description:
      'Sancaklardaki asker yükümlülüğünü genişleterek sefer öncesi insan gücü havuz tavanını ve yenilenmesini büyütür.',
    effectLabel: '+%35 İnsan Gücü · +%25 Havuz Tavanı',
  },
  {
    id: 'adm_4',
    name: 'Kanunnâme-i Âl-i Osman (Cihanşümul İdare)',
    shortTitle: 'Kanunnâme İdaresi',
    branch: 'ADMINISTRATION',
    tier: 4,
    subRow: 0,
    artKey: 'COURT',
    cost: 750,
    prerequisite: 'adm_3',
    description:
      'Çok uluslu imparatorluk mülkünde sarsılmaz kanun düzeni, yüksek ikmal ve tâbi devlet haracı sağlar.',
    effectLabel: '+%50 Vasal Haracı · +%20 İkmal',
  },
  {
    id: 'adm_5',
    name: 'Cihanşümul İskân & Eyalet Kanunu',
    shortTitle: 'Eyalet Kanunu',
    branch: 'ADMINISTRATION',
    tier: 5,
    subRow: 0,
    artKey: 'COURT',
    cost: 1060,
    prerequisite: 'adm_4',
    description:
      'Fethedilen sancakların Öz Vatan (Core) bütünleşmesini hızlandırır ve tüm eyaletlerde günlük huzursuzluğu yatıştırır.',
    effectLabel: '+%40 Asimilasyon Hızı · −0,35 Huzursuzluk',
  },

  // ADMINISTRATION SPECIALIST (1440: Kadı, Elçilik & Mimarbaşı)
  {
    id: 'adm_1b',
    name: 'Kadı Sicilleri & Yerel Asayiş',
    shortTitle: 'Kadı & Asayiş',
    branch: 'ADMINISTRATION',
    tier: 1,
    subRow: 1,
    artKey: 'COURT',
    cost: 140,
    description:
      'Bağımsız kadı mahkemeleriyle tüm sancaklarda günlük huzursuzluğu düşürür ve vakıf imar giderlerini azaltır.',
    effectLabel: '−0,20 Günlük Huzursuzluk · -%10 İnşa Maliyeti',
  },
  {
    id: 'adm_2b',
    name: 'Elçilik & Ahidnâme Protokolü',
    shortTitle: 'Ahidnâme Elçiliği',
    branch: 'ADMINISTRATION',
    tier: 2,
    subRow: 1,
    artKey: 'COURT',
    cost: 270,
    prerequisite: 'adm_1b',
    description:
      'Daimi elçilikler ve yazılı ahidnâmelerle günlük diplomasi puanı kazandırır, fetihlerdeki gerilimi hafifletir.',
    effectLabel: '+1 Günlük Diplomasi Puanı · -%10 AE',
  },
  {
    id: 'adm_3b',
    name: 'Mimarbaşı & İmar Loncaları',
    shortTitle: 'Mimarbaşı İmarı',
    branch: 'ADMINISTRATION',
    tier: 3,
    subRow: 1,
    artKey: 'FORTRESS',
    cost: 470,
    prerequisite: 'adm_2b',
    description:
      'Hassa Mimarlar Ocağı sayesinde şehir ve kale inşaatlarını hızlandırır, eyalet yatırım çarpanını yükseltir.',
    effectLabel: '-%20 İnşa Süresi · +%12 Şehir Yatırımı',
  },
  {
    id: 'adm_4b',
    name: 'Merkezi Tımar & Sancak Denetimi',
    shortTitle: 'Sancak Denetimi',
    branch: 'ADMINISTRATION',
    tier: 4,
    subRow: 1,
    artKey: 'AGRICULTURE',
    cost: 730,
    prerequisite: 'adm_3b',
    description:
      'Düzenli sancak teftişleriyle insan gücü havuzunu genişletir ve fethedilen eyaletlerin asimilasyonunu hızlandırır.',
    effectLabel: '+%20 İnsan Gücü Tavanı · +%20 Asimilasyon',
  },
  {
    id: 'adm_5b',
    name: 'Ebed-Müddet Devlet & Cihan Hukuku',
    shortTitle: 'Ebed-Müddet Hukuk',
    branch: 'ADMINISTRATION',
    tier: 5,
    subRow: 1,
    artKey: 'COURT',
    cost: 1040,
    prerequisite: 'adm_4b',
    description:
      'İmparatorluk hukuk birliğiyle vasal haraç gelirlerini yükseltir ve tüm topraklarda kalıcı asayiş kurar.',
    effectLabel: '+%30 Vasal Haracı · −0,25 Huzursuzluk',
  },

  // SCIENCE MAIN (1440 Historical Era)
  {
    id: 'sci_1',
    name: 'Sahn-ı Seman Medreseleri',
    shortTitle: 'Sahn-ı Seman',
    branch: 'SCIENCE',
    tier: 1,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 155,
    description:
      'Büyük ilim merkezleri ve medreseler kurarak matematik, tıp ve mühendislik bilimini hızlandırır.',
    effectLabel: '+%20 Araştırma Hızı',
  },
  {
    id: 'sci_2',
    name: 'Tophane-i Âmire & Çelik Metalurjisi',
    shortTitle: 'Çelik Metalurjisi',
    branch: 'SCIENCE',
    tier: 2,
    subRow: 0,
    artKey: 'ENGINEERING',
    cost: 310,
    prerequisite: 'sci_1',
    description:
      'Üretim gelirini artırır ve yabancı ticaret ambargolarının ekonomi üzerindeki etkisini azaltır.',
    effectLabel: 'Ambargo Etkisi -%50 · +%15 Üretim',
  },
  {
    id: 'sci_3',
    name: 'Rasathane & Haritacılık (Pîrî Reis Ekolü)',
    shortTitle: 'Pîrî Reis Haritası',
    branch: 'SCIENCE',
    tier: 3,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 530,
    prerequisite: 'sci_2',
    description:
      'Haritacılık ve rasathaneler araştırma hızını artırır; haritadaki tüm bölgeleri görünür kılar.',
    effectLabel: '+%25 Araştırma · Tüm Harita Görünür',
  },
  {
    id: 'sci_4',
    name: 'Mühendishâne-i Berrî-i Hümâyun',
    shortTitle: 'Mühendishâne',
    branch: 'SCIENCE',
    tier: 4,
    subRow: 0,
    artKey: 'ENGINEERING',
    cost: 860,
    prerequisite: 'sci_3',
    description:
      'İmparatorluk mühendislik akademisiyle hem sivil üretimi hem askeri teknolojiyi çağın zirvesine çıkarır.',
    effectLabel: '+%35 Üretim Geliri',
  },
  {
    id: 'sci_5',
    name: 'Takiyüddin Rasathanesi & Büyük Bilim Çağı',
    shortTitle: 'Büyük Rasathane',
    branch: 'SCIENCE',
    tier: 5,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 1200,
    prerequisite: 'sci_4',
    description:
      'İleri astronomi, haritacılık ve mühendislik mektepleriyle araştırma hızını, üretimi ve şehir gelişimini zirveye taşır.',
    effectLabel: '+%30 Araştırma · +%20 Üretim · +%0,20 Yatırım',
  },

  // SCIENCE SPECIALIST (1440: Tıp, Matbaa & Seyrüsefer)
  {
    id: 'sci_1b',
    name: 'Şifahaneler & Cerrahi İlmi',
    shortTitle: 'Şifahane & Tıp',
    branch: 'SCIENCE',
    tier: 1,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 145,
    description:
      'Darüşşifalar ve gelişmiş cerrahi bilgisiyle salgın kayıplarını azaltarak nüfus artışını ve insan gücünü yükseltir.',
    effectLabel: '+%30 Nüfus Artışı · +%15 İnsan Gücü',
  },
  {
    id: 'sci_2b',
    name: 'Matbaa & Kâğıt İmalathanesi',
    shortTitle: 'Matbaa & Kâğıt',
    branch: 'SCIENCE',
    tier: 2,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 295,
    prerequisite: 'sci_1b',
    description:
      'Basılı eserlerin ve kâğıthanelerin yayılmasıyla devlet genelinde bilimsel araştırma hızını ciddi ölçüde artırır.',
    effectLabel: '+%18 Araştırma Hızı',
  },
  {
    id: 'sci_3b',
    name: 'Usturlab & Açık Deniz Seyrüseferi',
    shortTitle: 'Usturlab & Deniz',
    branch: 'SCIENCE',
    tier: 3,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 510,
    prerequisite: 'sci_2b',
    description:
      'Gök bilimi destekli deniz haritalarıyla filo muharebe gücünü ve boğaz ticaret gelirlerini yükseltir.',
    effectLabel: '+%15 Deniz Gücü · +%15 Boğaz Ticareti',
  },
  {
    id: 'sci_4b',
    name: 'Su Değirmeni & Mekanik Çarklar',
    shortTitle: 'Mekanik Çarklar',
    branch: 'SCIENCE',
    tier: 4,
    subRow: 1,
    artKey: 'AGRICULTURE',
    cost: 820,
    prerequisite: 'sci_3b',
    description:
      'Su gücüyle çalışan atölyeler ve mekanik vinçlerle üretimi büyütür, tüm eyalet inşa maliyetlerini düşürür.',
    effectLabel: '+%20 Üretim · -%15 İnşa Maliyeti',
  },
  {
    id: 'sci_5b',
    name: 'Büyük Bilim Akademisi & Rönesans',
    shortTitle: 'Bilim Akademisi',
    branch: 'SCIENCE',
    tier: 5,
    subRow: 1,
    artKey: 'OBSERVATORY',
    cost: 1180,
    prerequisite: 'sci_4b',
    description:
      'Çağın en büyük alimlerini bir araya getirerek araştırma hızında ve askeri teknolojide tartışmasız üstünlük kurar.',
    effectLabel: '+%35 Araştırma Hızı · +%15 Muharebe Gücü',
  },
  // TIER 6 (Çağ VI - 1440 Cihan İmparatorluğu Zirvesi)
  {
    id: 'mil_6',
    name: 'Cihanşümul Topçu & Nizamiye Ordusu',
    shortTitle: 'Cihan Ordusu',
    branch: 'MILITARY',
    tier: 6,
    subRow: 0,
    artKey: 'ARTILLERY',
    cost: 1480,
    prerequisite: 'mil_5',
    description: 'Standartlaştırılmış sahra topçusu ve seçkin piyade tümenleriyle meydan muharebelerinde ve savunmada ezici üstünlük sağlar.',
    effectLabel: '+%25 Muharebe Gücü · +%15 Ulusal Savunma',
  },
  {
    id: 'mil_6b',
    name: 'Üç Ambarlı Kalyon & Okyanus Donanması',
    shortTitle: 'Üç Ambarlı Kalyon',
    branch: 'MILITARY',
    tier: 6,
    subRow: 1,
    artKey: 'NAVAL',
    cost: 1420,
    prerequisite: 'mil_5b',
    description: 'Ağır toplu üç ambarlı kalyon filolarıyla tüm denizlerde mutlak hakimiyet ve sefer ikmal genişliği kurar.',
    effectLabel: '+%25 Deniz Gücü · +%20 İkmal Limiti',
  },
  {
    id: 'eco_6',
    name: 'İmparatorluk İmalathaneleri & Darphane Reformu',
    shortTitle: 'Büyük İmalathane',
    branch: 'ECONOMY',
    tier: 6,
    subRow: 0,
    artKey: 'ENGINEERING',
    cost: 1400,
    prerequisite: 'eco_5',
    description: 'Büyük ölçekli devlet imalathaneleri ve merkezî hazine denetimiyle üretim ve vergi gelirlerini zirveye çıkarır.',
    effectLabel: '+%25 Üretim Geliri · +%20 Vergi Geliri',
  },
  {
    id: 'eco_6b',
    name: 'Üç Kıta Kervan & Deniz Ticaret Tekeli',
    shortTitle: 'Üç Kıta Ticareti',
    branch: 'ECONOMY',
    tier: 6,
    subRow: 1,
    artKey: 'TREASURY',
    cost: 1360,
    prerequisite: 'eco_5b',
    description: 'Doğu ile Batı arasındaki tüm ticaret boğazlarını ve bedestenleri birleştirerek ticaret gelirini büyütür, enflasyonu düşürür.',
    effectLabel: '+%25 Ticaret Geliri · −0,025 Günlük Enflasyon',
  },
  {
    id: 'adm_6',
    name: 'Kanunnâme-i Cihan & Merkezî Bürokrasi',
    shortTitle: 'Kanunnâme-i Cihan',
    branch: 'ADMINISTRATION',
    tier: 6,
    subRow: 0,
    artKey: 'COURT',
    cost: 1350,
    prerequisite: 'adm_5',
    description: 'Kusursuz divan teşkilatı ve eyalet adaletiyle asimilasyonu hızlandırır, huzursuzluğu bastırır ve insan gücünü artırır.',
    effectLabel: '+%30 Asimilasyon · −0,20 Huzursuzluk · +%20 İnsan Gücü',
  },
  {
    id: 'adm_6b',
    name: 'Hilâfet & Cihanşümul Saltanat Prestiji',
    shortTitle: 'Saltanat Prestiji',
    branch: 'ADMINISTRATION',
    tier: 6,
    subRow: 1,
    artKey: 'COURT',
    cost: 1320,
    prerequisite: 'adm_5b',
    description: 'Cihan çapında diplomatik meşruiyet ve başkent ihtişamıyla agresif genişlemeyi azaltır, bağlı devlet haraçlarını artırır.',
    effectLabel: '−%15 Agresif Genişleme · +%35 Vasal Haracı',
  },
  {
    id: 'sci_6',
    name: 'Darülfünun-u Osmani & Külliye Şebekesi',
    shortTitle: 'Büyük Darülfünun',
    branch: 'SCIENCE',
    tier: 6,
    subRow: 0,
    artKey: 'OBSERVATORY',
    cost: 1500,
    prerequisite: 'sci_5',
    description: 'Başkent ve eyaletlerdeki darülfünun ile medrese ağını birleştirerek araştırma hızını ve maksimum teknoloji tavanını yükseltir.',
    effectLabel: '+%35 Araştırma Hızı · +3,0 Maks Teknoloji Tavanı',
  },
  {
    id: 'sci_6b',
    name: 'Buhar Makineleri & Erken Sanayi Devrimi',
    shortTitle: 'Sanayi Devrimi',
    branch: 'SCIENCE',
    tier: 6,
    subRow: 1,
    artKey: 'ENGINEERING',
    cost: 1460,
    prerequisite: 'sci_5b',
    description: 'Mekanik buhar gücü ve modern metalürjiyle hem bilimsel araştırmada hem de sanayi üretiminde yeni bir çağ başlatır.',
    effectLabel: '+%25 Araştırma · +%20 Üretim · -%10 İnşa Maliyeti',
  },
];

export interface NationTechMetrics {
  techLevel: number;
  maxTechLevel: number;
  monthlyTechGrowth: number;
  capitalLevel: number;
  prestige: number;
  schoolCount: number;
  highSchoolCount: number;
  universityCount: number;
  capitalPalaceLevel: number;
  eraLabel: string;
}

export function computeNationTechMetrics(
  nation: Pick<
    Nation,
    | 'id'
    | 'unlockedTechs'
    | 'enactedReforms'
    | 'researchPoints'
    | 'stability'
    | 'treasury'
    | 'formedEmpireId'
    | 'capitalTerritoryId'
  >,
  territories: Record<
    string,
    {
      ownerId: string;
      isCapital?: boolean;
      buildings?: Partial<Record<keyof Territory['buildings'], number>>;
    }
  >,
  gameMode: string = 'EMPIRES_1440',
  dailyResearch: number = 4.5
): NationTechMetrics {
  const is1440 = gameMode === 'EMPIRES_1440';
  const unlocked = nation.unlockedTechs || [];
  const reforms = nation.enactedReforms || [];

  let ownedCount = 0;
  let schoolCount = 0;
  let highSchoolCount = 0;
  let universityCount = 0;
  let totalBuildingLevels = 0;
  let capitalBuildingLevels = 0;
  let capitalPalaceLevel = 0;

  for (const [tId, t] of Object.entries(territories)) {
    if (!t || t.ownerId !== nation.id) continue;
    ownedCount++;
    const b = t.buildings || {};
    const sLvl = b.school || 0;
    const hLvl = b.highSchool || 0;
    const uLvl = b.university || 0;
    const pLvl = b.capitalPalace || 0;
    schoolCount += sLvl;
    highSchoolCount += hLvl;
    universityCount += uLvl;

    const sumLvl =
      (b.factory || 0) +
      (b.barracks || 0) +
      (b.fortress || 0) +
      uLvl +
      (b.tradeHub || 0) +
      (b.supplyDepot || 0) +
      (b.shipyard || 0) +
      (b.mint || 0) +
      (b.granary || 0) +
      sLvl +
      hLvl +
      pLvl;
    totalBuildingLevels += sumLvl;

    if (t.isCapital || tId === nation.capitalTerritoryId) {
      capitalBuildingLevels = Math.max(capitalBuildingLevels, sumLvl);
      capitalPalaceLevel = Math.max(capitalPalaceLevel, pLvl);
    }
  }

  const capitalLevel = Math.min(
    10,
    Math.max(
      1,
      1 +
        capitalPalaceLevel +
        Math.min(4, Math.floor(capitalBuildingLevels / 4)) +
        (unlocked.includes('adm_1') ? 1 : 0) +
        (unlocked.includes('adm_6') ? 1 : 0)
    )
  );

  const eduLevelBonus =
    schoolCount * 0.08 + highSchoolCount * 0.14 + universityCount * 0.22;
  const eduCapBonus =
    schoolCount * 0.25 + highSchoolCount * 0.45 + universityCount * 0.75;

  const sciCapBonus =
    (unlocked.includes('sci_1') ? 0.8 : 0) +
    (unlocked.includes('sci_2') ? 1.0 : 0) +
    (unlocked.includes('sci_3') ? 1.2 : 0) +
    (unlocked.includes('sci_4') ? 1.5 : 0) +
    (unlocked.includes('sci_5') ? 2.0 : 0) +
    (unlocked.includes('sci_6') ? 3.0 : 0);

  const baseMax = is1440 ? 4.4 : 13.5;
  const maxTechLevel = Number(
    Math.min(
      is1440 ? 18.0 : 32.0,
      baseMax + capitalLevel * (is1440 ? 0.85 : 1.15) + eduCapBonus + sciCapBonus
    ).toFixed(1)
  );

  const baseTech = is1440 ? 1.1 : 6.6;
  const perTechGain = is1440 ? 0.22 : 0.36;
  const rawTechLevel =
    baseTech +
    unlocked.length * perTechGain +
    reforms.length * 0.18 +
    Math.min(is1440 ? 3.2 : 5.5, eduLevelBonus) +
    Math.min(0.45, (nation.researchPoints || 0) / 1800);

  const techLevel = Number(Math.min(maxTechLevel, rawTechLevel).toFixed(2));
  const monthlyTechGrowth = Number(
    Math.max(0.08, dailyResearch * (is1440 ? 0.032 : 0.045)).toFixed(2)
  );

  const prestige = Math.round(
    80 +
      unlocked.length * 22 +
      reforms.length * 35 +
      capitalLevel * 32 +
      capitalPalaceLevel * 25 +
      (nation.formedEmpireId ? 240 : 0) +
      ownedCount * 11 +
      totalBuildingLevels * 7 +
      (nation.stability || 70) * 1.1
  );

  const eraLabel = is1440
    ? techLevel >= 7.5
      ? 'Sanayi & Nizâm-ı Cedîd Çağı'
      : techLevel >= 4.5
        ? 'Barut & Kalyon İmparatorluğu'
        : techLevel >= 2.5
          ? 'Rönesans & Topçu Çağı'
          : 'Erken Barut & Beylik Çağı (1440)'
    : techLevel >= 16
      ? 'Kuantum & Uzay Medeniyeti'
      : techLevel >= 11.5
        ? 'Otonom Sürü & Yapay Zekâ Çağı'
        : techLevel >= 8.5
          ? 'Endüstri 5.0 & Dijital Çağ'
          : 'Modern Küresel Çağ (2026)';

  return {
    techLevel,
    maxTechLevel,
    monthlyTechGrowth,
    capitalLevel,
    prestige,
    schoolCount,
    highSchoolCount,
    universityCount,
    capitalPalaceLevel,
    eraLabel,
  };
}

export interface ArmyGenerationMetadata {
  tier: number; // 0..4
  generationLabel: string;
  eraTitle: string;
  infantryName: string;
  infantryShort: string;
  infantryClassLabel: string;
  armorName: string;
  armorShort: string;
  armorClassLabel: string;
  airArtilleryName: string;
  airArtilleryShort: string;
  airArtilleryClassLabel: string;
  combatBonusPct: number; // Bonus granted once existing armies are modernized to this tier
}

export const ARMY_GENERATIONS_1440: ArmyGenerationMetadata[] = [
  {
    tier: 0,
    generationLabel: 'Nesil I',
    eraTitle: 'Beylik & Erken Dönem Ordusu',
    infantryName: 'Azap Piyadesi & Yayalar (Okçu)',
    infantryShort: 'Piyade / Okçu',
    infantryClassLabel: 'Piyade & Okçu',
    armorName: 'Akıncı & Atlı Okçu Bölüğü',
    armorShort: 'Atlı Okçu',
    armorClassLabel: 'Atlı Okçu & Hafif Süvari',
    airArtilleryName: 'Kuşatma Mancınığı',
    airArtilleryShort: 'Mancınık',
    airArtilleryClassLabel: 'Kuşatma Topçusu',
    combatBonusPct: 0,
  },
  {
    tier: 1,
    generationLabel: 'Nesil II',
    eraTitle: 'Kapıkulu & Tımar Nizâmı',
    infantryName: 'Yeniçeri Piyadesi & Kemankeş Okçu',
    infantryShort: 'Yeniçeri / Okçu',
    infantryClassLabel: 'Ağır Piyade & Okçu',
    armorName: 'Tımarlı Sipahi (Ağır Süvari)',
    armorShort: 'Sipahi Süvari',
    armorClassLabel: 'Ağır Süvari',
    airArtilleryName: 'Darbzen Sahra Topu',
    airArtilleryShort: 'Darbzen Top',
    airArtilleryClassLabel: 'Topçu',
    combatBonusPct: 12,
  },
  {
    tier: 2,
    generationLabel: 'Nesil III',
    eraTitle: 'Barutlu Tüfek & Tabur Cengi',
    infantryName: 'Tüfekli Yeniçeri (Misketçi Piyade)',
    infantryShort: 'Tüfekli Piyade',
    infantryClassLabel: 'Barutlu Piyade',
    armorName: 'Zırhlı Cebeli Sipahi',
    armorShort: 'Zırhlı Süvari',
    armorClassLabel: 'Zırhlı Süvari',
    airArtilleryName: 'Kolunburna Topçu Bataryası',
    airArtilleryShort: 'Kolunburna Top',
    airArtilleryClassLabel: 'Topçu',
    combatBonusPct: 24,
  },
  {
    tier: 3,
    generationLabel: 'Nesil IV',
    eraTitle: 'Şahi Kuşatma İmparatorluğu',
    infantryName: 'Seçkin Solak & Sekban Piyadesi',
    infantryShort: 'Seçkin Piyade',
    infantryClassLabel: 'Nizami Piyade',
    armorName: 'Ağır Kapıkulu Süvari Alayı',
    armorShort: 'Kapıkulu Süvari',
    armorClassLabel: 'Ağır Süvari',
    airArtilleryName: 'Şahi Kuşatma Topu',
    airArtilleryShort: 'Şahi Topu',
    airArtilleryClassLabel: 'Ağır Kuşatma Topçusu',
    combatBonusPct: 38,
  },
  {
    tier: 4,
    generationLabel: 'Nesil V',
    eraTitle: 'Nizâm-ı Cedîd Modern Ordusu',
    infantryName: 'Nizâm-ı Cedîd Süngülü Piyade',
    infantryShort: 'Nizami Piyade',
    infantryClassLabel: 'Modern Piyade',
    armorName: 'Mızraklı Hassa Süvari Alayı',
    armorShort: 'Hassa Süvari',
    armorClassLabel: 'Mızraklı Süvari',
    airArtilleryName: 'Seri Ateşli Sahra Topçusu',
    airArtilleryShort: 'Sahra Topu',
    airArtilleryClassLabel: 'Seri Topçu',
    combatBonusPct: 55,
  },
];

export const ARMY_GENERATIONS_2026: ArmyGenerationMetadata[] = [
  {
    tier: 0,
    generationLabel: 'Nesil I',
    eraTitle: 'Standart Konvansiyonel Ordu',
    infantryName: 'Motorize Piyade Tümeni',
    infantryShort: 'Piyade',
    infantryClassLabel: 'Motorize Piyade',
    armorName: 'Zırhlı Tank Tugayı',
    armorShort: 'Zırhlı Tank',
    armorClassLabel: 'Zırhlı / Tank',
    airArtilleryName: 'Obüs & Taktik İHA Bataryası',
    airArtilleryShort: 'Topçu / İHA',
    airArtilleryClassLabel: 'Topçu & Hava Destek',
    combatBonusPct: 0,
  },
  {
    tier: 1,
    generationLabel: 'Nesil II',
    eraTitle: 'Ağ Merkezli Müşterek Ordu',
    infantryName: 'Ağ Merkezli Mekanize Piyade',
    infantryShort: 'Mekanize Piyade',
    infantryClassLabel: 'Mekanize Piyade',
    armorName: 'Reaktif Zırhlı Tank Tugayı',
    armorShort: 'Reaktif Tank',
    armorClassLabel: 'Zırhlı / Tank',
    airArtilleryName: 'Taarruzi SİHA & Kundağı Top',
    airArtilleryShort: 'SİHA / Obüs',
    airArtilleryClassLabel: 'Topçu & SİHA',
    combatBonusPct: 12,
  },
  {
    tier: 2,
    generationLabel: 'Nesil III',
    eraTitle: 'Otonom Sürü & Komando Doktrini',
    infantryName: 'Seçkin Komando Piyade Tugayı',
    infantryShort: 'Komando Piyade',
    infantryClassLabel: 'Komando Piyade',
    armorName: 'Ana Muharebe Tankı (AMT)',
    armorShort: 'Modern Tank',
    armorClassLabel: 'Ana Muharebe Tankı',
    airArtilleryName: 'Otonom Sürü SİHA & Roket',
    airArtilleryShort: 'Sürü SİHA',
    airArtilleryClassLabel: 'Hava & Roket Topçusu',
    combatBonusPct: 24,
  },
  {
    tier: 3,
    generationLabel: 'Nesil IV',
    eraTitle: 'Hipersonik & Dijital Kolordu',
    infantryName: 'Dijital Muharip Piyade Tümeni',
    infantryShort: 'Dijital Piyade',
    infantryClassLabel: 'Dijital Piyade',
    armorName: 'Aktif Korumalı Ağır Tank',
    armorShort: 'AKT Tank',
    armorClassLabel: 'Aktif Korumalı Tank',
    airArtilleryName: 'Hipersonik Füze & SİHA Filosu',
    airArtilleryShort: 'Hipersonik',
    airArtilleryClassLabel: 'Hipersonik Topçu',
    combatBonusPct: 38,
  },
  {
    tier: 4,
    generationLabel: 'Nesil V',
    eraTitle: 'Gök Kubbe & Gelecek Ordusu',
    infantryName: 'Zırhlı Dış İskelet Piyadesi',
    infantryShort: 'Elit Piyade',
    infantryClassLabel: 'Elit Piyade',
    armorName: 'Otonom Zırhlı Tank Tümeni',
    armorShort: 'Otonom Tank',
    armorClassLabel: 'Otonom Zırhlı',
    airArtilleryName: 'Gök Kubbe Hava & Topçu Filosu',
    airArtilleryShort: 'Gök Kubbe',
    airArtilleryClassLabel: 'Stratejik Hava & Topçu',
    combatBonusPct: 55,
  },
];

export function getTechTreeForMode(gameMode?: string): TechDefinition[] {
  return gameMode === 'EMPIRES_1440' ? TECH_TREE_1440 : TECH_TREE;
}

export function getNationUnlockedMilTier(nation?: Pick<Nation, 'unlockedTechs'> | null): number {
  if (!nation?.unlockedTechs) return 0;
  if (nation.unlockedTechs.includes('mil_4')) return 4;
  if (nation.unlockedTechs.includes('mil_3')) return 3;
  if (nation.unlockedTechs.includes('mil_2')) return 2;
  if (nation.unlockedTechs.includes('mil_1')) return 1;
  return 0;
}

export function getNationModernizedTier(
  nation?: Pick<Nation, 'unlockedTechs' | 'modernizedArmyTier'> | null
): number {
  if (!nation) return 0;
  const unlocked = getNationUnlockedMilTier(nation);
  return Math.min(unlocked, Math.max(0, nation.modernizedArmyTier ?? 0));
}

export function getArmyGenerationInfo(
  gameMode?: string,
  tier: number = 0
): ArmyGenerationMetadata {
  const list =
    gameMode === 'EMPIRES_1440' ? ARMY_GENERATIONS_1440 : ARMY_GENERATIONS_2026;
  const clamped = Math.max(0, Math.min(list.length - 1, tier));
  return list[clamped];
}

export function calculateArmyModernizationCost(
  nation: Pick<Nation, 'unlockedTechs' | 'modernizedArmyTier'>,
  totalTroops: number
): number {
  const unlocked = getNationUnlockedMilTier(nation);
  const current = getNationModernizedTier(nation);
  const tierDiff = Math.max(1, unlocked - current);
  // Scales smoothly with standing army size and number of tech generations jumped
  const baseCost = 320 * tierDiff;
  const perThousandCost = Math.round((totalTroops / 1000) * 3.8 * tierDiff);
  return Math.min(4800, Math.max(350, baseCost + perThousandCost));
}

export const REFORMS_1440: ReformDefinition[] = [
  {
    id: 'ref_central_bank',
    name: 'Sikke Tashihi & Darphane-i Âmire Nizâmı',
    category: 'Maliye',
    costGold: 1150,
    costResearch: 120,
    description: 'Her oyun günü enflasyon değişimini 0,025 puan azaltır.',
    effectLabel: 'Günlük enflasyon değişimi −0,025 puan',
  },
  {
    id: 'ref_professional_army',
    name: 'Kapıkulu & Tımar Kanunnâmesi',
    category: 'Askeriye',
    costGold: 1450,
    costResearch: 140,
    description: 'Sefer ve ulufe düzenini ıslah ederek orduların vuruş gücünü artırır, bakım yükünü azaltır.',
    effectLabel: '+%15 Ordu Gücü & -%10 Ordu Bakımı',
  },
  {
    id: 'ref_free_trade_zones',
    name: 'Kervansaray & Serbest İskele İmtiyazları',
    category: 'Ticaret',
    costGold: 1250,
    costResearch: 130,
    description: 'Vergi gelirini ve yurt içi pazar ticaretini artırır.',
    effectLabel: '+%20 Vergi Geliri · +%20 İç Pazar Ticareti',
  },
  {
    id: 'ref_national_defense_industry',
    name: 'Tophane & Tersane-i Âmire Hamlesi',
    category: 'Savunma',
    costGold: 1650,
    costResearch: 160,
    description: 'Yerli savunma sanayii asker toplama maliyetini azaltır.',
    effectLabel: '-%20 Asker Toplama Maliyeti',
  },
  {
    id: 'ref_welfare_state',
    name: 'Külliye, İmarethane ve Medrese Vakıfları',
    category: 'Toplum',
    costGold: 1200,
    costResearch: 125,
    description: 'Yürürlüğe girdiğinde ulusal istikrarı 12 puan artırır ve günlük araştırmaya 5 puan ekler.',
    effectLabel: '+12 Ulusal İstikrar & +5 Araştırma/Gün',
  },
  {
    id: 'ref_imperial_diplomacy',
    name: 'Ahidnâme & Cihan Sulhu Diplomasisi',
    category: 'Diplomasi',
    costGold: 1100,
    costResearch: 115,
    description: 'Yürürlüğe girdiğinde agresif genişlemeyi 15 puan azaltır ve diğer ülkelerle ilişkiyi en çok 15 puan artırır.',
    effectLabel: 'Bir kez −15 AE · Diğer ülkelerle +15 ilişki',
  },
];

export function getReformsForMode(gameMode?: string): ReformDefinition[] {
  return gameMode === 'EMPIRES_1440' ? REFORMS_1440 : REFORMS;
}

export const REFORMS: ReformDefinition[] = [
  {
    id: 'ref_central_bank',
    name: 'Bağımsız Para Politikası Kurulu',
    category: 'Ekonomi',
    costGold: 1150,
    costResearch: 120,
    description: 'Her oyun günü enflasyon değişimini 0,025 puan azaltır.',
    effectLabel: 'Günlük enflasyon değişimi −0,025 puan',
  },
  {
    id: 'ref_professional_army',
    name: 'Profesyonel Özel Kuvvetler Doktrini',
    category: 'Askeriye',
    costGold: 1450,
    costResearch: 140,
    description: 'Orduların muharebe etkinliğini artırır ve bakım giderlerini optimize eder.',
    effectLabel: '+%15 Ordu Gücü & -%10 Ordu Bakımı',
  },
  {
    id: 'ref_free_trade_zones',
    name: 'Özel Ekonomik Serbest Bölgeler',
    category: 'Ticaret',
    costGold: 1250,
    costResearch: 130,
    description: 'Vergi gelirini ve yurt içi pazar ticaretini artırır.',
    effectLabel: '+%20 Vergi Geliri · +%20 İç Pazar Ticareti',
  },
  {
    id: 'ref_national_defense_industry',
    name: 'Milli Savunma Sanayii Hamlesi',
    category: 'Savunma',
    costGold: 1650,
    costResearch: 160,
    description: 'Asker toplama maliyetini %20 azaltır.',
    effectLabel: '-%20 Asker Toplama Maliyeti',
  },
  {
    id: 'ref_welfare_state',
    name: 'Sosyal Refah ve Eğitim Reformu',
    category: 'Toplum',
    costGold: 1200,
    costResearch: 125,
    description: 'Yürürlüğe girdiğinde ulusal istikrarı 12 puan artırır ve günlük araştırmaya 5 puan ekler.',
    effectLabel: '+12 Ulusal İstikrar & +5 Araştırma/Gün',
  },
  {
    id: 'ref_imperial_diplomacy',
    name: 'Küresel Barış ve Arabuluculuk Misyonu',
    category: 'Diplomasi',
    costGold: 1100,
    costResearch: 115,
    description: 'Yürürlüğe girdiğinde agresif genişlemeyi 15 puan azaltır ve diğer ülkelerle ilişkiyi en çok 15 puan artırır.',
    effectLabel: 'Bir kez −15 AE · Diğer ülkelerle +15 ilişki',
  },
];
