import React, { useState } from 'react';
import { BookOpen, Compass, Keyboard, X } from 'lucide-react';
import { STRATEGY_LOADING_TIPS } from '../../engine/bootLoader';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';

interface StrategyTipsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONTROL_GUIDES = [
  {
    key: 'Harita Yakınlaştırma',
    detail:
      'Mobilde iki parmakla kıstırıp açın, masaüstünde fare tekerleğiyle 28x seviyesine kadar yakınlaşıp tüm şehir adlarını görün.',
  },
  {
    key: 'Ordu Yürütme',
    detail:
      'Kendi eyaletinize dokunup "Saldır / Sevk" ile komşu veya uzak hedefi seçin; ordular 60 FPS akıcı güzergâh izler.',
  },
  {
    key: 'Ülke Diplomasi Özeti',
    detail:
      'Üst soldaki kendi bayrağınıza veya haritada herhangi bir ülkeye basarak müttefiklerini, savaşlarını ve antlaşmalarını inceleyin.',
  },
  {
    key: 'Mobilde Uzun Basma (Detay)',
    detail:
      'Yarım kalan (…) yazılar veya bilgi etiketleri üzerinde parmağınızı yarım saniye basılı tutarak tam açıklamasını okuyun.',
  },
  {
    key: 'Boşluk / 1–4 Tuşları',
    detail:
      'Masaüstünde Boşluk tuşu oyunu duraklatır/devam ettirir; 1x–5x hız düğmeleri gerçekçi takip edilebilir tempoda akar.',
  },
  {
    key: 'Geri Dönüş Yedekli Kayıt',
    detail:
      'Aynı yuvaya yeniden kaydettiğinizde önceki kayıt otomatik yedeklenir; Oyun Yükle menüsünden tek tıkla geri dönebilirsiniz.',
  },
];

export const StrategyTipsModal: React.FC<StrategyTipsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'TIPS' | 'CONTROLS'>('TIPS');
  const dialogRef = useAccessibleDialog(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playClick();
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tips-modal-title"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-xl bg-[#191612] border border-[#c89d54]/45 shadow-2xl overflow-hidden text-[#f0e6d2]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-[#13110e] border-b border-[#c89d54]/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-[#c89d54] shrink-0" />
            <div className="min-w-0">
              <h2
                id="tips-modal-title"
                className="font-display text-base sm:text-lg font-bold text-[#f0e6d2] truncate"
              >
                İpuçları ve Strateji Rehberi
              </h2>
              <p className="text-[11px] text-[#b2a58f] truncate">
                Sefer sanatı, diplomasi dengesi ve temel kontroller
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            aria-label="Rehberi kapat"
            className="w-10 h-10 rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 text-[#cfc3ae] hover:text-[#f0e6d2] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-4 sm:px-5 pt-3 pb-2 bg-[#161310] border-b border-[#3a3228] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab('TIPS');
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'TIPS'
                ? 'bg-[#c89d54] text-[#110f0d] font-bold'
                : 'bg-[#231f1a] text-[#cfc3ae] border border-[#3d352a] hover:text-[#f0e6d2]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Strateji İpuçları ({STRATEGY_LOADING_TIPS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab('CONTROLS');
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'CONTROLS'
                ? 'bg-[#c89d54] text-[#110f0d] font-bold'
                : 'bg-[#231f1a] text-[#cfc3ae] border border-[#3d352a] hover:text-[#f0e6d2]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Kontroller ve Kısayollar</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {activeTab === 'TIPS' ? (
            STRATEGY_LOADING_TIPS.map((tip, idx) => (
              <article
                key={tip.title}
                className="p-3.5 rounded-lg bg-[#211d18] border border-[#3a3228] space-y-1"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#e0bc78]">
                  <span className="font-mono-num tabular-nums text-[#9e927d]">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <span>{tip.title}</span>
                </div>
                <p className="text-xs sm:text-[13px] text-[#d6cbb8] leading-relaxed">
                  {tip.body}
                </p>
              </article>
            ))
          ) : (
            CONTROL_GUIDES.map((item) => (
              <article
                key={item.key}
                className="p-3.5 rounded-lg bg-[#211d18] border border-[#3a3228] space-y-1"
              >
                <div className="text-xs font-bold text-[#e0bc78]">
                  {item.key}
                </div>
                <p className="text-xs sm:text-[13px] text-[#d6cbb8] leading-relaxed">
                  {item.detail}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
