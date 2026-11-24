import React, { useEffect, useState } from 'react';
import { Anchor, Navigation, Scissors, Trash2, X } from 'lucide-react';
import {
  getArmyGenerationInfo,
  getNationModernizedTier,
} from '../../data/world2026Data';
import { GameModeId, Nation, SeaArmy } from '../../types/game';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName, formatTroopsShort } from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';

interface SelectedSeaArmyBarProps {
  seaArmy: SeaArmy;
  playerNationId: string;
  nations: Record<string, Nation>;
  gameMode: GameModeId;
  seaArmyOrderSourceId: string | null;
  moveRatio: number;
  onSetMoveRatio: (ratio: number) => void;
  onStartSeaArmyOrder: (seaArmyId: string | null) => void;
  onDisbandSeaArmy: (seaArmyId: string, ratio: 0.5 | 1) => void;
  onClear: () => void;
}

export const SelectedSeaArmyBar: React.FC<SelectedSeaArmyBarProps> = ({
  seaArmy,
  playerNationId,
  nations,
  gameMode,
  seaArmyOrderSourceId,
  moveRatio,
  onSetMoveRatio,
  onStartSeaArmyOrder,
  onDisbandSeaArmy,
  onClear,
}) => {
  const [splitOpen, setSplitOpen] = useState(false);
  const [disbandOpen, setDisbandOpen] = useState(false);

  useEffect(() => {
    setSplitOpen(false);
    setDisbandOpen(false);
  }, [seaArmy.id]);

  const owner = nations[seaArmy.ownerId];
  if (!owner) return null;

  const isPlayerOwned = seaArmy.ownerId === playerNationId;
  const isOrderActive = seaArmyOrderSourceId === seaArmy.id;
  const armyGen = getArmyGenerationInfo(
    gameMode,
    getNationModernizedTier(owner)
  );
  const infK = ((seaArmy.units?.infantry ?? seaArmy.troops) / 1000).toFixed(1);
  const armK = ((seaArmy.units?.armor ?? 0) / 1000).toFixed(1);
  const airK = ((seaArmy.units?.airDrone ?? 0) / 1000).toFixed(1);
  const plannedSend =
    moveRatio >= 0.99
      ? seaArmy.troops
      : Math.max(500, Math.round(seaArmy.troops * moveRatio));

  return (
    <div
      data-testid="selected-sea-army-bar"
      className="hud-province-quickbar absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto sm:w-[540px] sm:max-w-[calc(100vw-8rem)] z-20 rounded-2xl bg-[#091524]/96 border border-sky-400/55 shadow-2xl px-2.5 sm:px-3 py-2 flex flex-col gap-2"
    >
      {isOrderActive && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-sky-950/95 border border-sky-400/55 text-[11px]">
          <span className="font-bold text-sky-200 truncate">
            Açık denizde bir noktaya veya kıyı şehrine dokunun · %
            {Math.round(moveRatio * 100)} ({plannedSend.toLocaleString('tr-TR')}{' '}
            asker)
          </span>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onStartSeaArmyOrder(null);
            }}
            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-bold border border-slate-700 whitespace-nowrap shrink-0"
          >
            İptal
          </button>
        </div>
      )}

      {splitOpen && isPlayerOwned && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-950/85 border border-amber-500/50 text-[11px]">
          <span className="font-bold text-amber-200 truncate">
            Filoyu bölerek sevk oranı:
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {[0.25, 0.5, 0.75].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSetMoveRatio(r);
                  setSplitOpen(false);
                  onStartSeaArmyOrder(seaArmy.id);
                }}
                className="px-2 py-0.5 rounded-lg font-mono-num text-[10px] font-bold bg-slate-900 text-amber-200 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40 whitespace-nowrap shrink-0"
              >
                %{Math.round(r * 100)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSplitOpen(false)}
              className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 text-[10px] font-bold border border-slate-700 whitespace-nowrap shrink-0"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {disbandOpen && isPlayerOwned && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-[11px]">
          <span className="font-bold text-rose-200 truncate">
            Filoyu Terhis Et (%75 İnsan Gücü İadesi):
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                onDisbandSeaArmy(seaArmy.id, 0.5);
                setDisbandOpen(false);
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] font-bold whitespace-nowrap shrink-0"
            >
              %50 Sil
            </button>
            <button
              type="button"
              onClick={() => {
                onDisbandSeaArmy(seaArmy.id, 1);
                setDisbandOpen(false);
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-bold whitespace-nowrap shrink-0"
            >
              Tamamını Sil
            </button>
            <button
              type="button"
              onClick={() => setDisbandOpen(false)}
              className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 text-[10px] font-bold border border-slate-700 whitespace-nowrap shrink-0"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative w-11 h-9 rounded-xl bg-sky-950/90 border border-sky-400/50 flex items-center justify-center shrink-0">
            <Anchor className="w-4 h-4 text-sky-300" />
            <div className="absolute -bottom-1 -right-1">
              <NationFlagCanvasBadge
                nationId={owner.id}
                flagCode={owner.flagCode}
                color={owner.color}
                width={20}
                height={13}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {seaArmy.name}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-sky-500/20 text-sky-200 border border-sky-400/45 shrink-0">
                DENİZDE KONUŞLU
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate mt-0.5 font-mono-num">
              <span className="text-slate-400 truncate max-w-[100px] font-sans">
                {cleanNationName(owner.name)}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-bold text-emerald-300 shrink-0">
                {formatTroopsShort(seaArmy.troops)}
              </span>
              <span className="hud-landscape-hide text-[10px] text-slate-300 font-sans truncate">
                · {armyGen.infantryShort}: {infK}B · {armyGen.armorShort}:{' '}
                {armK}B · {armyGen.airArtilleryShort}: {airK}B
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onClear();
          }}
          aria-label="Deniz filosu seçimini kaldır"
          className="w-7 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {isPlayerOwned && (
        <div className="hud-province-actions flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setSplitOpen(false);
              setDisbandOpen(false);
              onSetMoveRatio(1);
              onStartSeaArmyOrder(isOrderActive ? null : seaArmy.id);
            }}
            className={`min-h-[36px] px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isOrderActive
                ? 'bg-sky-400 text-slate-950'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isOrderActive ? 'Hedef Seç' : 'Denizde Hareket / Çıkarma Yap'}
            </span>
          </button>

          {seaArmy.troops >= 1000 && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setDisbandOpen(false);
                setSplitOpen((prev) => !prev);
              }}
              className={`min-h-[36px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                splitOpen
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Böl</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setSplitOpen(false);
              setDisbandOpen((prev) => !prev);
            }}
            className={`min-h-[36px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              disbandOpen
                ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                : 'bg-slate-900/90 hover:bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Asker Sil</span>
          </button>
        </div>
      )}
    </div>
  );
};
