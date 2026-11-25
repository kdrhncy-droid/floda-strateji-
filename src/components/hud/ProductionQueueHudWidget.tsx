import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Hammer, Shield } from 'lucide-react';
import { GameModeId, Territory } from '../../types/game';
import { BUILDINGS } from '../../data/world2026Data';
import { cleanProvinceName } from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';
import {
  getBuildingArtwork,
  getRecruitUnitArtwork,
} from '../drawers/buildingArtwork';
import { TechArtworkAsset } from '../drawers/techArtwork';

interface ProductionQueueHudWidgetProps {
  playerNationId: string;
  territories: Record<string, Territory>;
  gameMode: GameModeId;
  onSelectTerritory: (id: string) => void;
}

interface UnifiedQueueEntry {
  id: string;
  kind: 'CONSTRUCTION' | 'RECRUITMENT';
  territoryId: string;
  territoryName: string;
  title: string;
  detail: string;
  progressDays: number;
  totalDays: number;
  pct: number;
  remainingDays: number;
  queueIndex: number; // 0 = actively building/training, >= 1 = waiting in line
  artwork: TechArtworkAsset;
}

export const ProductionQueueHudWidget: React.FC<
  ProductionQueueHudWidgetProps
> = ({ playerNationId, territories, gameMode, onSelectTerritory }) => {
  const [expanded, setExpanded] = useState(false);
  const [brokenImgIds, setBrokenImgIds] = useState<Record<string, boolean>>({});
  const is1440 = gameMode === 'EMPIRES_1440';

  const { activeItems, allItems, constructionCount, recruitCount } =
    useMemo(() => {
      const active: UnifiedQueueEntry[] = [];
      const waiting: UnifiedQueueEntry[] = [];
      let cCount = 0;
      let rCount = 0;

      for (const t of Object.values(territories)) {
        if (!t || t.ownerId !== playerNationId) continue;
        const cityName = cleanProvinceName(t.name);

        if (Array.isArray(t.constructionQueue) && t.constructionQueue.length > 0) {
          t.constructionQueue.forEach((job, idx) => {
            cCount += 1;
            const bDef = BUILDINGS.find((b) => b.id === job.building);
            const buildingTitle =
              job.specialtyName ||
              (is1440 ? bDef?.eraName1440 : bDef?.name) ||
              bDef?.name ||
              job.building;
            const total = Math.max(1, job.totalDays);
            const prog = Math.max(0, Math.min(total, job.progressDays));
            const pct = Math.min(99, Math.round((prog / total) * 100));
            const entry: UnifiedQueueEntry = {
              id: `c_${t.id}_${job.id}_${idx}`,
              kind: 'CONSTRUCTION',
              territoryId: t.id,
              territoryName: cityName,
              title: buildingTitle,
              detail: `Sv.${job.targetLevel}`,
              progressDays: prog,
              totalDays: total,
              pct: idx === 0 ? pct : 0,
              remainingDays: Math.max(1, total - prog),
              queueIndex: idx,
              artwork: getBuildingArtwork(job.building),
            };
            if (idx === 0) active.push(entry);
            else waiting.push(entry);
          });
        }

        if (Array.isArray(t.recruitmentQueue) && t.recruitmentQueue.length > 0) {
          t.recruitmentQueue.forEach((job, idx) => {
            rCount += 1;
            const total = Math.max(1, job.totalDays);
            const prog = Math.max(0, Math.min(total, job.progressDays));
            const pct = Math.min(99, Math.round((prog / total) * 100));
            const entry: UnifiedQueueEntry = {
              id: `r_${t.id}_${job.id}_${idx}`,
              kind: 'RECRUITMENT',
              territoryId: t.id,
              territoryName: cityName,
              title: job.label || 'Asker Eğitimi',
              detail: `+${job.troops.toLocaleString('tr-TR')}`,
              progressDays: prog,
              totalDays: total,
              pct: idx === 0 ? pct : 0,
              remainingDays: Math.max(1, total - prog),
              queueIndex: idx,
              artwork: getRecruitUnitArtwork(job.unitMode ?? 'infantry'),
            };
            if (idx === 0) active.push(entry);
            else waiting.push(entry);
          });
        }
      }

      // Sort active items so the one closest to completion is first
      active.sort(
        (a, b) =>
          b.pct - a.pct ||
          a.remainingDays - b.remainingDays ||
          a.territoryName.localeCompare(b.territoryName, 'tr')
      );

      // Sort waiting items by queue position first, then city
      waiting.sort(
        (a, b) =>
          a.queueIndex - b.queueIndex ||
          a.territoryName.localeCompare(b.territoryName, 'tr')
      );

      return {
        activeItems: active,
        waitingItems: waiting,
        allItems: [...active, ...waiting],
        constructionCount: cCount,
        recruitCount: rCount,
      };
    }, [territories, playerNationId, is1440]);

  if (allItems.length === 0) return null;

  const primary = activeItems[0] || allItems[0];
  const behindQueue = allItems.slice(1);
  const previewBehind = behindQueue.slice(0, 4);
  const overflowCount = Math.max(0, behindQueue.length - previewBehind.length);

  const renderThumb = (item: UnifiedQueueEntry, sizeClass: string) => {
    const isBroken = brokenImgIds[item.id];
    return (
      <div
        className={`relative ${sizeClass} rounded-md overflow-hidden border border-[#caa15a]/50 shrink-0`}
        style={{ background: item.artwork.fallbackGradient }}
      >
        {!isBroken && (
          <img
            src={item.artwork.src}
            alt={item.title}
            loading="eager"
            decoding="sync"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() =>
              setBrokenImgIds((prev) => ({ ...prev, [item.id]: true }))
            }
            style={{ objectPosition: item.artwork.objectPosition }}
            className="w-full h-full object-cover"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15"
        />
        <span className="absolute bottom-0.5 right-0.5 text-[#f3ead7] drop-shadow">
          {item.kind === 'CONSTRUCTION' ? (
            <Hammer className="w-2.5 h-2.5 text-[#e0b86e]" />
          ) : (
            <Shield className="w-2.5 h-2.5 text-emerald-300" />
          )}
        </span>
      </div>
    );
  };

  return (
    <div
      data-testid="production-queue-hud"
      className="hud-production-queue pointer-events-auto w-[min(252px,calc(100vw-1rem))] rounded-xl bg-[#14100c]/95 border border-[#caa15a]/50 shadow-2xl backdrop-blur-md text-[#f3ead7] overflow-hidden"
    >
      {/* Active Lead Production / Construction Card */}
      <div className="p-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playSelectTerritory();
              onSelectTerritory(primary.territoryId);
            }}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
            title={`${primary.territoryName} — ${primary.title} (Haritada odaklan)`}
          >
            {renderThumb(primary, 'w-9 h-9')}

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold text-[#faf3e3] truncate group-hover:text-[#e0b86e] transition-colors">
                  {primary.title}
                </span>
                <span
                  data-testid="production-queue-lead-pct"
                  className={`font-mono-num text-[11.5px] font-extrabold shrink-0 ${
                    primary.kind === 'CONSTRUCTION'
                      ? 'text-[#e0b86e]'
                      : 'text-emerald-300'
                  }`}
                >
                  %{primary.pct}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[9.5px] text-[#b8a990] font-mono-num truncate">
                <span className="truncate text-[#d8cbb5]">
                  {primary.territoryName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{primary.detail}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{primary.remainingDays}g</span>
              </div>
            </div>
          </button>

          {behindQueue.length > 0 && (
            <button
              type="button"
              data-testid="production-queue-expand-btn"
              onClick={() => {
                sound.playClick();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              aria-label="Üretim ve inşaat sırasını aç veya kapat"
              className="w-7 h-7 rounded-lg bg-[#1d1711] hover:bg-[#2a2117] border border-[#caa15a]/35 flex items-center justify-center text-[#e0b86e] shrink-0 cursor-pointer transition-colors"
              title={`Sırada ${behindQueue.length} iş daha var`}
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Live Progress Bar for Lead Task */}
        <div className="w-full h-1.5 rounded-full bg-[#0a0806] border border-[#caa15a]/25 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              primary.kind === 'CONSTRUCTION'
                ? 'bg-gradient-to-r from-[#9e7738] via-[#caa15a] to-[#f3ead7]'
                : 'bg-gradient-to-r from-emerald-700 via-emerald-400 to-emerald-200'
            }`}
            style={{ width: `${Math.max(4, primary.pct)}%` }}
          />
        </div>

        {/* Visual Sequential Queue Trail Behind the Active Item */}
        {behindQueue.length > 0 && !expanded && (
          <button
            type="button"
            data-testid="production-queue-trail"
            onClick={() => {
              sound.playClick();
              setExpanded(true);
            }}
            className="w-full flex items-center justify-between gap-2 pt-1 border-t border-[#caa15a]/15 cursor-pointer group"
            title="Tüm sırayı görüntülemek için tıklayın"
          >
            <div className="flex items-center gap-1 min-w-0">
              {previewBehind.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative"
                  title={`${item.territoryName}: ${item.title} (${
                    item.queueIndex === 0
                      ? `%${item.pct}`
                      : `Sırada #${item.queueIndex + 1}`
                  })`}
                >
                  {renderThumb(item, 'w-6 h-6 opacity-90 group-hover:opacity-100')}
                  <span className="absolute -top-1 -left-1 px-0.5 rounded bg-[#0d0a07] border border-[#caa15a]/45 text-[8px] font-mono-num font-bold text-[#e0b86e] leading-tight">
                    {item.queueIndex === 0 ? `%${item.pct}` : `#${idx + 2}`}
                  </span>
                </div>
              ))}
              {overflowCount > 0 && (
                <span className="font-mono-num text-[9.5px] font-bold text-[#b8a990] pl-0.5">
                  +{overflowCount}
                </span>
              )}
            </div>

            <span className="text-[9.5px] font-mono-num text-[#b8a990] group-hover:text-[#faf3e3] shrink-0 whitespace-nowrap">
              {constructionCount > 0 && recruitCount > 0
                ? `${constructionCount} İnşa · ${recruitCount} Asker`
                : `Sıra (${allItems.length})`}
            </span>
          </button>
        )}
      </div>

      {/* Expanded Full Queue Drawer List */}
      {expanded && behindQueue.length > 0 && (
        <div
          data-testid="production-queue-expanded-list"
          className="border-t border-[#caa15a]/25 bg-[#0f0c09]/95 max-h-[196px] overflow-y-auto divide-y divide-[#caa15a]/12"
        >
          {behindQueue.map((item, idx) => {
            const isRunningInOtherCity = item.queueIndex === 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  sound.playSelectTerritory();
                  onSelectTerritory(item.territoryId);
                }}
                className="w-full px-2 py-1.5 flex items-center gap-2 text-left hover:bg-[#caa15a]/10 transition-colors cursor-pointer"
                title={`${item.territoryName} eyaletine odaklan`}
              >
                <span className="font-mono-num text-[9.5px] font-bold text-[#9b8e78] w-4 text-center shrink-0">
                  {idx + 2}
                </span>
                {renderThumb(item, 'w-7 h-7')}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10.5px] font-semibold text-[#f3ead7] truncate">
                      {item.title}
                    </span>
                    <span
                      className={`font-mono-num text-[10px] font-bold shrink-0 ${
                        isRunningInOtherCity
                          ? item.kind === 'CONSTRUCTION'
                            ? 'text-[#e0b86e]'
                            : 'text-emerald-300'
                          : 'text-[#9b8e78]'
                      }`}
                    >
                      {isRunningInOtherCity ? `%${item.pct}` : 'Sırada'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] font-mono-num text-[#a69881] truncate">
                    <span className="truncate">{item.territoryName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{item.detail}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{item.remainingDays}g</span>
                  </div>
                  {isRunningInOtherCity && (
                    <div className="mt-0.5 w-full h-1 rounded-full bg-black/60 overflow-hidden">
                      <div
                        className={`h-full ${
                          item.kind === 'CONSTRUCTION'
                            ? 'bg-[#caa15a]'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.max(4, item.pct)}%` }}
                      />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
