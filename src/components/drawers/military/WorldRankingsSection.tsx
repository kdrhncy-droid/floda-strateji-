import React, { useEffect, useRef, useState } from "react";
import { Search, TrendingUp, X } from "lucide-react";
import { GameModeId, Nation, Territory } from "../../../types/game";
import { computeWorldPowerRankings } from "../../../engine/worldRankings";
import { NationFlagCanvasBadge } from "../../../map/nationFlagRenderer";
import { cleanNationName } from "../../../utils/formatters";
import { sound } from "../../../utils/soundEngine";
import { EconomySourcesPopover } from "../../common/EconomySourcesPopover";
import { AoH3GlyphSvg } from "../../illustrations/AoH3Illustrations";

export type RankingSortBy =
  | "SCORE"
  | "GDP"
  | "ARMY"
  | "TECH"
  | "PRESTIGE"
  | "CAPITAL";

export interface WorldRankingsSectionProps {
  playerNation: Nation;
  territories: Record<string, Territory>;
  gameMode: GameModeId;
  rankedList: ReturnType<typeof computeWorldPowerRankings>;
  playerRankIndex: number;
  rankingSortBy: RankingSortBy;
  onChangeRankingSortBy: (sort: RankingSortBy) => void;
  onInspectNation?: (nationId: string) => void;
  onSelectTerritory: (territoryId: string) => void;
}

