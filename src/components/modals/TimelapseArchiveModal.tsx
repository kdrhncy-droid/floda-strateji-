import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Calendar,
  Check,
  Download,
  Film,
  Globe,
  Pencil,
  Play,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CampaignTimelapse,
  TimelapseArchiveMetadata,
  TimelapseArchiveRecord,
} from '../../types/game';
import {
  deleteTimelapseArchive,
  exportTimelapseArchiveToJson,
  importTimelapseArchiveFromJson,
  listTimelapseArchives,
  loadTimelapseArchive,
  renameTimelapseArchive,
  saveTimelapseToArchive,
} from '../../engine/timelapseArchive';
import {
  listAllSaveSlots,
  loadGameFromSlot,
  SAVE_SLOT_DEFINITIONS,
  SaveSlotId,
} from '../../engine/saveManager';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';

interface TimelapseArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayTimelapse: (timelapse: CampaignTimelapse, title?: string) => void;
  currentCampaignTimelapse?: CampaignTimelapse | null;
  currentCampaignHasLiveSession?: boolean;
  onShowToast?: (msg: string) => void;
}

export const TimelapseArchiveModal: React.FC<TimelapseArchiveModalProps> = ({
  isOpen,
  onClose,
  onPlayTimelapse,
  currentCampaignTimelapse = null,
  currentCampaignHasLiveSession = false,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [archives, setArchives] = useState<TimelapseArchiveMetadata[]>(() =>
    listTimelapseArchives()
  );
  const [customTitle, setCustomTitle] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useAccessibleDialog(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setArchives(listTimelapseArchives());
      setEditingId(null);
      setConfirmDeleteId(null);
      setNotice(null);
      if (currentCampaignTimelapse) {
        const startY =
          currentCampaignTimelapse.frames[0]?.year ??
          currentCampaignTimelapse.startYear;
        const endY =
          currentCampaignTimelapse.frames[
            currentCampaignTimelapse.frames.length - 1
          ]?.year ?? currentCampaignTimelapse.lastRecordedYear;
        const cleanName = cleanNationName(
          currentCampaignTimelapse.playerNationName
        );
        setCustomTitle(
          startY === endY
            ? `${cleanName} Seferi (${startY})`
            : `${cleanName} (${startY}–${endY})`
        );
      } else {
        setCustomTitle('');
      }
    }
  }, [isOpen, currentCampaignTimelapse]);

  const slotTimelapses = useMemo(() => {
    if (!isOpen) return [];
    const slotMetas = listAllSaveSlots();
    const entries: {
      slotId: SaveSlotId;
      slotTitle: string;
      nationName: string;
      playerNationId: string;
      flagCode: string;
      nationColor: string;
      dateStr: string;
      timelapse: CampaignTimelapse;
    }[] = [];
    for (const def of SAVE_SLOT_DEFINITIONS) {
      if (!slotMetas[def.id]) continue;
      const rec = loadGameFromSlot(def.id);
      if (!rec?.payload?.timelapse) continue;
      entries.push({
        slotId: def.id,
        slotTitle: def.title,
        nationName: cleanNationName(rec.metadata.nationName),
        playerNationId: rec.metadata.playerNationId,
        flagCode: rec.metadata.flagCode,
        nationColor: rec.metadata.nationColor,
        dateStr: rec.metadata.gameDateStr,
        timelapse: rec.payload.timelapse,
      });
    }
    return entries;
  }, [isOpen, archives.length]);

  if (!isOpen) return null;

  const refreshArchives = () => setArchives(listTimelapseArchives());

  const handleSaveCurrentCampaign = () => {
    if (!currentCampaignTimelapse) return;
    sound.playTreaty();
    const rec = saveTimelapseToArchive(currentCampaignTimelapse, {
      title: customTitle.trim() || undefined,
      sourceLabel: 'Aktif Sefer',
    });
    if (rec) {
      refreshArchives();
      const msg = `"${rec.metadata.title}" çevrimdışı arşive kaydedildi.`;
      setNotice(msg);
      onShowToast?.(msg);
    } else {
      setNotice('Aktif sefer kaydı arşivlenemedi.');
    }
  };

  const handleSaveSlotToArchive = (
    slotTitle: string,
    nationName: string,
    tl: CampaignTimelapse
  ) => {
    sound.playTreaty();
    const startY = tl.frames[0]?.year ?? tl.startYear;
    const endY = tl.frames[tl.frames.length - 1]?.year ?? tl.lastRecordedYear;
    const label =
      startY === endY
        ? `${nationName} (${startY})`
        : `${nationName} (${startY}–${endY})`;
    const rec = saveTimelapseToArchive(tl, {
      title: label,
      sourceLabel: slotTitle,
    });
    if (rec) {
      refreshArchives();
      const msg = `"${rec.metadata.title}" arşive kalıcı olarak kaydedildi.`;
      setNotice(msg);
      onShowToast?.(msg);
    }
  };

  const handlePlayArchive = (meta: TimelapseArchiveMetadata) => {
    const rec = loadTimelapseArchive(meta.id);
    if (!rec) {
      setNotice('Bu timelapse kaydının verisi bulunamadı.');
      return;
    }
    sound.playWarHorn();
    onClose();
    onPlayTimelapse(rec.timelapse, rec.metadata.title);
  };

  const handleCommitRename = (id: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) return;
    sound.playClick();
    const updated = renameTimelapseArchive(id, trimmed);
    if (updated) {
      refreshArchives();
      setEditingId(null);
      setNotice(`Kayıt adı "${updated.title}" olarak güncellendi.`);
    }
  };

  const handleExportArchive = (meta: TimelapseArchiveMetadata) => {
    const rec: TimelapseArchiveRecord | null = loadTimelapseArchive(meta.id);
    if (!rec) return;
    sound.playClick();
    exportTimelapseArchiveToJson(rec);
    const msg = `"${meta.title}" (.json) dosyası indirildi.`;
    setNotice(msg);
    onShowToast?.(msg);
  };

  const handleDeleteArchive = (meta: TimelapseArchiveMetadata) => {
    if (confirmDeleteId !== meta.id) {
      sound.playClick();
      setConfirmDeleteId(meta.id);
      return;
    }
    sound.playClick();
    deleteTimelapseArchive(meta.id);
    setConfirmDeleteId(null);
    refreshArchives();
    setNotice(`"${meta.title}" arşivden silindi.`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importTimelapseArchiveFromJson(String(reader.result || ''));
      if (imported) {
        sound.playTreaty();
        refreshArchives();
        const msg = `"${imported.metadata.title}" çevrimdışı arşive eklendi.`;
        setNotice(msg);
        onShowToast?.(msg);
      } else {
        setNotice(
          'Geçersiz dosya. Yalnızca Floda Timelapse veya zaman çizelgesi içeren kayıt (.json) dosyaları içe aktarılabilir.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm"
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
        aria-labelledby="floda-timelapse-archive-title"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[90dvh] bg-[#191612] border border-[#c89d54]/45 rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#f0e6d2]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#c89d54]/30 bg-[#13110e] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#231d15] border border-[#c89d54]/45 flex items-center justify-center text-[#e0bc78] shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="floda-timelapse-archive-title"
                className="font-display text-base sm:text-lg font-bold text-[#f0e6d2] truncate"
              >
                Sefer Zaman Çizelgesi Arşivi
              </h2>
              <p className="text-xs text-[#b2a58f] truncate">
                Çevrimdışı IndexedDB arşivi · Kaydet, adlandır, sil ve haritada tekrar izle
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Timelapse arşivini kapat"
            className="min-w-[44px] min-h-[44px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 flex items-center justify-center text-[#cfc3ae] hover:text-[#f0e6d2] shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Toolbar: Offline note + JSON Import */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-[#cfc3ae]">
              <Globe className="w-4 h-4 text-[#6eb887] shrink-0" />
              <span>İnternetsiz (PWA) cihaz belleğinde saklanır · .JSON paylaşılabilir</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              data-testid="timelapse-import-btn"
              onClick={() => fileInputRef.current?.click()}
              className="aoh3-menu-btn min-h-[42px] px-3.5 py-2 rounded-lg text-[#e0bc78] text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>.JSON İçe Aktar</span>
            </button>
          </div>

          {notice && (
            <div
              role="status"
              className="p-3 rounded-lg bg-[#c89d54]/14 border border-[#c89d54]/40 text-xs text-[#f0e6d2]"
            >
              {notice}
            </div>
          )}

          {/* Active Campaign Save & Watch Card */}
          {currentCampaignHasLiveSession && currentCampaignTimelapse && (
            <section
              aria-label="Aktif sefer zaman çizelgesi"
              className="rounded-xl border border-[#c89d54]/45 bg-[#15120e] p-3.5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#e0bc78]">
                  Aktif Sefer Kaydı ·{' '}
                  <span className="text-[#f0e6d2]">
                    {cleanNationName(currentCampaignTimelapse.playerNationName)}
                  </span>
                </div>
                <div className="text-[11px] font-mono-num text-[#b2a58f]">
                  {currentCampaignTimelapse.frames.length} Yıl/Kare ·{' '}
                  {currentCampaignTimelapse.milestones.length} Tarihî Olay
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <label className="sr-only" htmlFor="timelapse-custom-title-input">
                  Arşiv kaydı adı
                </label>
                <input
                  id="timelapse-custom-title-input"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Sefer arşivi adı (ör. Büyük Osmanlı Yükselişi)..."
                  className="flex-1 min-h-[42px] px-3 rounded-lg bg-[#100e0c] border border-[#3a3228] focus:border-[#c89d54] text-xs text-[#f0e6d2] placeholder:text-[#7f7463] focus:outline-none"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="timelapse-watch-current-btn"
                    onClick={() => {
                      sound.playWarHorn();
                      onClose();
                      onPlayTimelapse(
                        currentCampaignTimelapse,
                        customTitle.trim() || undefined
                      );
                    }}
                    className="aoh3-menu-btn-primary min-h-[42px] px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>İzle</span>
                  </button>

                  <button
                    type="button"
                    data-testid="timelapse-save-current-btn"
                    onClick={handleSaveCurrentCampaign}
                    className="aoh3-menu-btn min-h-[42px] px-3.5 py-2 rounded-lg text-[#e0bc78] font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <BookmarkPlus className="w-4 h-4 shrink-0" />
                    <span>Arşive Kaydet</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Saved Offline Archives List */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#e0bc78]">
                Kalıcı Arşivler ({archives.length})
              </h3>
            </div>

            {archives.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#3a3228] bg-[#14110e]/60 p-5 text-center space-y-1.5">
                <p className="text-xs font-semibold text-[#d6cbb8]">
                  Henüz arşive sabitlenmiş bir sefer zaman çizelgesi yok.
                </p>
                <p className="text-[11px] text-[#8d816f]">
                  {currentCampaignHasLiveSession
                    ? 'Yukarıdaki "Arşive Kaydet" butonuyla mevcut seferinizi kalıcı olarak saklayabilirsiniz.'
                    : 'Bir sefer oynayıp kaydettiğinizde veya aşağıdaki kayıt yuvalarından "Sabitle" seçtiğinizde burada listelenir.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {archives.map((meta) => {
                  const isEditing = editingId === meta.id;
                  const isConfirmingDelete = confirmDeleteId === meta.id;
                  const yearSpan =
                    meta.startYear === meta.endYear
                      ? `${meta.startYear}`
                      : `${meta.startYear} → ${meta.endYear}`;

                  return (
                    <div
                      key={meta.id}
                      data-testid={`timelapse-archive-item-${meta.id}`}
                      className="rounded-xl border border-[#3a3228] bg-[#14110e] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <NationFlagCanvasBadge
                          nationId={meta.playerNationId}
                          flagCode={meta.flagCode}
                          color={meta.nationColor}
                          width={44}
                          height={30}
                        />

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitRename(meta.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                aria-label={`Yeni ad: ${meta.title}`}
                                maxLength={80}
                                autoFocus
                                className="flex-1 min-w-0 min-h-[36px] px-2.5 rounded-lg bg-[#100e0c] border border-[#c89d54] text-xs text-[#f0e6d2] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleCommitRename(meta.id)}
                                aria-label="Yeni adı kaydet"
                                className="min-w-[36px] min-h-[36px] rounded-lg bg-[#c89d54] text-[#110f0d] flex items-center justify-center cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                aria-label="Adlandırmayı iptal et"
                                className="min-w-[36px] min-h-[36px] rounded-lg bg-[#231f1a] text-[#cfc3ae] flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-[#f0e6d2] truncate">
                                {meta.title}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#231f1a] border border-[#3a3228] text-[#e0bc78]">
                                {meta.gameMode === 'EMPIRES_1440' ? '1440' : '2026'}
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#cfc3ae] mt-1">
                            <span className="flex items-center gap-1 font-mono-num tabular-nums text-[#7ab3cf]">
                              <Calendar className="w-3 h-3" />
                              {yearSpan}
                            </span>
                            <span className="font-mono-num tabular-nums text-[#6eb887]">
                              {meta.finalProvinceCount} Eyalet
                            </span>
                            <span className="font-mono-num tabular-nums text-[#b2a58f]">
                              {meta.frameCount} Kare · {meta.milestoneCount} Olay
                            </span>
                            <span className="text-[#8d816f]">{meta.savedAtDisplay}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handlePlayArchive(meta)}
                          aria-label={`${meta.title} timelapse izle`}
                          className="aoh3-menu-btn-primary min-h-[40px] px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>İzle</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setEditingId(meta.id);
                            setEditingTitle(meta.title);
                            setConfirmDeleteId(null);
                          }}
                          aria-label={`${meta.title} kaydını adlandır`}
                          title="Yeniden Adlandır"
                          className="min-w-[40px] min-h-[40px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#3a3228] flex items-center justify-center text-[#e0bc78] cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportArchive(meta)}
                          aria-label={`${meta.title} JSON dışa aktar`}
                          title=".JSON İndir"
                          className="min-w-[40px] min-h-[40px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#3a3228] flex items-center justify-center text-[#7ab3cf] cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteArchive(meta)}
                          aria-label={
                            isConfirmingDelete
                              ? `${meta.title} silmeyi onayla`
                              : `${meta.title} kaydını sil`
                          }
                          title={isConfirmingDelete ? 'Silmek için tekrar basın' : 'Sil'}
                          className={`min-h-[40px] px-2.5 rounded-lg border flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer ${
                            isConfirmingDelete
                              ? 'bg-[#6b2020] border-[#d25d5d] text-[#ffdede]'
                              : 'bg-[#231f1a] hover:bg-[#421e1e] border-[#3a3228] hover:border-[#982f2f] text-[#a89b86] hover:text-[#e89999]'
                          }`}
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          {isConfirmingDelete && <span>Sil?</span>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Auto-Embedded Save Slot Timelapses */}
          {slotTimelapses.length > 0 && (
            <section className="space-y-2.5 pt-1 border-t border-[#3a3228]/70">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#b2a58f]">
                Kayıt Yuvalarındaki Seferler ({slotTimelapses.length})
              </h3>
              <div className="space-y-2">
                {slotTimelapses.map((slot) => (
                  <div
                    key={slot.slotId}
                    className="rounded-xl border border-[#2d2720] bg-[#14110e]/85 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <NationFlagCanvasBadge
                        nationId={slot.playerNationId}
                        flagCode={slot.flagCode}
                        color={slot.nationColor}
                        width={40}
                        height={28}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#f0e6d2] truncate">
                          {slot.slotTitle} · {slot.nationName}
                        </div>
                        <div className="text-[11px] text-[#9e927d] font-mono-num">
                          {slot.dateStr} · {slot.timelapse.frames.length} Kare ·{' '}
                          {slot.timelapse.milestones.length} Olay
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playWarHorn();
                          onClose();
                          onPlayTimelapse(
                            slot.timelapse,
                            `${slot.nationName} (${slot.slotTitle})`
                          );
                        }}
                        className="aoh3-menu-btn-primary min-h-[38px] px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>İzle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveSlotToArchive(
                            slot.slotTitle,
                            slot.nationName,
                            slot.timelapse
                          )
                        }
                        className="aoh3-menu-btn min-h-[38px] px-3 py-1.5 rounded-lg text-[#e0bc78] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>Sabitle</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
