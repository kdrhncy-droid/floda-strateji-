import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Coins,
  Download,
  History,
  Play,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
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
  SAVE_SCHEMA_VERSION,
  SAVE_SLOT_DEFINITIONS,
  SaveSlotId,
  SaveSlotMetadata,
  SaveSlotRecord,
} from '../../engine/saveManager';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';

interface SaveManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadRecord: (record: SaveSlotRecord) => void;
  onShowToast?: (msg: string) => void;
}

export const SaveManagerModal: React.FC<SaveManagerModalProps> = ({
  isOpen,
  onClose,
  onLoadRecord,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [slots, setSlots] = useState<Record<SaveSlotId, SaveSlotMetadata | null>>(
    () => listAllSaveSlots()
  );
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useAccessibleDialog(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setSlots(listAllSaveSlots());
      setNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const refreshSlots = () => setSlots(listAllSaveSlots());

  const handleLoad = (slotId: SaveSlotId) => {
    const rec = loadGameFromSlot(slotId);
    if (!rec) {
      setNotice('Bu kayıt yuvası boş veya bozuk.');
      return;
    }
    sound.playWarHorn();
    onLoadRecord(rec);
    onClose();
  };

  const handleRollback = (slotId: SaveSlotId) => {
    const restored = restoreRollbackBackup(slotId);
    if (!restored) {
      setNotice('Bu yuva için geri dönülecek önceki yedek bulunamadı.');
      return;
    }
    sound.playTreaty();
    refreshSlots();
    const msg = `${restored.metadata.nationName} (${restored.metadata.gameDateStr}) önceki yedeğe geri yüklendi.`;
    setNotice(msg);
    onShowToast?.(msg);
  };

  const handleExport = (slotId: SaveSlotId) => {
    const rec = loadGameFromSlot(slotId);
    if (!rec) return;
    sound.playClick();
    exportSaveRecordToJson(rec);
    const msg = `${rec.metadata.nationName} yedeği (.json) indirildi.`;
    setNotice(msg);
    onShowToast?.(msg);
  };

  const handleDelete = (slotId: SaveSlotId) => {
    sound.playClick();
    deleteSaveSlot(slotId);
    refreshSlots();
    setNotice('Kayıt yuvası temizlendi.');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importSaveRecordFromJson(String(reader.result || ''), 'SLOT_1');
      if (imported) {
        sound.playTreaty();
        refreshSlots();
        onLoadRecord(imported);
        onShowToast?.(`${imported.metadata.nationName} kaydı yüklendi!`);
        onClose();
      } else {
        setNotice('Geçersiz veya bütünlük doğrulamasından geçemeyen kayıt dosyası (.json).');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="floda-saves-title"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[90dvh] bg-[#191612] border border-[#c89d54]/45 rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#f0e6d2]"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#c89d54]/30 bg-[#13110e] shrink-0">
          <div className="min-w-0">
            <h2
              id="floda-saves-title"
              className="font-display text-base sm:text-lg font-bold text-[#f0e6d2]"
            >
              Kayıt Merkezi ve Sefer Arşivi
            </h2>
            <p className="text-xs text-[#b2a58f]">
              Sürüm korumalı kayıt şeması (v{SAVE_SCHEMA_VERSION}), otomatik geri dönüş yedeği ve .JSON dışa/içe aktarma
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kayıt merkezini kapat"
            className="min-w-[44px] min-h-[44px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 flex items-center justify-center text-[#cfc3ae] hover:text-[#f0e6d2] shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-[#cfc3ae]">
              <ShieldCheck className="w-4 h-4 text-[#6eb887] shrink-0" />
              <span>Tüm kayıtlar bütünlük özeti (checksum) ile doğrulanır.</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aoh3-menu-btn min-h-[42px] px-3.5 py-2 rounded-lg text-[#e0bc78] text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>.JSON Yedek İçe Aktar</span>
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

          <div className="space-y-2.5">
            {SAVE_SLOT_DEFINITIONS.map((def) => {
              const meta = slots[def.id];
              const canRollback = hasRollbackBackup(def.id);
              const rollbackMeta = canRollback
                ? getRollbackBackupMetadata(def.id)
                : null;

              return (
                <div
                  key={def.id}
                  className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    meta
                      ? 'bg-[#14110e] border-[#3a3228]'
                      : 'bg-[#14110e]/60 border-[#2d2720]'
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
                      <div className="w-11 h-11 rounded-lg bg-[#211d18] border border-[#3a3228] flex items-center justify-center text-[#7f7463] shrink-0">
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
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#cfc3ae] mt-1">
                          <span className="flex items-center gap-1 font-mono-num tabular-nums">
                            <Calendar className="w-3 h-3 text-[#7ab3cf]" />
                            {meta.gameDateStr}
                          </span>
                          <span className="flex items-center gap-1 font-mono-num tabular-nums">
                            <Coins className="w-3 h-3 text-[#c89d54]" />
                            {meta.treasury.toLocaleString('tr-TR')} Altın
                          </span>
                          <span className="font-mono-num tabular-nums text-[#6eb887]">
                            {meta.territoryCount} Eyalet
                          </span>
                          <span className="text-[#8d816f]">
                            {meta.savedAtDisplay}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#8d816f] mt-0.5">
                          {def.subtitle} — Boş yuva
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {meta && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleLoad(def.id)}
                          className="aoh3-menu-btn-primary min-h-[40px] px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Yükle</span>
                        </button>

                        {canRollback && rollbackMeta && (
                          <button
                            type="button"
                            onClick={() => handleRollback(def.id)}
                            title={`Önceki kayda geri dön: ${rollbackMeta.nationName} (${rollbackMeta.gameDateStr})`}
                            className="aoh3-menu-btn min-h-[40px] px-2.5 py-1.5 rounded-lg text-[#e0bc78] text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Önceki</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExport(def.id)}
                          aria-label={`${def.title} JSON yedeğini indir`}
                          title="JSON Yedeği İndir"
                          className="min-w-[40px] min-h-[40px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#3a3228] flex items-center justify-center text-[#7ab3cf] cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(def.id)}
                          aria-label={`${def.title} kaydını sil`}
                          title="Kaydı Sil"
                          className="min-w-[40px] min-h-[40px] rounded-lg bg-[#231f1a] hover:bg-[#421e1e] border border-[#3a3228] hover:border-[#982f2f] flex items-center justify-center text-[#a89b86] hover:text-[#e89999] cursor-pointer"
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
        </div>
      </div>
    </div>
  );
};
