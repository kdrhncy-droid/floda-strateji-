import React, { useRef, useState } from 'react';
import {
  X,
  Save,
  Upload,
  Download,
  Trash2,
  Play,
  Square,
  Volume2,
  VolumeX,
  Globe,
  Coins,
  Calendar,
  CheckCircle2,
  Settings,
  History,
  Music,
} from 'lucide-react';
import {
  deleteSaveSlot,
  exportSaveRecordToJson,
  getRollbackBackupMetadata,
  hasRollbackBackup,
  importSaveRecordFromJson,
  listAllSaveSlots,
  loadGameFromSlot,
  restoreRollbackBackup,
  SAVE_SLOT_DEFINITIONS,
  SaveSlotId,
  SaveSlotMetadata,
  SaveSlotRecord,
} from '../engine/saveManager';
import { GameSettings } from '../engine/gameSettings';
import { music, MUSIC_TRACKS } from '../engine/musicEngine';
import { PWAInstallButton } from './PWAInstallButton';
import { CategorizedSettingsPanel } from './modals/CategorizedSettingsPanel';
import { NationFlagCanvasBadge } from '../map/nationFlagRenderer';
import { cleanNationName } from '../utils/formatters';
import { sound } from '../utils/soundEngine';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

interface SystemAndSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onReturnToTitleMenu: () => void;
  onSaveToSlot: (slotId: SaveSlotId) => SaveSlotMetadata | null;
  onLoadRecord: (record: SaveSlotRecord) => void;
  onShowToast: (msg: string) => void;
}

