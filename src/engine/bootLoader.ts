export type HardwareTier = 'HIGH' | 'BALANCED' | 'ECO';

export interface HardwareProfile {
  tier: HardwareTier;
  label: string;
  summary: string;
  logicalCores: number;
  deviceMemoryGb: number | null;
  dpr: number;
  /** Chunk size for progressive world & border warmup per animation frame */
  warmupChunkSize: number;
  /** Smooth fade-out transition duration after real warmup completes */
  fadeOutMs: number;
}

export interface BootStageDefinition {
  id: 'HARDWARE' | 'SAVES' | 'WORLD_MAP' | 'FLAGS_ATLAS' | 'MEDIA_AUDIO';
  title: string;
  detail: string;
  weight: number;
}

export const BOOT_STAGES: BootStageDefinition[] = [
  {
    id: 'HARDWARE',
    title: 'Cihaz Profili ve FPS Optimizasyonu',
    detail: 'İşlemci çekirdekleri, ekran yoğunluğu ve akıcı harita katmanları ayarlanıyor.',
    weight: 12,
  },
  {
    id: 'SAVES',
    title: 'Kayıt Arşivi ve Bütünlük Doğrulaması',
    detail: 'Sefer kayıtları, otomatik yedekler ve sürüm uyumluluğu kontrol ediliyor.',
    weight: 20,
  },
  {
    id: 'WORLD_MAP',
    title: '1440 & 2026 Kartografik Harita Hazırlığı',
    detail: 'Ülke dış sınırları, sancak çizgileri ve uzamsal dokunma indeksi örülüyor.',
    weight: 34,
  },
  {
    id: 'FLAGS_ATLAS',
    title: 'Devlet Sancakları ve Tipografi Önbelleği',
    detail: 'İmparatorluk bayrakları ve yakınlaştırma şehir etiketleri önbelleğe alınıyor.',
    weight: 18,
  },
  {
    id: 'MEDIA_AUDIO',
    title: 'Tarihi Görseller ve Ses Motoru',
    detail: 'Dönem tabloları, marşlar ve savaş efektleri sahneye hazırlanıyor.',
    weight: 16,
  },
];

export const STRATEGY_LOADING_TIPS: { title: string; body: string }[] = [
  {
    title: 'Bayrak Menüsü ile Anında Diplomasi',
    body: 'Sol üstteki kendi ülke bayrağına veya haritadan başka bir devlete dokunarak müttefikleri, düşmanları, savunma paktlarını ve ticaret anlaşmalarını tek ekranda görebilirsin.',
  },
  {
    title: 'Gerçekçi 5x Zaman Akışı',
    body: 'Zamanı 5x hızına aldığında bile dünya savaşlarını ve diplomasi bildirimlerini kaçırmaman için akış dengeli kalır; kritik anlarda Boşluk tuşuyla oyunu anında duraklatabilirsin.',
  },
  {
    title: 'Kısaltılmış Yazılar İçin Basılı Tut',
    body: 'Mobil veya iPhone ekranında sonu “…” ile kesilen bir isim veya buton görürsen parmağını yarım saniye basılı tutarak tam açıklamasını okuyabilirsin.',
  },
  {
    title: 'Boğazları Kontrol Eden Ticarete Hükmeder',
    body: 'İstanbul, Çanakkale, Cebelitarık ve Süveyş gibi stratejik geçitleri elinde tutmak hazineye düzenli gümrük geliri kazandırır.',
  },
  {
    title: 'İç İstikrar ve Asimilasyon',
    body: 'Yeni fethedilen sancaklarda huzursuzluk hızla yükselebilir. İsyan çıkmadan asimilasyon başlatmak ve yerel garnizon bırakmak cephe arkasını korur.',
  },
  {
    title: 'Agresif Genişlemeye Dikkat',
    body: 'Kısa sürede art arda çok fazla toprak ilhak edersen komşu büyük güçler sana karşı koalisyon kurabilir; fetihler arasında diplomasiyle ilişkileri yumuşat.',
  },
  {
    title: 'Savunma Paktı ile Caydırıcılık',
    body: 'Kendinden güçlü bir imparatorlukla sınır komşusuysan, bölgedeki diğer devletlerle savunma paktı imzalamak saldırı riskini ciddi biçimde azaltır.',
  },
  {
    title: 'Arazi ve Kale Savunması',
    body: 'Dağlık sancaklarda ve yüksek kale surlarına sahip şehirlerde savunan ordular önemli üstünlük kazanır; saldırı öncesi kuşatma desteği planla.',
  },
  {
    title: 'İnsan Gücü Hazineden Değerlidir',
    body: 'Altın kısa sürede birikebilir ancak tükenen insan gücü rezervleri uzun savaşlarda ordunu yenilemeni engeller; kayıpları düşük tutmaya çalış.',
  },
  {
    title: 'Çevrimdışı Güvenli Kayıt',
    body: 'Floda Strateji Oyunu tamamen çevrimdışı çalışır. Önemli bir savaştan önce manuel kayıt yuvasına kaydet; eski sürüm kayıtların otomatik olarak korunur.',
  },
  {
    title: 'Ekonomi Haritasıyla Zengin Sancakları Bul',
    body: 'Harita katmanlarından Ekonomi veya Diplomasi moduna geçerek hem en yüksek gelirli eyaletleri hem de düşman ittifak bloklarını bir bakışta analiz edebilirsin.',
  },
  {
    title: 'iPhone Yatay ve Dikey Konfor',
    body: 'Telefonunu yatay çevirdiğinde üst çubuk ve dünya bildirimleri haritayı kapatmayacak şekilde otomatik daralır; yakınlaştırınca şehir adları çakışmadan netleşir.',
  },
];

