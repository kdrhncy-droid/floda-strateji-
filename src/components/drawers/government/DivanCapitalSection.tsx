import React from "react";
import { FlaskConical, Landmark } from "lucide-react";
import { GameModeId, Nation, Territory } from "../../../types/game";
import { NationEconomyBreakdown } from "../../../engine/simulationEngine";
import { getTechArtwork } from "../techArtwork";
import { BUILDINGS, computeNationTechMetrics } from "../../../data/world2026Data";
import { cleanProvinceName } from "../../../utils/formatters";
import { AoH3GlyphSvg } from "../../illustrations/AoH3Illustrations";
import { RulerDynastyCard } from "../../common/RulerDynastyCard";

export type NationTechMetrics = ReturnType<typeof computeNationTechMetrics>;

export interface DivanCapitalSectionProps {
  playerNation: Nation;
  playerEconomy: NationEconomyBreakdown;
  capitalTerritory: Territory | null;
  techMetrics: NationTechMetrics;
  modernizedMilTier: number;
  gameMode: GameModeId;
  tick: number;
  onSelectTerritory?: (territoryId: string) => void;
}

export const DivanCapitalSection: React.FC<DivanCapitalSectionProps> = ({
  playerNation,
  playerEconomy,
  capitalTerritory,
  techMetrics,
  modernizedMilTier,
  gameMode,
  tick,
  onSelectTerritory,
}) => {
  return (
    <div
      data-testid="aoh3-divan-screen"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4"
    >
      {/* Left 6 Cols: Reigning Ruler/Dynasty + Capital Palace & Scenario Technology Capacity */}
      <div className="lg:col-span-6 space-y-3">
        <RulerDynastyCard
          nation={playerNation}
          gameMode={gameMode}
          tick={tick}
          compact
        />

        <div className="rounded-2xl bg-[#15110d] border border-[#caa15a]/45 overflow-hidden shadow-lg">
          <div
            className="relative h-28 w-full overflow-hidden border-b border-[#caa15a]/30"
            style={{
              background: getTechArtwork("COURT", "ADMINISTRATION")
                .fallbackGradient,
            }}
          >
            <img
              src={getTechArtwork("COURT", "ADMINISTRATION").src}
              alt="Başkent Külliyesi"
              loading="eager"
              decoding="sync"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#15110d] via-[#15110d]/55 to-black/30" />

            <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded bg-black/75 border border-[#caa15a]/45 text-[10px] font-bold text-[#f3ead7]">
                {techMetrics.eraLabel}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#1e1710]/90 border border-[#caa15a]/50 font-mono-num text-[11px] font-extrabold text-[#e0b86e]">
                Başkent Seviyesi Sv.{techMetrics.capitalLevel}/10
              </span>
            </div>

            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-display font-bold text-[#faf3e3] drop-shadow">
                  {gameMode === "EMPIRES_1440"
                    ? "Saray-ı Hümayun & Başkent Külliyesi"
                    : "Başkent Devlet Külliyesi & Merkez Kampüsü"}
                </h3>
                <div className="text-[11px] text-[#e0b86e] font-semibold flex items-center gap-1">
                  <AoH3GlyphSvg name="star" className="w-3 h-3 shrink-0" />
                  <span>
                    {capitalTerritory
                      ? cleanProvinceName(capitalTerritory.name)
                      : "Payitaht"}{" "}
                    · Saray Sv.{techMetrics.capitalPalaceLevel}/5
                  </span>
                </div>
              </div>
              {capitalTerritory && onSelectTerritory && (
                <button
                  type="button"
                  onClick={() => onSelectTerritory(capitalTerritory.id)}
                  className="px-2.5 py-1 rounded-lg bg-[#14100c]/85 hover:bg-[#241c13] border border-[#caa15a]/45 text-[11px] font-bold text-[#f3ead7] cursor-pointer shrink-0 inline-flex items-center gap-1"
                >
                  <AoH3GlyphSvg name="pin" className="w-3 h-3 text-[#e0b86e]" />
                  <span>Başkente Git</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 space-y-3">
            {/* 4 Pillar Metrics: Tech Level, Max Tech Cap, Monthly Growth, Prestige */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
                <div className="text-[10px] text-[#b8a990]">
                  Teknoloji Düzeyi
                </div>
                <div className="font-mono-num text-xs sm:text-sm font-extrabold text-[#e0b86e]">
                  {techMetrics.techLevel.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
                <div className="text-[10px] text-[#b8a990]">
                  Maks. Tek. Tavanı
                </div>
                <div className="font-mono-num text-xs sm:text-sm font-extrabold text-[#f3ead7]">
                  {techMetrics.maxTechLevel.toFixed(1)}
                </div>
              </div>
              <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
                <div className="text-[10px] text-[#b8a990]">
                  Aylık Tek. Artışı
                </div>
                <div className="font-mono-num text-xs sm:text-sm font-extrabold text-[#e0b86e]">
                  +{techMetrics.monthlyTechGrowth.toFixed(2)}/ay
                </div>
              </div>
              <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
                <div className="text-[10px] text-[#b8a990]">
                  Devlet Prestiji
                </div>
                <div className="font-mono-num text-xs sm:text-sm font-extrabold text-[#f3ead7]">
                  {techMetrics.prestige}
                </div>
              </div>
            </div>

            {/* Capital Palace Status (Build moved to Hammer Construction menu) */}
            {capitalTerritory &&
              (() => {
                const palaceDef = BUILDINGS.find(
                  (b) => b.id === "capitalPalace"
                );
                const curLvl = capitalTerritory.buildings.capitalPalace ?? 0;
                const maxLvl = palaceDef?.maxLevel ?? 5;
                const queued = capitalTerritory.constructionQueue?.find(
                  (q) => q.building === "capitalPalace"
                );

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[#1d1711] border border-[#caa15a]/35">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#f3ead7]">
                        {gameMode === "EMPIRES_1440"
                          ? "Saray-ı Hümayun & Divan Külliyesi"
                          : "Başkent Devlet Külliyesi"}{" "}
                        <span className="text-[#e0b86e] font-mono-num">
                          (Sv.{curLvl}/{maxLvl})
                        </span>
                      </div>
                      <div className="text-[10.5px] text-[#e0b86e]">
                        Seviye başına +3.5 Bilim, +%8 Vergi, +300 İG ve +1
                        Başkent Seviyesi
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-[#14100c] border border-[#caa15a]/30 text-[10.5px] font-bold text-[#c5b79e] shrink-0">
                      {queued
                        ? `İnşa Sürüyor (${queued.totalDays - queued.progressDays}g)`
                        : "İnşaat (Çekiç) menüsünden kurulur"}
                    </span>
                  </div>
                );
              })()}
          </div>
        </div>

        {/* Tech-Gated Educational Network Info Card */}
        <div className="rounded-2xl bg-[#15110d] border border-[#caa15a]/35 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#e0b86e]" />
              <span>
                {gameMode === "EMPIRES_1440"
                  ? "Maarif & Medrese Eğitim Şebekesi"
                  : "Ulusal Eğitim & Üniversite Ağı"}
              </span>
            </h3>
            <span className="text-[11px] font-mono-num text-[#b8a990]">
              {playerEconomy.territoryCount} Eyalet
            </span>
          </div>

          <div className="space-y-2">
            {(
              [
                {
                  id: "school" as const,
                  title:
                    gameMode === "EMPIRES_1440"
                      ? "Sıbyan Mektebi (İlkokul)"
                      : "İlkokul & Temel Eğitim",
                  count: techMetrics.schoolCount,
                  reqTechId: "sci_1",
                  reqLabel: "Bilim Çağ I (sci_1)",
                  bonus: "+1.4 Bilim/gün · +0.25 Maks. Teknoloji Tavanı",
                  artKey: "OBSERVATORY" as const,
                },
                {
                  id: "highSchool" as const,
                  title:
                    gameMode === "EMPIRES_1440"
                      ? "Medrese-i Âliye (Ortaokul & Lise)"
                      : "Ortaokul & Teknik Lise",
                  count: techMetrics.highSchoolCount,
                  reqTechId: "sci_2",
                  reqLabel: "Bilim Çağ II (sci_2)",
                  bonus: "+2.6 Bilim/gün · +%4 Üretim · +0.45 Maks. Tek.",
                  artKey: "COURT" as const,
                },
                {
                  id: "university" as const,
                  title:
                    gameMode === "EMPIRES_1440"
                      ? "Darülfünun & Rasathane (Üniversite)"
                      : "Araştırma Üniversitesi",
                  count: techMetrics.universityCount,
                  reqTechId: null,
                  reqLabel: "Başlangıçtan Açık",
                  bonus: "+4.5 Bilim/gün · +0.85 Maks. Teknoloji Tavanı",
                  artKey: "OBSERVATORY" as const,
                },
              ] as const
            ).map((edu) => {
              const unlocked =
                !edu.reqTechId ||
                playerNation.unlockedTechs.includes(edu.reqTechId);
              const art = getTechArtwork(edu.artKey, "SCIENCE");

              return (
                <div
                  key={edu.id}
                  data-testid={`edu-network-card-${edu.id}`}
                  className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={art.src}
                      alt={edu.title}
                      loading="eager"
                      decoding="sync"
                      referrerPolicy="no-referrer"
                      className="w-12 h-10 rounded-lg object-cover border border-[#caa15a]/35 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-[#f3ead7]">
                          {edu.title}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#14100c] border border-[#caa15a]/40 font-mono-num text-[10px] font-bold text-[#e0b86e]">
                          Toplam Sv.{edu.count}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-[#e0b86e]">
                        {edu.bonus}
                      </div>
                      <div className="text-[10px] text-[#b8a990]">
                        {unlocked ? (
                          <span className="text-[#e0b86e] inline-flex items-center gap-1">
                            <AoH3GlyphSvg name="check" className="w-2.5 h-2.5" />
                            <span>{edu.reqLabel} Açık</span>
                          </span>
                        ) : (
                          <span className="text-rose-300 inline-flex items-center gap-1">
                            <AoH3GlyphSvg name="lock" className="w-2.5 h-2.5" />
                            <span>{edu.reqLabel} Araştırması Gerekli</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right 6 Cols: Divan-ı Hümayun / Devlet Konseyi Illustrated Ministers */}
      <div className="lg:col-span-6 space-y-3">
        <div className="rounded-2xl bg-[#15110d] border border-[#caa15a]/35 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#e0b86e]" />
                <span>
                  {gameMode === "EMPIRES_1440"
                    ? "Divan-ı Hümayun Erkânı"
                    : "Bakanlar Kurulu"}
                </span>
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                {
                  role:
                    gameMode === "EMPIRES_1440"
                      ? "Sadrazam (Vezir-i Azam)"
                      : "Başbakan & İcra Kurulu",
                  subtitle:
                    gameMode === "EMPIRES_1440"
                      ? "Mühr-ü Hümayun & Merkez İdare"
                      : "Merkezi Koordinasyon",
                  artKey: "COURT" as const,
                  branch: "ADMINISTRATION" as const,
                  statLabel: `İstikrar %${Math.round(
                    playerNation.stability
                  )} · Refah & İdare %${
                    playerNation.budget?.welfare ?? 20
                  }`,
                  effect: playerNation.unlockedTechs.includes("adm_6")
                    ? "+%18 Vergi & +0.70 Günlük İstikrar (Cihanşümul)"
                    : "+%10 Vergi Verimi & +0.35 Günlük İstikrar",
                },
                {
                  role:
                    gameMode === "EMPIRES_1440"
                      ? "Başdefterdar"
                      : "Hazine & Maliye Bakanı",
                  subtitle:
                    gameMode === "EMPIRES_1440"
                      ? "Hazine-i Âmire & Darphane"
                      : "Merkez Bankası & Maliye",
                  artKey: "TREASURY" as const,
                  branch: "ECONOMY" as const,
                  statLabel: `Net Gelir ${
                    playerEconomy.netDailyGold >= 0 ? "+" : ""
                  }${Math.round(playerEconomy.netDailyGold)} A/gün`,
                  effect: `Vergi Oranı %${playerNation.taxRate} · Enflasyon %${playerNation.inflation.toFixed(
                    1
                  )}`,
                },
                {
                  role:
                    gameMode === "EMPIRES_1440"
                      ? "Kazasker & Şeyhülislam"
                      : "Eğitim & Bilim Bakanı",
                  subtitle:
                    gameMode === "EMPIRES_1440"
                      ? "İlmiye, Medreseler & Adalet"
                      : "Akademi & Ar-Ge",
                  artKey: "OBSERVATORY" as const,
                  branch: "SCIENCE" as const,
                  statLabel: `Bilim Bütçesi %${
                    playerNation.budget?.research ?? 15
                  } · +${playerEconomy.dailyResearch.toFixed(1)} RP/gün`,
                  effect: `${
                    techMetrics.schoolCount +
                    techMetrics.highSchoolCount +
                    techMetrics.universityCount
                  } Eğitim Kurumu · Tavan ${techMetrics.maxTechLevel.toFixed(
                    1
                  )}`,
                },
                {
                  role:
                    gameMode === "EMPIRES_1440"
                      ? "Serasker & Yeniçeri Ağası"
                      : "Genelkurmay Başkanı",
                  subtitle:
                    gameMode === "EMPIRES_1440"
                      ? "Kapıkulu & Eyalet Orduları"
                      : "Silahlı Kuvvetler Komutanlığı",
                  artKey: "INFANTRY" as const,
                  branch: "MILITARY" as const,
                  statLabel: `Ordu ${(
                    playerEconomy.totalGarrison / 1000
                  ).toFixed(1)}B · Askerî Sv.${modernizedMilTier}`,
                  effect: `Askerî Bütçe %${
                    playerNation.budget?.military ?? 25
                  } · +${playerEconomy.dailyManpower} İG/gün`,
                },
                {
                  role:
                    gameMode === "EMPIRES_1440"
                      ? "Kaptan-ı Derya"
                      : "Deniz Kuvvetleri Komutanı",
                  subtitle:
                    gameMode === "EMPIRES_1440"
                      ? "Tersane-i Âmire & Donanma"
                      : "Amfibi Filo & Deniz Ticareti",
                  artKey: "NAVAL" as const,
                  branch: "MILITARY" as const,
                  statLabel: `${
                    playerNation.unlockedTechs.filter((id) =>
                      id.endsWith("b")
                    ).length
                  } Deniz/Lojistik Doktrini`,
                  effect:
                    "Deniz aşırı çıkarma ve boğaz geçişlerinde amfibi koruma sağlar",
                },
                {
                  role:
                    gameMode === "EMPIRES_1440"
                      ? "Nişancı & Reisülküttab"
                      : "Dışişleri Bakanı",
                  subtitle:
                    gameMode === "EMPIRES_1440"
                      ? "Tuğra, Ahidnâme & Sefaret"
                      : "Uluslararası Diplomasi",
                  artKey: "TRADE" as const,
                  branch: "ADMINISTRATION" as const,
                  statLabel: `Diplomasi Puanı ${(
                    playerNation.diplomacyPoints ?? 100
                  ).toFixed(0)}/100`,
                  effect: `Agresif Genişleme %${playerNation.aggressiveExpansion.toFixed(
                    0
                  )} · Prestij ${techMetrics.prestige}`,
                },
              ] as const
            ).map((vizier) => {
              const art = getTechArtwork(vizier.artKey, vizier.branch);
              return (
                <div
                  key={vizier.role}
                  className="rounded-xl bg-[#1b1510] border border-[#caa15a]/30 overflow-hidden flex flex-col justify-between"
                >
                  <div
                    className="relative h-14 w-full overflow-hidden border-b border-[#caa15a]/20"
                    style={{ background: art.fallbackGradient }}
                  >
                    <img
                      src={art.src}
                      alt={vizier.role}
                      loading="eager"
                      decoding="sync"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover brightness-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1b1510] via-[#1b1510]/45 to-black/25" />
                    <div className="absolute bottom-1.5 left-2.5 right-2.5">
                      <div className="text-xs font-display font-bold text-[#faf3e3] truncate drop-shadow">
                        {vizier.role}
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="text-[10px] font-semibold text-[#caa15a]">
                      {vizier.subtitle}
                    </div>
                    <div className="text-[10.5px] font-mono-num font-bold text-[#f3ead7]">
                      {vizier.statLabel}
                    </div>
                    <div className="text-[10px] text-[#e0b86e] leading-snug">
                      {vizier.effect}
                    </div>
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