export const SystemAndSaveModal: React.FC<SystemAndSaveModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  soundEnabled,
  onToggleSound,
  onReturnToTitleMenu,
  onSaveToSlot,
  onLoadRecord,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mp3InputRef = useRef<HTMLInputElement | null>(null);
  const [modalTab, setModalTab] = useState<'SETTINGS' | 'SAVES'>('SETTINGS');
  const [, setMusicTick] = useState(0);
  const [slots, setSlots] = useState<Record<SaveSlotId, SaveSlotMetadata | null>>(
    () => listAllSaveSlots()
  );
  const dialogRef = useAccessibleDialog(isOpen, onClose);

  if (!isOpen) return null;

  const refreshSlots = () => {
    setSlots(listAllSaveSlots());
  };

  const handleSaveClick = (slotId: SaveSlotId) => {
    sound.playTreaty();
    const meta = onSaveToSlot(slotId);
    refreshSlots();
    if (meta) {
      onShowToast(`${meta.label} başarıyla kaydedildi.`);
    }
  };

  const handleLoadClick = (slotId: SaveSlotId) => {
    const rec = loadGameFromSlot(slotId);
    if (!rec) {
      onShowToast('Bu kayıt yuvası boş.');
      return;
    }
    sound.playWarHorn();
    onLoadRecord(rec);
    onClose();
  };

  const handleExportClick = (slotId: SaveSlotId) => {
    const rec = loadGameFromSlot(slotId);
    if (!rec) {
      onShowToast('İndirilecek kayıt bulunamadı.');
      return;
    }
    sound.playClick();
    exportSaveRecordToJson(rec);
    onShowToast(`${rec.metadata.nationName} kaydı (.json) cihazınıza indirildi.`);
  };

  const handleDeleteClick = (slotId: SaveSlotId) => {
    sound.playClick();
    deleteSaveSlot(slotId);
    refreshSlots();
    onShowToast('Kayıt yuvası temizlendi.');
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const imported = importSaveRecordFromJson(text, 'SLOT_1');
      if (imported) {
        sound.playTreaty();
        refreshSlots();
        onLoadRecord(imported);
        onShowToast(
          `${imported.metadata.nationName} yedeği Kayıt Yuvası 1'e yüklendi ve açıldı.`
        );
        onClose();
      } else {
        onShowToast('Geçersiz veya bozuk kayıt dosyası (.json).');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
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
        aria-labelledby="system-settings-title"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[90dvh] bg-[#191612] border border-[#c89d54]/45 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f0e6d2]"
      >
        {/* Modal Header with Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#c89d54]/30 bg-[#13110e] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2
                id="system-settings-title"
                className="font-display text-base sm:text-lg font-bold text-[#f0e6d2] truncate"
              >
                Sistem Ayarları ve Kayıt Merkezi
              </h2>
              <p className="text-[11px] text-[#b2a58f] truncate">
                Grafik, harita, ses kanalları, yapay zekâ ve kayıt yuvaları
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Sistem menüsünü kapat"
              className="sm:hidden min-w-[42px] min-h-[42px] rounded-xl bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 flex items-center justify-center text-[#cfc3ae] shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-[#1e1a15] rounded-xl border border-[#3a3228] flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setModalTab('SETTINGS');
                }}
                className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  modalTab === 'SETTINGS'
                    ? 'bg-[#c89d54] text-[#110f0d]'
                    : 'text-[#cfc3ae] hover:text-[#f0e6d2]'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>Oyun Ayarları</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  refreshSlots();
                  setModalTab('SAVES');
                }}
                className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  modalTab === 'SAVES'
                    ? 'bg-[#c89d54] text-[#110f0d]'
                    : 'text-[#cfc3ae] hover:text-[#f0e6d2]'
                }`}
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>Kayıt Merkezi</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Sistem menüsünü kapat"
              className="hidden sm:flex min-w-[42px] min-h-[42px] rounded-xl bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 items-center justify-center text-[#cfc3ae] hover:text-[#f0e6d2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick System Controls Bar */}
          <section className="bg-[#13110e] border border-[#342d24] rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onToggleSound}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-[#1e1a15] hover:bg-[#29231c] border border-[#3a3228] flex items-center justify-center gap-2 text-xs font-semibold text-[#f0e6d2] cursor-pointer"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Efekt Sesleri: Açık</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-[#9e927d] shrink-0" />
                    <span>Efekt Sesleri: Kapalı</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center bg-[#1e1a15] border border-[#3a3228] rounded-xl px-2 min-h-[42px]">
                <PWAInstallButton compact />
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                  onReturnToTitleMenu();
                }}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 flex items-center justify-center gap-2 text-xs font-semibold text-rose-200 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">Senaryo Menüsü</span>
              </button>
            </div>
          </section>

          {modalTab === 'SETTINGS' && (
            <CategorizedSettingsPanel
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              soundEnabled={soundEnabled}
              onToggleSound={onToggleSound}
              audioExtraSlot={
                <section className="bg-[#13110e] border border-[#c89d54]/35 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#e0bc78] flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-[#c89d54] shrink-0" />
                        <span className="truncate">
                          Mehterhane-i Hümayun · {music.activeTrackTitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#b2a58f] mt-0.5">
                        Dahili Osmanlı marşları veya cihazınızdan yerel MP3 seçin
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          music.toggle();
                          setMusicTick((t) => t + 1);
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          music.isPlaying
                            ? 'bg-rose-700 hover:bg-rose-600 text-white'
                            : 'bg-[#c89d54] hover:bg-[#d8b26e] text-[#110f0d]'
                        }`}
                      >
                        {music.isPlaying ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Durdur</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Marşı Çal</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => mp3InputRef.current?.click()}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#211d18] hover:bg-[#2b251e] border border-[#3a3228] text-xs font-semibold text-[#e6dac4] cursor-pointer"
                      >
                        MP3 Seç
                      </button>
                      <input
                        ref={mp3InputRef}
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            music.loadCustomMp3File(f);
                            setMusicTick((t) => t + 1);
                            onShowToast(`${f.name} marş olarak yüklendi ve çalıyor.`);
                          }
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MUSIC_TRACKS.map((trk) => {
                      const isSelected = music.activeTrackId === trk.id;
                      return (
                        <button
                          key={trk.id}
                          type="button"
                          onClick={() => {
                            music.setTrack(trk.id);
                            if (!music.isPlaying) {
                              music.play();
                            }
                            setMusicTick((t) => t + 1);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#c89d54]/20 border-[#c89d54] text-[#f0e6d2]'
                              : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#f0e6d2] truncate">
                              {trk.title}
                            </span>
                            <span className="text-[10px] font-semibold text-[#e0bc78] shrink-0">
                              {trk.eraTag}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#b2a58f] truncate mt-0.5">
                            {trk.subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              }
            />
          )}

          {modalTab === 'SAVES' && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#e0bc78]">
                    Kayıt Yuvaları ve JSON Yedekleme
                  </div>
                  <p className="text-[11px] text-[#b2a58f]">
                    Otomatik kayıt sıklığı:{' '}
                    <strong className="text-[#f0e6d2]">
                      {settings.autoSaveIntervalDays === 0
                        ? 'Kapalı'
                        : `Her ${settings.autoSaveIntervalDays} Günde Bir`}
                    </strong>
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#211d18] hover:bg-[#2b251e] border border-[#c89d54]/45 text-[#e0bc78] text-xs font-semibold flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>.JSON Yedek Yükle</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {SAVE_SLOT_DEFINITIONS.map((def) => {
                  const meta = slots[def.id];
                  const isAuto = def.id === 'AUTOSAVE';

                  return (
                    <div
                      key={def.id}
                      className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        meta
                          ? 'bg-[#13110e] border-[#3a3228]'
                          : 'bg-[#13110e]/60 border-[#2b251e]'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        {meta ? (
                          <NationFlagCanvasBadge
                            nationId={meta.playerNationId}
                            flagCode={meta.flagCode}
                            color={meta.nationColor}
                            width={44}
                            height={30}
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-[#1e1a15] border border-[#342d24] flex items-center justify-center text-[#9e927d] shrink-0">
                            <Save className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#e0bc78]">
                              {def.title}
                            </span>
                            {meta && (
                              <span className="text-xs font-semibold text-[#f0e6d2] truncate">
                                · {cleanNationName(meta.nationName)}
                              </span>
                            )}
                          </div>

                          {meta ? (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#cfc3ae] mt-1">
                              <span className="flex items-center gap-1 font-mono-num">
                                <Calendar className="w-3 h-3 text-[#c89d54]" />
                                {meta.gameDateStr}
                              </span>
                              <span className="text-[#5d5243]">·</span>
                              <span className="flex items-center gap-1 font-mono-num">
                                <Coins className="w-3 h-3 text-[#c89d54]" />
                                {meta.treasury.toLocaleString('tr-TR')} Altın
                              </span>
                              <span className="text-[#5d5243]">·</span>
                              <span className="font-mono-num text-emerald-400">
                                {meta.territoryCount} Eyalet
                              </span>
                              <span className="text-[#9e927d]">
                                · {meta.savedAtDisplay}
                              </span>
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#9e927d] mt-0.5">
                              {def.subtitle} — Henüz kayıt yok
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Slot Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                        {!isAuto && (
                          <button
                            type="button"
                            onClick={() => handleSaveClick(def.id)}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#c89d54] hover:bg-[#d8b26e] text-[#110f0d] font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Kaydet</span>
                          </button>
                        )}

                        {meta && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleLoadClick(def.id)}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Yükle</span>
                            </button>

                            {hasRollbackBackup(def.id) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const restored = restoreRollbackBackup(def.id);
                                  if (restored) {
                                    sound.playTreaty();
                                    refreshSlots();
                                    onShowToast(
                                      `${restored.metadata.nationName} (${restored.metadata.gameDateStr}) önceki yedeğe geri döndürüldü.`
                                    );
                                  }
                                }}
                                title={`Önceki kayda geri dön (${getRollbackBackupMetadata(def.id)?.gameDateStr || ''})`}
                                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#211d18] hover:bg-[#2b251e] border border-[#c89d54]/40 text-[#e0bc78] font-semibold text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>Önceki</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleExportClick(def.id)}
                              title="JSON Yedeği İndir"
                              aria-label="JSON yedeği indir"
                              className="min-w-[40px] min-h-[40px] rounded-xl bg-[#211d18] hover:bg-[#2b251e] border border-[#3a3228] flex items-center justify-center text-[#e0b86e] cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteClick(def.id)}
                              title="Kaydı Sil"
                              aria-label="Kaydı sil"
                              className="min-w-[40px] min-h-[40px] rounded-xl bg-[#211d18] hover:bg-rose-950/60 border border-[#3a3228] hover:border-rose-500/40 flex items-center justify-center text-[#9e927d] hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
