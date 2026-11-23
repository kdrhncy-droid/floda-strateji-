import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Mail,
  MessageSquareWarning,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildFeedbackDiagnostics,
  buildFeedbackMailtoHref,
  deleteFeedbackDraft,
  FEEDBACK_CATEGORIES,
  FeedbackCategory,
  FeedbackDraft,
  formatFeedbackReport,
  loadFeedbackDrafts,
  saveFeedbackDraft,
  validateFeedbackInput,
} from '../../engine/feedbackStorage';
import { detectHardwareProfile } from '../../engine/bootLoader';
import { SAVE_SCHEMA_VERSION } from '../../engine/saveManager';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeScenarioName: string;
  uiScale: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  activeScenarioName,
  uiScale,
}) => {
  const [category, setCategory] = useState<FeedbackCategory>('SUGGESTION');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [editingDraftId, setEditingDraftId] = useState<string | undefined>(
    undefined
  );
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [drafts, setDrafts] = useState<FeedbackDraft[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dialogRef = useAccessibleDialog(isOpen, onClose);
  const hardwareTier = useMemo(() => detectHardwareProfile().label, []);

  useEffect(() => {
    if (isOpen) {
      setDrafts(loadFeedbackDrafts());
      setErrorMsg(null);
      setStatusMsg(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCategory =
    FEEDBACK_CATEGORIES.find((c) => c.id === category) || FEEDBACK_CATEGORIES[0];

  const getDiagnostics = () =>
    buildFeedbackDiagnostics({
      activeScenario: activeScenarioName,
      uiScale,
      hardwareTier,
      schemaVersion: SAVE_SCHEMA_VERSION,
    });

  const handleSaveDraft = () => {
    const check = validateFeedbackInput(subject, message);
    if (!check.valid) {
      setErrorMsg(check.error);
      setStatusMsg(null);
      return;
    }
    sound.playTreaty();
    const updated = saveFeedbackDraft({
      id: editingDraftId,
      category,
      subject,
      message,
      includeDiagnostics,
    });
    setDrafts(updated);
    setEditingDraftId(updated[0]?.id);
    setErrorMsg(null);
    setStatusMsg('Taslak cihazına çevrimdışı olarak kaydedildi.');
  };

  const handleCopyReport = async () => {
    const check = validateFeedbackInput(subject, message);
    if (!check.valid) {
      setErrorMsg(check.error);
      setStatusMsg(null);
      return;
    }
    const text = formatFeedbackReport(
      { category, subject, message, includeDiagnostics },
      includeDiagnostics ? getDiagnostics() : null
    );
    try {
      await navigator.clipboard.writeText(text);
      sound.playClick();
      setCopied(true);
      setErrorMsg(null);
      setStatusMsg('Geri bildirim metni panoya kopyalandı; istediğin yere yapıştırıp gönderebilirsin.');
      setTimeout(() => setCopied(false), 2600);
    } catch {
      setErrorMsg('Pano izni alınamadı; lütfen taslağı kaydedip e-posta seçeneğini kullan.');
    }
  };

  const handleSendEmail = () => {
    const check = validateFeedbackInput(subject, message);
    if (!check.valid) {
      setErrorMsg(check.error);
      setStatusMsg(null);
      return;
    }
    sound.playClick();
    // Auto-save a local draft copy so the user never loses what they wrote
    const updated = saveFeedbackDraft({
      id: editingDraftId,
      category,
      subject,
      message,
      includeDiagnostics,
    });
    setDrafts(updated);
    setEditingDraftId(updated[0]?.id);
    setErrorMsg(null);
    setStatusMsg('E-posta uygulaman hazırlanıyor (taslak yedeğin cihazına kaydedildi).');

    const href = buildFeedbackMailtoHref(
      { category, subject, message, includeDiagnostics },
      includeDiagnostics ? getDiagnostics() : null
    );
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLoadDraft = (draft: FeedbackDraft) => {
    sound.playClick();
    setEditingDraftId(draft.id);
    setCategory(draft.category);
    setSubject(draft.subject);
    setMessage(draft.message);
    setIncludeDiagnostics(draft.includeDiagnostics);
    setErrorMsg(null);
    setStatusMsg('Kayıtlı taslak düzenleme için yüklendi.');
  };

  const handleDeleteDraft = (id: string) => {
    sound.playClick();
    const updated = deleteFeedbackDraft(id);
    setDrafts(updated);
    if (editingDraftId === id) {
      setEditingDraftId(undefined);
    }
    setStatusMsg('Taslak silindi.');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="floda-feedback-title"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[90dvh] bg-[#191612] border border-[#c89d54]/45 rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#f0e6d2]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#c89d54]/30 bg-[#13110e] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#c89d54]/15 border border-[#c89d54]/40 flex items-center justify-center text-[#e0bc78] shrink-0">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="floda-feedback-title"
                className="font-display text-base sm:text-lg font-bold text-[#f0e6d2] truncate"
              >
                Geliştirme Önerisi ve Şikayet
              </h2>
              <p className="text-xs text-[#b2a58f]">
                Çevrimdışı taslak kaydet, metni tek tıkla kopyala veya e-posta ile gönder
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Geri bildirim penceresini kapat"
            className="min-w-[44px] min-h-[44px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 flex items-center justify-center text-[#cfc3ae] hover:text-[#f0e6d2] shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Category Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#e0bc78]">
              Kategori Seçimi
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_CATEGORIES.map((cat) => {
                const active = cat.id === category;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      sound.playClick();
                      setCategory(cat.id);
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78] font-bold'
                        : 'bg-[#211d18] text-[#cfc3ae] border-[#3a3228] hover:border-[#7a5e2f] hover:text-[#f0e6d2]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label
              htmlFor="floda-feedback-subject"
              className="block text-xs font-semibold text-[#e0bc78]"
            >
              Konu Başlığı
            </label>
            <input
              id="floda-feedback-subject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Örn: 1440 Osmanlı diplomasi önerisi veya iPhone yatay ekran geri bildirimi"
              className="w-full h-11 px-3.5 rounded-lg bg-[#14110e] border border-[#3a3228] text-sm text-[#f0e6d2] placeholder:text-[#7f7463] focus:outline-none focus:border-[#c89d54]"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label
              htmlFor="floda-feedback-message"
              className="block text-xs font-semibold text-[#e0bc78]"
            >
              Ayrıntılı Açıklama
            </label>
            <textarea
              id="floda-feedback-message"
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={currentCategory.placeholder}
              className="w-full p-3.5 rounded-lg bg-[#14110e] border border-[#3a3228] text-sm text-[#f0e6d2] placeholder:text-[#7f7463] focus:outline-none focus:border-[#c89d54] resize-y min-h-[104px]"
            />
          </div>

          {/* Diagnostics Toggle */}
          <label className="flex items-start gap-2.5 text-xs text-[#cfc3ae] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDiagnostics}
              onChange={(e) => setIncludeDiagnostics(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#c89d54] rounded"
            />
            <span>
              Sorun çözümünü kolaylaştırmak için anonim cihaz/ekran bilgisini (ekran ölçüsü, senaryo, arayüz ölçeği) rapora ekle
            </span>
          </label>

          {/* Validation / Status Notice */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#421e1e]/80 border border-[#982f2f] text-xs font-medium text-[#f2c2c2]"
            >
              {errorMsg}
            </div>
          )}
          {statusMsg && !errorMsg && (
            <div
              role="status"
              className="p-3 rounded-lg bg-[#1f3628]/80 border border-[#45825c] text-xs font-medium text-[#c5ead2]"
            >
              {statusMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="aoh3-menu-btn min-h-[44px] px-4 py-2 rounded-lg text-[#e0bc78] font-semibold text-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>Taslak Kaydet</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="aoh3-menu-btn min-h-[44px] px-4 py-2 rounded-lg text-[#f0e6d2] font-semibold text-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 text-[#6eb887] shrink-0" />
              ) : (
                <Copy className="w-4 h-4 shrink-0" />
              )}
              <span>{copied ? 'Kopyalandı' : 'Metni Kopyala'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendEmail}
              className="aoh3-menu-btn-primary min-h-[44px] px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span>E-Posta ile Gönder</span>
            </button>
          </div>

          {/* Saved Offline Drafts List */}
          <div className="pt-3 border-t border-[#3a3228] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#cfc3ae] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#c89d54]" />
                <span>Cihazda Kayıtlı Taslaklar ({drafts.length})</span>
              </span>
              {editingDraftId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDraftId(undefined);
                    setSubject('');
                    setMessage('');
                    setStatusMsg(null);
                  }}
                  className="text-[#e0bc78] hover:text-[#f5ecd9] font-semibold cursor-pointer"
                >
                  Yeni Boş Taslak
                </button>
              )}
            </div>

            {drafts.length === 0 ? (
              <p className="text-xs text-[#8d816f]">
                Henüz kayıtlı taslak yok. İnternetin kapalıyken notlarını taslak olarak kaydedip daha sonra kopyalayabilir veya e-posta ile gönderebilirsin.
              </p>
            ) : (
              <div className="space-y-2">
                {drafts.map((draft) => {
                  const catName =
                    FEEDBACK_CATEGORIES.find((c) => c.id === draft.category)
                      ?.label || 'Öneri';
                  return (
                    <div
                      key={draft.id}
                      className="p-3 rounded-lg bg-[#14110e] border border-[#3a3228] flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(draft)}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="text-xs font-bold text-[#f0e6d2] truncate">
                          {draft.subject}
                        </div>
                        <div className="text-[11px] text-[#a89b86] mt-0.5 truncate">
                          {catName} · {draft.message}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(draft.id)}
                        aria-label={`"${draft.subject}" taslağını sil`}
                        className="min-w-[40px] min-h-[40px] rounded-lg bg-[#231f1a] hover:bg-[#421e1e] border border-[#3a3228] hover:border-[#982f2f] flex items-center justify-center text-[#a89b86] hover:text-[#e89999] shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