export function detectHardwareProfile(input?: {
  cores?: number;
  memoryGb?: number | null;
  dpr?: number;
}): HardwareProfile {
  const nav =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number })
      : null;

  const logicalCores = Math.max(
    1,
    Math.round(input?.cores ?? nav?.hardwareConcurrency ?? 4)
  );
  const rawMemory =
    input?.memoryGb !== undefined ? input.memoryGb : nav?.deviceMemory ?? null;
  const deviceMemoryGb =
    typeof rawMemory === 'number' && Number.isFinite(rawMemory) && rawMemory > 0
      ? rawMemory
      : null;
  const dpr = Math.max(
    1,
    Math.min(
      3,
      input?.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    )
  );

  // Classify purely from device capability so faster phones/PCs naturally warm up in larger chunks
  const highCores = logicalCores >= 8;
  const midCores = logicalCores >= 4;
  const highMem = deviceMemoryGb === null ? highCores : deviceMemoryGb >= 8;
  const lowMem = deviceMemoryGb !== null && deviceMemoryGb <= 2;

  if ((highCores && highMem) || (logicalCores >= 6 && (deviceMemoryGb ?? 0) >= 8)) {
    return {
      tier: 'HIGH',
      label: 'Yüksek Performans Profili',
      summary: `${logicalCores} çekirdek · Hızlı hazırlık ve 60 FPS akıcı katman`,
      logicalCores,
      deviceMemoryGb,
      dpr,
      warmupChunkSize: 140,
      fadeOutMs: 220,
    };
  }

  if (midCores && !lowMem) {
    return {
      tier: 'BALANCED',
      label: 'Dengeli Mobil Profil',
      summary: `${logicalCores} çekirdek · Optimize harita ve pil dostu önbellek`,
      logicalCores,
      deviceMemoryGb,
      dpr,
      warmupChunkSize: 80,
      fadeOutMs: 260,
    };
  }

  return {
    tier: 'ECO',
    label: 'Hafif Cihaz Profili',
    summary: `${logicalCores} çekirdek · Kademeli bellek korumalı yükleme`,
    logicalCores,
    deviceMemoryGb,
    dpr,
    warmupChunkSize: 40,
    fadeOutMs: 300,
  };
}

export function computeBootProgress(
  completedStageIds: ReadonlySet<BootStageDefinition['id']>,
  activeStageId?: BootStageDefinition['id'],
  activeStageFraction = 0
): number {
  const totalWeight = BOOT_STAGES.reduce((acc, s) => acc + s.weight, 0);
  if (totalWeight <= 0) return 100;

  let done = 0;
  for (const stage of BOOT_STAGES) {
    if (completedStageIds.has(stage.id)) {
      done += stage.weight;
    } else if (stage.id === activeStageId) {
      done += stage.weight * Math.max(0, Math.min(1, activeStageFraction));
    }
  }
  return Math.max(0, Math.min(100, Math.round((done / totalWeight) * 100)));
}