export const WorldRankingsSection: React.FC<WorldRankingsSectionProps> = ({
  playerNation,
  territories,
  gameMode,
  rankedList,
  playerRankIndex,
  rankingSortBy,
  onChangeRankingSortBy,
  onInspectNation,
  onSelectTerritory,
}) => {
  const [rankingSearch, setRankingSearch] = useState("");
  const [inspectedEconomyNation, setInspectedEconomyNation] =
    useState<Nation | null>(null);
  const rankHoldTimerRef = useRef<number | null>(null);
  const rankHoldTriggeredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rankHoldTimerRef.current !== null) {
        window.clearTimeout(rankHoldTimerRef.current);
      }
    };
  }, []);

  const playerEntry = rankedList.find((r) => r.nation.id === playerNation.id);
  const normQuery = rankingSearch.trim().toLocaleLowerCase("tr-TR");
  const indexedList = rankedList.map((entry, idx) => ({
    entry,
    rank: idx + 1,
  }));
  const visibleRows = normQuery
    ? indexedList.filter(({ entry }) =>
        cleanNationName(entry.nation.name)
          .toLocaleLowerCase("tr-TR")
          .includes(normQuery)
      )
    : indexedList;

  return (
    <>
      <div className="bg-[#14100c] border border-[#caa15a]/40 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
              <AoH3GlyphSvg name="trophy" className="w-4 h-4 text-[#e0b86e]" />
              <span>
                {gameMode === "EMPIRES_1440"
                  ? "1440 Devlet Güç Sıralaması"
                  : "2026 Küresel Güç Sıralaması"}
              </span>
            </h3>
            <p className="text-[11px] text-[#b8a990] mt-0.5">
              Rakiplerin sizden neden güçlü olduğunu görün; kaynakları görmek için
              Ekonomi butonuna basılı tutun.
            </p>
          </div>
          {playerRankIndex >= 0 && (
            <span className="font-mono-num text-xs font-bold text-[#e0b86e]">
              Sıranız: #{playerRankIndex + 1} / {rankedList.length}
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#b8a990] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={rankingSearch}
            onChange={(e) => setRankingSearch(e.target.value)}
            placeholder="Sıralamada devlet ara..."
            aria-label="Güç sıralamasında devlet ara"
            data-testid="power-rank-search-input"
            className="w-full min-h-[38px] pl-8 pr-8 py-1.5 rounded-xl bg-[#0f0c09] border border-[#caa15a]/30 focus:border-[#e0b86e] focus:outline-none text-xs text-[#faf3e3] placeholder:text-[#8e806a]"
          />
          {rankingSearch && (
            <button
              type="button"
              onClick={() => setRankingSearch("")}
              aria-label="Aramayı temizle"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-[#b8a990] hover:text-[#faf3e3] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-[#0f0c09] p-1 rounded-xl border border-[#caa15a]/30">
          {(
            [
              { id: "SCORE", label: "Toplam" },
              { id: "GDP", label: "Ekonomi" },
              { id: "ARMY", label: "Ordu" },
              { id: "TECH", label: "Teknoloji" },
              { id: "PRESTIGE", label: "Prestij" },
              { id: "CAPITAL", label: "Toprak" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`power-rank-sort-${tab.id}`}
              onClick={() => onChangeRankingSortBy(tab.id)}
              className={`min-h-[40px] py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-colors truncate cursor-pointer ${
                rankingSortBy === tab.id
                  ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]"
                  : "text-[#b8a990] hover:text-[#faf3e3]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
          {visibleRows.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-[#18130e] border border-[#caa15a]/25 text-xs text-[#b8a990]">
              Aramaya uygun devlet bulunamadı.
            </div>
          ) : (
            visibleRows.map(({ entry, rank }) => {
              const isPlayer = entry.nation.id === playerNation.id;
              const reasons: { label: string; tone: "rose" | "gold" | "sky" }[] =
                [];
              if (!isPlayer && playerEntry) {
                if (entry.army > playerEntry.army * 1.05) {
                  reasons.push({
                    label: `Ordu +${(
                      (entry.army - playerEntry.army) /
                      1000
                    ).toFixed(1)}B`,
                    tone: "rose",
                  });
                }
                if (entry.totalEconomy > playerEntry.totalEconomy * 1.05) {
                  reasons.push({
                    label: `Ekonomi +${(
                      entry.totalEconomy - playerEntry.totalEconomy
                    ).toLocaleString("tr-TR")}`,
                    tone: "gold",
                  });
                }
                if (entry.techLevel > playerEntry.techLevel + 0.1) {
                  reasons.push({
                    label: `Tek. +${(
                      entry.techLevel - playerEntry.techLevel
                    ).toFixed(1)}`,
                    tone: "sky",
                  });
                }
                if (entry.ownedCount > playerEntry.ownedCount) {
                  reasons.push({
                    label: `+${entry.ownedCount - playerEntry.ownedCount} Eyalet`,
                    tone: "gold",
                  });
                }
              }

              return (
                <div
                  key={entry.nation.id}
                  data-testid={`power-rank-row-${entry.nation.id}`}
                  className={`rounded-xl border px-2.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    isPlayer
                      ? "bg-[#211a12] border-[#e0b86e] shadow"
                      : "bg-[#18130e] border-[#caa15a]/25 hover:border-[#caa15a]/55"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (onInspectNation) {
                        sound.playClick();
                        onInspectNation(entry.nation.id);
                      } else {
                        onSelectTerritory(entry.nation.capitalTerritoryId);
                      }
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span className="font-mono-num text-xs font-bold text-[#e0b86e] w-6 shrink-0">
                      #{rank}
                    </span>
                    <NationFlagCanvasBadge
                      nationId={entry.nation.id}
                      flagCode={entry.nation.flagCode}
                      color={entry.nation.color}
                      width={34}
                      height={24}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-[#f3ead7] truncate">
                          {cleanNationName(entry.nation.name)}
                        </span>
                        {entry.nation.vassalOf && (
                          <span className="text-[10px] text-[#e0b86e]">
                            (Vasal)
                          </span>
                        )}
                        {isPlayer && (
                          <span className="px-1.5 py-0 rounded bg-[#e0b86e] text-[#14100c] text-[9px] font-black">
                            SİZ
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-[#c5b79e] font-mono-num flex flex-wrap items-center gap-x-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#f3ead7]">
                          <AoH3GlyphSvg
                            name="sword"
                            className="w-2.5 h-2.5 text-[#e0b86e]"
                          />
                          <span>{(entry.army / 1000).toFixed(1)}B</span>
                        </span>
                        <span>Tek.{entry.techLevel.toFixed(1)}</span>
                        <span>{entry.ownedCount} Ey.</span>
                        <span>★ {entry.prestige}</span>
                      </div>

                      {/* Why stronger / weaker comparison chips */}
                      {!isPlayer && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {reasons.length > 0 ? (
                            <>
                              <span className="text-[9.5px] font-bold text-[#9b8e78]">
                                Neden güçlü:
                              </span>
                              {reasons.map((r) => (
                                <span
                                  key={r.label}
                                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono-num font-bold border ${
                                    r.tone === "rose"
                                      ? "bg-rose-950/60 border-rose-500/40 text-rose-200"
                                      : r.tone === "sky"
                                      ? "bg-sky-950/50 border-sky-400/40 text-sky-200"
                                      : "bg-[#251d13] border-[#caa15a]/45 text-[#e0b86e]"
                                  }`}
                                >
                                  {r.label}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-950/50 border border-emerald-500/35 text-emerald-300">
                              Siz bu devletten öndesiniz
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Right: Mevcut Ekonomi Hold Pill + Power Score */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid={`rank-economy-hold-${entry.nation.id}`}
                      onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === "mouse") return;
                        rankHoldTriggeredRef.current = false;
                        if (rankHoldTimerRef.current !== null) {
                          window.clearTimeout(rankHoldTimerRef.current);
                        }
                        rankHoldTimerRef.current = window.setTimeout(() => {
                          rankHoldTriggeredRef.current = true;
                          sound.playClick();
                          setInspectedEconomyNation(entry.nation);
                        }, 260);
                      }}
                      onPointerUp={() => {
                        if (rankHoldTimerRef.current !== null) {
                          window.clearTimeout(rankHoldTimerRef.current);
                          rankHoldTimerRef.current = null;
                        }
                      }}
                      onPointerLeave={() => {
                        if (rankHoldTimerRef.current !== null) {
                          window.clearTimeout(rankHoldTimerRef.current);
                          rankHoldTimerRef.current = null;
                        }
                      }}
                      onPointerCancel={() => {
                        if (rankHoldTimerRef.current !== null) {
                          window.clearTimeout(rankHoldTimerRef.current);
                          rankHoldTimerRef.current = null;
                        }
                      }}
                      onClick={() => {
                        if (rankHoldTriggeredRef.current) {
                          rankHoldTriggeredRef.current = false;
                          return;
                        }
                        sound.playClick();
                        setInspectedEconomyNation(entry.nation);
                      }}
                      title="Mevcut Ekonomi kaynakları için basılı tutun"
                      className="px-2 py-1 rounded-lg bg-[#120e0a] hover:bg-[#241c13] border border-[#caa15a]/40 text-right cursor-pointer select-none"
                    >
                      <div className="text-[9px] text-[#b8a990] flex items-center justify-end gap-1">
                        <TrendingUp className="w-2.5 h-2.5 text-[#e0b86e]" />
                        <span>Ekonomi</span>
                      </div>
                      <div className="font-mono-num text-[11px] font-extrabold text-[#e0b86e]">
                        {entry.totalEconomy.toLocaleString("tr-TR")}
                      </div>
                    </button>

                    <div className="text-right font-mono-num min-w-[46px]">
                      <div className="text-xs font-extrabold text-[#faf3e3]">
                        {entry.score.toLocaleString("tr-TR")}
                      </div>
                      <div className="text-[9.5px] text-[#9b8e78]">Güç</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <EconomySourcesPopover
        nation={inspectedEconomyNation}
        territories={territories}
        onClose={() => setInspectedEconomyNation(null)}
      />
    </>
  );
};
