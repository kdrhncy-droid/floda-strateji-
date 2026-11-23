export type FeedbackCategory =
  | 'BUG'
  | 'SUGGESTION'
  | 'BALANCE'
  | 'VISUAL'
  | 'MOBILE_HUD';

export interface FeedbackCategoryInfo {
  id: FeedbackCategory;
  label: string;
  placeholder: string;
}

export interface FeedbackDraft {
  id: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  includeDiagnostics: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface FeedbackDiagnostics {
  appName: string;
  schemaVersion: number;
  viewport: string;
  orientation: 'Yatay' | 'Dikey';
  activeScenario: string;
  uiScale: string;
  hardwareTier: string;
  timestampDisplay: string;
}

export const FEEDBACK_STORAGE_KEY = 'FLODA_FEEDBACK_DRAFTS_V1';
export const FEEDBACK_RECIPIENT_EMAIL = 'floda.destek@example.com';

export const FEEDBACK_CATEGORIES: FeedbackCategoryInfo[] = [
  {
    id: 'SUGGESTION',
    label: 'Geliştirme Önerisi',
    placeholder: 'Oyuna eklenmesini istediğin mekanik, diplomasi veya senaryo fikrini yaz...',
  },
  {
    id: 'BUG',
    label: 'Hata / Şikayet',
    placeholder: 'Karşılaştığın sorunu, hangi ekranda ve hangi adımda oluştuğunu kısaca anlat...',
  },
  {
    id: 'BALANCE',
    label: 'Denge & Yapay Zekâ',
    placeholder: 'Ülke gücü, savaş dengesi, ekonomi veya yapay zekâ kararlarıyla ilgili gözlemini yaz...',
  },
  {
    id: 'VISUAL',
    label: 'Harita & Görsel',
    placeholder: 'Sınırlar, şehir isimleri, bayraklar, renkler veya animasyonlarla ilgili geri bildirimini yaz...',
  },
  {
    id: 'MOBILE_HUD',
    label: 'Mobil / iPhone HUD',
    placeholder: 'Telefon dikey/yatay ekranındaki buton yerleşimi, okunabilirlik veya dokunma deneyimini yaz...',
  },
];

export function validateFeedbackInput(
  subject: string,
  message: string
): { valid: boolean; error: string | null } {
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  if (cleanSubject.length < 3) {
    return {
      valid: false,
      error: 'Lütfen en az 3 karakterlik kısa bir başlık yaz.',
    };
  }
  if (cleanMessage.length < 10) {
    return {
      valid: false,
      error: 'Lütfen önerini veya şikayetini en az 10 karakter olacak şekilde açıkla.',
    };
  }
  return { valid: true, error: null };
}

export function buildFeedbackDiagnostics(params: {
  viewportWidth?: number;
  viewportHeight?: number;
  activeScenario: string;
  uiScale: string;
  hardwareTier: string;
  schemaVersion: number;
}): FeedbackDiagnostics {
  const w =
    params.viewportWidth ??
    (typeof window !== 'undefined' ? Math.round(window.innerWidth) : 1280);
  const h =
    params.viewportHeight ??
    (typeof window !== 'undefined' ? Math.round(window.innerHeight) : 800);

  return {
    appName: 'Floda Strateji Oyunu',
    schemaVersion: params.schemaVersion,
    viewport: `${w}×${h}`,
    orientation: w >= h ? 'Yatay' : 'Dikey',
    activeScenario: params.activeScenario,
    uiScale: params.uiScale,
    hardwareTier: params.hardwareTier,
    timestampDisplay: new Date().toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function formatFeedbackReport(
  draft: Pick<FeedbackDraft, 'category' | 'subject' | 'message' | 'includeDiagnostics'>,
  diagnostics?: FeedbackDiagnostics | null
): string {
  const catLabel =
    FEEDBACK_CATEGORIES.find((c) => c.id === draft.category)?.label ??
    'Geri Bildirim';

  const lines: string[] = [
    `Floda Strateji Oyunu — ${catLabel}`,
    `Konu: ${draft.subject.trim()}`,
    '',
    draft.message.trim(),
  ];

  if (draft.includeDiagnostics && diagnostics) {
    lines.push(
      '',
      '--- Cihaz ve Oturum Bilgisi ---',
      `Ekran: ${diagnostics.viewport} (${diagnostics.orientation})`,
      `Senaryo: ${diagnostics.activeScenario} | Arayüz Ölçeği: ${diagnostics.uiScale}`,
      `Donanım Profili: ${diagnostics.hardwareTier} | Kayıt Şeması: v${diagnostics.schemaVersion}`,
      `Tarih: ${diagnostics.timestampDisplay}`
    );
  }

  return lines.join('\n');
}

export function buildFeedbackMailtoHref(
  draft: Pick<FeedbackDraft, 'category' | 'subject' | 'message' | 'includeDiagnostics'>,
  diagnostics?: FeedbackDiagnostics | null,
  recipientEmail: string = FEEDBACK_RECIPIENT_EMAIL
): string {
  const catLabel =
    FEEDBACK_CATEGORIES.find((c) => c.id === draft.category)?.label ??
    'Geri Bildirim';
  const mailSubject = `[Floda Strateji - ${catLabel}] ${draft.subject.trim()}`;
  const body = formatFeedbackReport(draft, diagnostics);
  return `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
    mailSubject
  )}&body=${encodeURIComponent(body)}`;
}

export function loadFeedbackDrafts(): FeedbackDraft[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FeedbackDraft =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.subject === 'string' &&
        typeof item.message === 'string'
    );
  } catch {
    return [];
  }
}

export function saveFeedbackDraft(
  draft: Omit<FeedbackDraft, 'id' | 'createdAtIso' | 'updatedAtIso'> & {
    id?: string;
  }
): FeedbackDraft[] {
  const existing = loadFeedbackDrafts();
  const nowIso = new Date().toISOString();
  const id = draft.id || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const existingIdx = existing.findIndex((d) => d.id === id);
  const nextDraft: FeedbackDraft = {
    id,
    category: draft.category,
    subject: draft.subject.trim(),
    message: draft.message.trim(),
    includeDiagnostics: draft.includeDiagnostics,
    createdAtIso: existingIdx >= 0 ? existing[existingIdx].createdAtIso : nowIso,
    updatedAtIso: nowIso,
  };

  const nextList =
    existingIdx >= 0
      ? [nextDraft, ...existing.filter((d) => d.id !== id)]
      : [nextDraft, ...existing];

  const bounded = nextList.slice(0, 20);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(bounded));
    } catch {
      // ignore quota errors
    }
  }
  return bounded;
}

export function deleteFeedbackDraft(id: string): FeedbackDraft[] {
  const nextList = loadFeedbackDrafts().filter((d) => d.id !== id);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // ignore
    }
  }
  return nextList;
}
