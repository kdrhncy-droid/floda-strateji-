import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Coins,
  Crown,
  FlaskConical,
  Info,
  Landmark,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ScrollText,
  Sparkles,
  Swords,
  Zap,
  ZoomIn,
} from "lucide-react";
import { TechBranch, TechDefinition } from "../../types/game";
import { CommandDrawersProps } from "./drawerTypes";
import { ArmyModernizationCard } from "./ArmyModernizationCard";
import { getTechArtwork } from "./techArtwork";
import {
  BUILDINGS,
  FORMABLE_EMPIRES,
  IDEOLOGIES,
  computeNationTechMetrics,
  getNationModernizedTier,
  getNationUnlockedMilTier,
  getReformsForMode,
  getTechTreeForMode,
} from "../../data/world2026Data";
import { cleanProvinceName } from "../../utils/formatters";
import { AoH3GlyphName, AoH3GlyphSvg } from "../illustrations/AoH3Illustrations";

const IDEOLOGY_GLYPHS: Record<string, AoH3GlyphName> = {
  DEMOCRACY: "scale",
  AUTHORITARIAN: "shield",
  MONARCHY: "crown",
  SOCIALIST: "star",
  MILITARY_JUNTA: "sword",
  TECHNO_CORPORATISM: "science",
};

const REFORM_GLYPHS: AoH3GlyphName[] = [
  "scroll",
  "sword",
  "anchor",
  "hammer",
  "science",
  "scale",
];

interface BranchConfig {
  id: TechBranch;
  label: string;
  shortLabel: string;
  mainRowLabel: string;
  specRowLabel: string;
  color: string;
  borderTint: string;
  surfaceTint: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const BRANCH_CONFIGS: BranchConfig[] = [
  {
    id: "MILITARY",
    label: "Askerî Doktrin",
    shortLabel: "Askerî",
    mainRowLabel: "Kara & Ateş",
    specRowLabel: "Donanma & Lojistik",
    color: "#e0b86e",
    borderTint: "rgba(202, 161, 90, 0.42)",
    surfaceTint: "rgba(202, 161, 90, 0.14)",
    Icon: Swords,
  },
  {
    id: "ECONOMY",
    label: "Ekonomi & Üretim",
    shortLabel: "Ekonomi",
    mainRowLabel: "Hazine & Sanayi",
    specRowLabel: "Tarım & Ticaret",
    color: "#d4ab62",
    borderTint: "rgba(202, 161, 90, 0.42)",
    surfaceTint: "rgba(202, 161, 90, 0.14)",
    Icon: Coins,
  },
  {
    id: "ADMINISTRATION",
    label: "İdare & Devlet",
    shortLabel: "İdare",
    mainRowLabel: "Merkezi Devlet",
    specRowLabel: "Diplomasi & Hukuk",
    color: "#caa15a",
    borderTint: "rgba(202, 161, 90, 0.42)",
    surfaceTint: "rgba(202, 161, 90, 0.14)",
    Icon: Landmark,
  },
  {
    id: "SCIENCE",
    label: "Bilim & Çağ",
    shortLabel: "Bilim",
    mainRowLabel: "Akademi & Kuram",
    specRowLabel: "Tıp & Mühendislik",
    color: "#e6c785",
    borderTint: "rgba(202, 161, 90, 0.42)",
    surfaceTint: "rgba(202, 161, 90, 0.14)",
    Icon: FlaskConical,
  },
];

const ERA_COLUMNS_1440 = [
  { tier: 1, title: "ÇAĞ I", subtitle: "Erken Doktrin" },
  { tier: 2, title: "ÇAĞ II", subtitle: "Teşkilat & Ocak" },
  { tier: 3, title: "ÇAĞ III", subtitle: "İmparatorluk" },
  { tier: 4, title: "ÇAĞ IV", subtitle: "Cihan Hakimiyeti" },
  { tier: 5, title: "ÇAĞ V", subtitle: "Altın Çağ" },
  { tier: 6, title: "ÇAĞ VI", subtitle: "Cihan Zirvesi" },
];

const ERA_COLUMNS_2026 = [
  { tier: 1, title: "ÇAĞ I", subtitle: "Temel Altyapı" },
  { tier: 2, title: "ÇAĞ II", subtitle: "Modernizasyon" },
  { tier: 3, title: "ÇAĞ III", subtitle: "Süper Güç" },
  { tier: 4, title: "ÇAĞ IV", subtitle: "İleri Teknoloji" },
  { tier: 5, title: "ÇAĞ V", subtitle: "Gelecek Çağı" },
  { tier: 6, title: "ÇAĞ VI", subtitle: "Uzay & Kuantum" },
];

type TreeZoomLevel = 75 | 100 | 115;

const ZOOM_SPECS: Record<
  TreeZoomLevel,
  { minCanvasPx: number; railPx: number; colMinPx: number; cardHeightClass: string; titleClass: string }
> = {
  75: {
    minCanvasPx: 840,
    railPx: 108,
    colMinPx: 112,
    cardHeightClass: "h-[74px]",
    titleClass: "text-[10px]",
  },
  100: {
    minCanvasPx: 1020,
    railPx: 124,
    colMinPx: 138,
    cardHeightClass: "h-[88px]",
    titleClass: "text-[11px]",
  },
  115: {
    minCanvasPx: 1170,
    railPx: 136,
    colMinPx: 162,
    cardHeightClass: "h-[102px]",
    titleClass: "text-xs",
  },
};

function formatShortTechBadge(tech: TechDefinition): string {
  const firstSegment = tech.effectLabel.split("·")[0]?.trim() ?? tech.effectLabel;
  const compact = firstSegment
    .replace(/Muharebe Gücü/g, "Güç")
    .replace(/Ulusal Savunma Gücü/g, "Savunma")
    .replace(/Ulusal Savunma/g, "Savunma")
    .replace(/Deniz Muharebe Gücü/g, "Donanma")
    .replace(/Deniz Gücü/g, "Donanma")
    .replace(/Vergi Geliri/g, "Vergi")
    .replace(/Üretim Geliri/g, "Üretim")
    .replace(/İç Pazar Ticareti/g, "Ticaret")
    .replace(/Ticaret Geliri/g, "Ticaret")
    .replace(/Araştırma Hızı/g, "Bilim")
    .replace(/İnsan Gücü Tavanı/g, "İG Tavanı")
    .replace(/İnsan Gücü/g, "İG")
    .replace(/Nüfus Artışı/g, "Nüfus")
    .replace(/Asimilasyon Hızı/g, "Asim.")
    .replace(/İkmal Limiti/g, "İkmal")
    .replace(/Vasal Haraç Geliri/g, "Vasal")
    .replace(/Vasal Haracı/g, "Vasal")
    .replace(/Agresif Genişleme Kazanımı/g, "AE")
    .replace(/Çekirdek Dışı Huzursuzluk Artışı/g, "İsyan")
    .replace(/Günlük Enflasyon/g, "Enf.")
    .replace(/Günlük Huzursuzluk/g, "İsyan")
    .replace(/Günlük Diplomasi Puanı/g, "Dip.")
    .replace(/İnşa Süresi/g, "İnşa");
  const unlocksUnit = tech.effectLabel.includes("Nesil");
  return unlocksUnit ? `${compact} · +Birim` : compact;
}

export const GovernmentTechDrawer: React.FC<CommandDrawersProps> = ({
  playerNation,
  playerEconomy,
  territories,
  onChangeIdeology,
  onEnactReform,
  onFormEmpire,
  onUnlockTech,
  onStartResearch,
  onCancelResearch,
  onBoostResearch,
  onToggleAutoResearch,
  onUpdateBudget,
  onModernizeNationalArmy,
  onUpgradeBuilding,
  onBatchUpgradeBuilding,
  onSelectTerritory,
  gameMode = "EMPIRES_1440",
}) => {
  const [drawerSection, setDrawerSection] = useState<"TECH" | "DIVAN" | "STATE">("TECH");
  const [branchFilter, setBranchFilter] = useState<"ALL" | TechBranch>("ALL");
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<TreeZoomLevel>(100);

  const techMetrics = useMemo(
    () =>
      computeNationTechMetrics(
        playerNation,
        territories,
        gameMode,
        playerEconomy.dailyResearch
      ),
    [playerNation, territories, gameMode, playerEconomy.dailyResearch]
  );
  const capitalTerritory =
    territories[playerNation.capitalTerritoryId] ??
    Object.values(territories).find(
      (t) => t && t.ownerId === playerNation.id && t.isCapital
    ) ??
    Object.values(territories).find((t) => t && t.ownerId === playerNation.id) ??
    null;

  // Press-and-hold (touch & mouse) + desktop mouse hover rich explanation popover
  const [holdPopoverTechId, setHoldPopoverTechId] = useState<string | null>(null);
  const [hoverPopoverTechId, setHoverPopoverTechId] = useState<string | null>(null);
  const [brokenArtworkIds, setBrokenArtworkIds] = useState<Record<string, boolean>>({});

  const holdTimerRef = useRef<number | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const holdTriggeredRef = useRef(false);
  const suppressHoverTechRef = useRef<string | null>(null);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearHoldTimer();
      clearHoverTimer();
    };
  }, []);

  // Dismiss any active hold popover on global pointerup/blur so it can never get stuck
  useEffect(() => {
    if (!holdPopoverTechId) return;
    const handleGlobalRelease = () => {
      clearHoldTimer();
      setHoldPopoverTechId(null);
      setHoverPopoverTechId(null);
      pointerOriginRef.current = null;
    };
    window.addEventListener("pointerup", handleGlobalRelease);
    window.addEventListener("pointercancel", handleGlobalRelease);
    window.addEventListener("blur", handleGlobalRelease);
    return () => {
      window.removeEventListener("pointerup", handleGlobalRelease);
      window.removeEventListener("pointercancel", handleGlobalRelease);
      window.removeEventListener("blur", handleGlobalRelease);
    };
  }, [holdPopoverTechId]);

  const activeTechTree = useMemo(
    () => getTechTreeForMode(gameMode),
    [gameMode]
  );
  const activeReforms = useMemo(
    () => getReformsForMode(gameMode),
    [gameMode]
  );
  const eraColumns =
    gameMode === "EMPIRES_1440" ? ERA_COLUMNS_1440 : ERA_COLUMNS_2026;

  const activeProj = playerNation.activeResearch;
  const activeTech = activeProj
    ? activeTechTree.find((t) => t.id === activeProj.techId) ?? null
    : null;
  const activePct = activeProj
    ? Math.min(
        100,
        Math.round((activeProj.progress / Math.max(1, activeProj.totalCost)) * 100)
      )
    : 0;
  const activeRemainingRP = activeProj
    ? Math.max(0, activeProj.totalCost - activeProj.progress)
    : 0;
  const dailyResearchRate = Math.max(0.4, playerEconomy.dailyResearch);
  const activeEstDays = activeProj
    ? Math.max(1, Math.ceil(activeRemainingRP / dailyResearchRate))
    : 0;

  const isAutoResearchOn = playerNation.autoResearch === true;
  const unlockedMilTier = getNationUnlockedMilTier(playerNation);
  const modernizedMilTier = getNationModernizedTier(playerNation);
  const hasPendingArmyUpgrade = unlockedMilTier > modernizedMilTier;

  const inspectedTech: TechDefinition | null = useMemo(() => {
    if (selectedTechId) {
      const found = activeTechTree.find((t) => t.id === selectedTechId);
      if (found) return found;
    }
    if (activeTech) return activeTech;
    const firstAvailable = activeTechTree.find(
      (t) =>
        !playerNation.unlockedTechs.includes(t.id) &&
        (!t.prerequisite || playerNation.unlockedTechs.includes(t.prerequisite))
    );
    return firstAvailable ?? activeTechTree[0] ?? null;
  }, [selectedTechId, activeTech, activeTechTree, playerNation.unlockedTechs]);

  const activePopoverTechId = holdPopoverTechId ?? hoverPopoverTechId;
  const popoverTech: TechDefinition | null = useMemo(() => {
    if (!activePopoverTechId) return null;
    return activeTechTree.find((t) => t.id === activePopoverTechId) ?? null;
  }, [activePopoverTechId, activeTechTree]);

  const computeTechMeta = (tech: TechDefinition) => {
    const isUnlocked = playerNation.unlockedTechs.includes(tech.id);
    const isActive = activeProj?.techId === tech.id;
    const prereqMet =
      !tech.prerequisite ||
      playerNation.unlockedTechs.includes(tech.prerequisite);
    const prereqDef = tech.prerequisite
      ? activeTechTree.find((t) => t.id === tech.prerequisite) ?? null
      : null;
    const savedProg = Math.max(
      0,
      Number(playerNation.researchProgressByTech?.[tech.id] ?? 0)
    );
    const currProg = isActive ? activeProj?.progress ?? 0 : savedProg;
    const totalCost = isActive ? activeProj?.totalCost ?? tech.cost : tech.cost;
    const pct = isUnlocked
      ? 100
      : Math.min(100, Math.round((currProg / Math.max(1, totalCost)) * 100));
    const remRp = Math.max(0, totalCost - currProg);
    const estDays = Math.max(1, Math.ceil(remRp / dailyResearchRate));
    const branchCfg =
      BRANCH_CONFIGS.find((b) => b.id === tech.branch) ?? BRANCH_CONFIGS[0];

    return {
      isUnlocked,
      isActive,
      prereqMet,
      prereqDef,
      savedProg,
      currProg,
      totalCost,
      pct,
      estDays,
      branchCfg,
    };
  };

  const inspectedState = useMemo(
    () => (inspectedTech ? computeTechMeta(inspectedTech) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      inspectedTech,
      playerNation.unlockedTechs,
      playerNation.researchProgressByTech,
      activeProj,
      activeTechTree,
      dailyResearchRate,
    ]
  );

  const popoverState = useMemo(
    () => (popoverTech ? computeTechMeta(popoverTech) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      popoverTech,
      playerNation.unlockedTechs,
      playerNation.researchProgressByTech,
      activeProj,
      activeTechTree,
      dailyResearchRate,
    ]
  );

  const handleStartResearch = (techId: string) => {
    if (onStartResearch) {
      onStartResearch(techId);
    } else {
      onUnlockTech(techId);
    }
  };

  const handleNodePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    techId: string
  ) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearHoldTimer();
    clearHoverTimer();
    holdTriggeredRef.current = false;
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };

    holdTimerRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true;
      setHoldPopoverTechId(techId);
      setSelectedTechId(techId);
    }, 240);
  };

  const handleNodePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerOriginRef.current || holdTimerRef.current === null) return;
    const dx = Math.abs(e.clientX - pointerOriginRef.current.x);
    const dy = Math.abs(e.clientY - pointerOriginRef.current.y);
    if (dx > 10 || dy > 10) {
      clearHoldTimer();
      pointerOriginRef.current = null;
    }
  };

  const handleNodePointerRelease = (techId: string) => {
    clearHoldTimer();
    clearHoverTimer();
    pointerOriginRef.current = null;
    if (holdTriggeredRef.current) {
      suppressHoverTechRef.current = techId;
      setHoldPopoverTechId(null);
      setHoverPopoverTechId(null);
    }
  };

  const handleNodePointerEnter = (
    e: React.PointerEvent<HTMLButtonElement>,
    techId: string
  ) => {
    if (e.pointerType !== "mouse") return;
    if (suppressHoverTechRef.current === techId) return;
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverPopoverTechId(techId);
    }, 220);
  };

  const handleNodePointerLeave = (techId: string) => {
    clearHoverTimer();
    if (suppressHoverTechRef.current === techId) {
      suppressHoverTechRef.current = null;
    }
    setHoverPopoverTechId((prev) => (prev === techId ? null : prev));
  };

  const visibleBranches =
    branchFilter === "ALL"
      ? BRANCH_CONFIGS
      : BRANCH_CONFIGS.filter((b) => b.id === branchFilter);

  const zoomSpec = ZOOM_SPECS[zoomLevel];

  return (
    <div className="space-y-2.5 relative">
      {/* Floating Illustrated AoH3 Press-and-Hold / Hover Explanation Card */}
      {popoverTech && popoverState && (
        <div
          data-testid="aoh3-tech-hold-popover"
          role="tooltip"
          className="fixed left-1/2 top-4 sm:top-8 -translate-x-1/2 z-[80] w-[min(92vw,420px)] pointer-events-none rounded-2xl overflow-hidden bg-[#14100c]/98 border-2 border-[#caa15a]/80 shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
        >
          {/* Popover Artwork Banner */}
          <div
            className="relative h-28 sm:h-32 w-full overflow-hidden"
            style={{
              background: getTechArtwork(popoverTech.artKey, popoverTech.branch)
                .fallbackGradient,
            }}
          >
            {!brokenArtworkIds[popoverTech.id] && (
              <img
                src={getTechArtwork(popoverTech.artKey, popoverTech.branch).src}
                alt={popoverTech.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: getTechArtwork(
                    popoverTech.artKey,
                    popoverTech.branch
                  ).objectPosition,
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#14100c] via-[#14100c]/45 to-black/35" />

            {/* Top Meta Kicker */}
            <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[10px] font-mono-num">
              <span
                className="font-sans font-extrabold uppercase tracking-wider drop-shadow"
                style={{ color: popoverState.branchCfg.color }}
              >
                {popoverState.branchCfg.label} ·{" "}
                {(popoverTech.subRow ?? 0) === 0
                  ? popoverState.branchCfg.mainRowLabel
                  : popoverState.branchCfg.specRowLabel}
              </span>
              <span className="font-bold text-amber-200 drop-shadow shrink-0">
                ÇAĞ {popoverTech.tier}
              </span>
            </div>

            {/* Bottom Title over Artwork */}
            <div className="absolute bottom-2 left-3 right-3">
              <h4 className="font-display text-base font-extrabold text-[#f7efe0] leading-tight drop-shadow">
                {popoverTech.name}
              </h4>
            </div>
          </div>

          {/* Popover Gameplay Effect & Full Description */}
          <div className="p-3.5 space-y-2.5">
            <div className="text-xs font-bold text-[#e0b86e] leading-snug">
              {popoverTech.effectLabel}
            </div>

            <p className="text-xs text-[#d6c9b2] leading-relaxed">
              {popoverTech.description}
            </p>

            <div className="pt-2 border-t border-[#caa15a]/25 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-num text-[#b8a990]">
              <div className="flex items-center gap-2">
                <span className="text-[#e0b86e] font-bold">
                  {popoverTech.cost} RP
                </span>
                <span>·</span>
                {popoverState.isUnlocked ? (
                  <span className="text-[#e0b86e] font-sans font-bold">
                    Araştırıldı
                  </span>
                ) : popoverState.isActive ? (
                  <span className="text-[#f3ead7] font-bold">
                    %{popoverState.pct} · ~{popoverState.estDays} Gün
                  </span>
                ) : (
                  <span>~{popoverState.estDays} Gün</span>
                )}
              </div>

              {popoverState.prereqDef ? (
                <span
                  className={`font-sans text-[10.5px] font-semibold inline-flex items-center gap-1 truncate max-w-[200px] ${
                    popoverState.prereqMet ? "text-[#e0b86e]" : "text-rose-300"
                  }`}
                >
                  <AoH3GlyphSvg
                    name={popoverState.prereqMet ? "check" : "lock"}
                    className="w-3 h-3 shrink-0"
                  />
                  <span className="truncate">
                    {popoverState.prereqDef.shortTitle ?? popoverState.prereqDef.name}
                  </span>
                </span>
              ) : (
                <span className="font-sans text-[10.5px] text-[#a79880]">
                  Başlangıç Araştırması
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Mode Switcher: Full-Width AoH3 Tech Tree vs. Divan & Başkent vs. State / Reforms / Empires */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#caa15a]/25">
        <div
          role="tablist"
          aria-label="Hükümet ve Teknoloji Sekmeleri"
          className="flex items-center gap-1 bg-[#120f0c] p-1 rounded-xl border border-[#caa15a]/30 w-full sm:w-auto max-w-full overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={drawerSection === "TECH"}
            data-testid="gov-tab-tech"
            onClick={() => setDrawerSection("TECH")}
            className={`min-h-[44px] flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              drawerSection === "TECH"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                : "text-[#d8cbb5] hover:text-white"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            <span>Teknoloji</span>
            <span
              className={`font-mono-num text-[10px] font-extrabold ${
                drawerSection === "TECH" ? "text-[#14110e]/80" : "text-amber-300"
              }`}
            >
              {playerNation.unlockedTechs.length}/{activeTechTree.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={drawerSection === "DIVAN"}
            data-testid="gov-tab-divan"
            onClick={() => setDrawerSection("DIVAN")}
            className={`min-h-[44px] flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              drawerSection === "DIVAN"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                : "text-[#d8cbb5] hover:text-white"
            }`}
          >
            <Crown className="w-3.5 h-3.5 shrink-0" />
            <span>
              {gameMode === "EMPIRES_1440"
                ? "Divan & Başkent"
                : "Başkent & Eğitim"}
            </span>
            <span
              className={`font-mono-num text-[10px] font-extrabold ${
                drawerSection === "DIVAN" ? "text-[#14110e]/80" : "text-[#e0b86e]"
              }`}
            >
              Sv.{techMetrics.capitalLevel}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={drawerSection === "STATE"}
            data-testid="gov-tab-state"
            onClick={() => setDrawerSection("STATE")}
            className={`min-h-[44px] flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              drawerSection === "STATE"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                : "text-[#d8cbb5] hover:text-white"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Reform</span>
            <span className="hidden sm:inline">Rejim &amp; İmparatorluk</span>
          </button>
        </div>

        {/* Inline Unboxed AoH3 Technology Level & Capital Telemetry */}
        <div
          data-testid="aoh3-tech-level-strip"
          className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#c5b79e] font-mono-num"
        >
          <span>
            Tek. Düzeyi{" "}
            <strong className="text-[#e0b86e]">
              {techMetrics.techLevel.toFixed(2)} / Maks {techMetrics.maxTechLevel.toFixed(1)}
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Aylık{" "}
            <strong className="text-[#e0b86e]">
              +{techMetrics.monthlyTechGrowth.toFixed(2)}
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Başkent{" "}
            <strong className="text-[#f3ead7]">
              Sv.{techMetrics.capitalLevel}/10
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Günlük{" "}
            <strong className="text-[#f3ead7]">
              +{playerEconomy.dailyResearch.toFixed(1)} RP
            </strong>
          </span>
          {hasPendingArmyUpgrade && (
            <>
              <span className="text-[#caa15a]/40">·</span>
              <button
                type="button"
                onClick={onModernizeNationalArmy}
                className="text-xs font-sans font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2 whitespace-nowrap cursor-pointer"
              >
                Orduyu Modernize Et (Sv.{unlockedMilTier})
              </button>
            </>
          )}
        </div>
      </div>

      {drawerSection === "TECH" ? (
        <div className="space-y-2.5" data-testid="aoh3-research-screen">
          {/* AoH3 Active Research Command Strip */}
          <div className="rounded-xl bg-[#16120e] border border-[#caa15a]/40 px-3 py-2 shadow-md space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Active Project Summary with Thumbnail */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-11 h-9 rounded-lg overflow-hidden shrink-0 border border-[#caa15a]/45 relative"
                  style={{
                    background: activeTech
                      ? getTechArtwork(activeTech.artKey, activeTech.branch)
                          .fallbackGradient
                      : "rgba(202, 161, 90, 0.14)",
                  }}
                >
                  {activeTech && !brokenArtworkIds[activeTech.id] ? (
                    <img
                      src={getTechArtwork(activeTech.artKey, activeTech.branch).src}
                      alt={activeTech.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#caa15a]">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#caa15a]">
                      {activeTech ? "Aktif Araştırma" : "Araştırma Beklemede"}
                    </span>
                    {activeTech && (
                      <span className="font-mono-num text-[11px] font-bold text-amber-200">
                        %{activePct} · ~{activeEstDays} Gün
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-display font-bold text-[#f3ead7] truncate">
                    {activeTech
                      ? activeTech.name
                      : "Ağaçtan bir teknoloji seçin veya Otomatik Araştırmayı açın"}
                  </div>
                </div>
              </div>

              {/* Single-Line Controls: Auto-Research Toggle + Boost + Pause + Budget */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto max-w-full">
                {onToggleAutoResearch && (
                  <button
                    type="button"
                    data-testid="auto-research-toggle"
                    aria-pressed={isAutoResearchOn}
                    onClick={onToggleAutoResearch}
                    title="Araştırmalar bittiğinde sıradaki teknolojiyi otomatik başlatır"
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isAutoResearchOn
                        ? "bg-[#251d14] border-[#e0b86e]/65 text-[#e0b86e] hover:bg-[#31261a]"
                        : "bg-[#1e1914] border-[#caa15a]/30 text-[#c5b79e] hover:text-white"
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>Oto: {isAutoResearchOn ? "Açık" : "Kapalı"}</span>
                  </button>
                )}

                {activeProj &&
                  onBoostResearch &&
                  playerNation.researchPoints >= 5 && (
                    <button
                      type="button"
                      onClick={onBoostResearch}
                      title="Birikmiş bilim puanını aktif projeye aktararak süreyi kısalt"
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d9b26b] hover:to-[#ecc77f] text-[#14110e] text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span>Hızlandır</span>
                    </button>
                  )}

                {activeProj && onCancelResearch && (
                  <button
                    type="button"
                    onClick={onCancelResearch}
                    title="Mevcut araştırmayı ilerlemeyi koruyarak duraklat"
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#211b15] hover:bg-rose-950/70 hover:text-rose-200 border border-[#caa15a]/25 text-[11px] font-semibold text-[#d8cbb5] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 shrink-0" />
                    <span>Duraklat</span>
                  </button>
                )}

                {onUpdateBudget && (
                  <div className="flex items-center gap-1 bg-[#100d0a] px-2 py-1 rounded-lg border border-[#caa15a]/25">
                    <span className="text-[10px] text-[#b8a990] mr-0.5 hidden sm:inline">
                      Bütçe
                    </span>
                    {[15, 30, 50].map((bVal) => (
                      <button
                        type="button"
                        key={bVal}
                        onClick={() => onUpdateBudget("research", bVal)}
                        className={`min-h-[26px] px-2 rounded text-[10px] font-mono-num font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          (playerNation.budget?.research || 15) === bVal
                            ? "bg-[#caa15a] text-[#14110e]"
                            : "text-[#c5b79e] hover:text-white hover:bg-white/5"
                        }`}
                      >
                        %{bVal}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Research Progress Bar */}
            {activeProj && activeTech && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#e0b86e] font-semibold truncate pr-2">
                    {activeTech.effectLabel}
                  </span>
                  <span className="font-mono-num text-[#d8cbb5] shrink-0">
                    {activeProj.progress.toFixed(1)} / {activeProj.totalCost} RP
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#0d0b08] border border-[#caa15a]/30 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8f6a34] via-[#caa15a] to-[#f3ead7] transition-all duration-300"
                    style={{ width: `${Math.max(3, activePct)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Branch Filters + Zoom Controls + Press-and-Hold Hint */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
              <button
                type="button"
                onClick={() => setBranchFilter("ALL")}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  branchFilter === "ALL"
                    ? "bg-[#caa15a]/20 border-[#caa15a] text-[#f3ead7]"
                    : "bg-[#15110d] border-[#caa15a]/20 text-[#b8a990] hover:text-white"
                }`}
              >
                Tümü ({activeTechTree.length})
              </button>
              {BRANCH_CONFIGS.map((br) => {
                const BranchIcon = br.Icon;
                const unlockedInBranch = activeTechTree.filter(
                  (t) =>
                    t.branch === br.id &&
                    playerNation.unlockedTechs.includes(t.id)
                ).length;
                const totalInBranch = activeTechTree.filter(
                  (t) => t.branch === br.id
                ).length;
                const isSelected = branchFilter === br.id;
                return (
                  <button
                    type="button"
                    key={br.id}
                    onClick={() => setBranchFilter(br.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? "bg-[#211b14] text-[#f3ead7]"
                        : "bg-[#15110d] border-[#caa15a]/20 text-[#b8a990] hover:text-white"
                    }`}
                    style={isSelected ? { borderColor: br.color } : undefined}
                  >
                    <BranchIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{br.shortLabel}</span>
                    <span className="font-mono-num text-[10px] opacity-80">
                      {unlockedInBranch}/{totalInBranch}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10.5px] text-[#b8a990] whitespace-nowrap">
                Basılı tut: Açıklama
              </span>
              <div
                className="flex items-center gap-0.5 bg-[#120f0c] p-0.5 rounded-lg border border-[#caa15a]/25"
                aria-label="Ağaç yakınlaştırma"
              >
                <ZoomIn className="w-3 h-3 text-[#caa15a] mx-1 shrink-0" />
                {([75, 100, 115] as TreeZoomLevel[]).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num font-bold transition-colors cursor-pointer ${
                      zoomLevel === z
                        ? "bg-[#caa15a] text-[#14110e]"
                        : "text-[#b8a990] hover:text-white"
                    }`}
                  >
                    %{z}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grand Illustrated 40-Tech Age of History 3 Horizontal Tree Canvas */}
          <div
            data-testid="aoh3-tech-tree-canvas"
            className="rounded-xl bg-[#0f0c09] border border-[#caa15a]/45 p-2 sm:p-3 overflow-x-auto overflow-y-auto max-h-[45vh] sm:max-h-[49vh] shadow-inner"
          >
            <div
              className="space-y-3"
              style={{ minWidth: `${zoomSpec.minCanvasPx}px` }}
            >
              {/* Era Column Headers (Çağ I -> Çağ VI) — scrolls naturally with the tree on iPhone so Dal · Hat never covers lower branches */}
              <div
                className="grid gap-2.5 pb-2 border-b border-[#caa15a]/25 items-center bg-[#0f0c09]"
                style={{
                  gridTemplateColumns: `${zoomSpec.railPx}px repeat(6, minmax(${zoomSpec.colMinPx}px, 1fr))`,
                }}
              >
                <div className="px-2 py-1 text-[10px] font-display font-bold uppercase tracking-wider text-[#b8a990]">
                  Dal · Hat
                </div>
                {eraColumns.map((col) => (
                  <div
                    key={col.tier}
                    className="px-2.5 py-1 rounded-lg bg-[#1a1510] border border-[#caa15a]/25 flex items-center justify-between gap-1"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-display font-extrabold text-amber-300 tracking-wide truncate">
                        {col.title}
                      </div>
                      <div className="text-[9px] text-[#a79880] truncate">
                        {col.subtitle}
                      </div>
                    </div>
                    <span className="font-mono-num text-[10px] font-bold text-[#caa15a] shrink-0">
                      {col.tier}
                    </span>
                  </div>
                ))}
              </div>

              {/* 4 Branch Clusters × 2 Parallel Tracks (40 Illustrated Cards) */}
              <div className="space-y-3">
                {visibleBranches.map((branch) => {
                  const BranchIcon = branch.Icon;
                  const branchTechs = activeTechTree.filter(
                    (t) => t.branch === branch.id
                  );
                  const unlockedCount = branchTechs.filter((t) =>
                    playerNation.unlockedTechs.includes(t.id)
                  ).length;

                  return (
                    <div
                      key={branch.id}
                      data-testid={`aoh3-branch-row-${branch.id}`}
                      className="rounded-xl bg-[#14100c]/85 border p-2 space-y-2"
                      style={{ borderColor: branch.borderTint }}
                    >
                      {([0, 1] as const).map((subRow) => {
                        const rowTechs = branchTechs.filter(
                          (t) => (t.subRow ?? 0) === subRow
                        );
                        const rowLabel =
                          subRow === 0
                            ? branch.mainRowLabel
                            : branch.specRowLabel;

                        return (
                          <div
                            key={`${branch.id}_row_${subRow}`}
                            className="grid gap-2.5 items-stretch"
                            style={{
                              gridTemplateColumns: `${zoomSpec.railPx - 16}px repeat(6, minmax(${zoomSpec.colMinPx}px, 1fr))`,
                            }}
                          >
                            {/* Compact Track Label Cell */}
                            <div
                              className="rounded-lg px-2 py-1.5 bg-[#19140f] border border-[#caa15a]/15 flex flex-col justify-between"
                            >
                              {subRow === 0 ? (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                    style={{
                                      backgroundColor: branch.surfaceTint,
                                      color: branch.color,
                                    }}
                                  >
                                    <BranchIcon className="w-3 h-3" />
                                  </span>
                                  <span className="text-[10.5px] font-display font-bold text-[#f3ead7] truncate">
                                    {branch.shortLabel}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className="text-[9.5px] font-bold uppercase tracking-wider truncate"
                                  style={{ color: branch.color }}
                                >
                                  Uzmanlık
                                </span>
                              )}

                              <div className="space-y-0.5">
                                <div className="text-[9.5px] text-[#c5b79e] leading-tight line-clamp-1">
                                  {rowLabel}
                                </div>
                                {subRow === 0 && (
                                  <div className="font-mono-num text-[9.5px] text-[#9f917a]">
                                    <span
                                      className="font-bold"
                                      style={{ color: branch.color }}
                                    >
                                      {unlockedCount}
                                    </span>
                                    /{branchTechs.length}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 6 Era Illustrated Tech Cards Connected Horizontally */}
                            {[1, 2, 3, 4, 5, 6].map((tierNum) => {
                              const tech = rowTechs.find(
                                (t) => t.tier === tierNum
                              );
                              if (!tech) {
                                return (
                                  <div
                                    key={tierNum}
                                    className="rounded-lg border border-dashed border-[#caa15a]/15 bg-[#120e0b]/40"
                                  />
                                );
                              }

                              const isUnlocked =
                                playerNation.unlockedTechs.includes(tech.id);
                              const isActive = activeProj?.techId === tech.id;
                              const savedProg = Math.max(
                                0,
                                Number(
                                  playerNation.researchProgressByTech?.[tech.id] ??
                                    0
                                )
                              );
                              const hasSavedProg = !isActive && savedProg > 0;
                              const currProg = isActive
                                ? activeProj?.progress ?? 0
                                : savedProg;
                              const pct = isUnlocked
                                ? 100
                                : Math.min(
                                    100,
                                    Math.round(
                                      (currProg / Math.max(1, tech.cost)) * 100
                                    )
                                  );
                              const prereqMet =
                                !tech.prerequisite ||
                                playerNation.unlockedTechs.includes(
                                  tech.prerequisite
                                );
                              const isSelected = inspectedTech?.id === tech.id;
                              const isHeld = holdPopoverTechId === tech.id;
                              const artwork = getTechArtwork(
                                tech.artKey,
                                tech.branch
                              );

                              return (
                                <div
                                  key={tech.id}
                                  className="relative flex items-center"
                                >
                                  {/* Horizontal Prerequisite Connector Rail */}
                                  {tierNum > 1 && (
                                    <div
                                      aria-hidden="true"
                                      className={`absolute -left-2.5 top-1/2 -translate-y-1/2 w-2.5 h-[2px] ${
                                        isUnlocked
                                          ? "bg-[#e0b86e]"
                                          : isActive
                                          ? "bg-[#f3ead7]"
                                          : prereqMet
                                          ? "bg-[#caa15a]/70"
                                          : "bg-[#3d3226]/75"
                                      }`}
                                    />
                                  )}

                                  <button
                                    type="button"
                                    data-testid={`tech-node-${tech.id}`}
                                    onPointerDown={(e) =>
                                      handleNodePointerDown(e, tech.id)
                                    }
                                    onPointerMove={handleNodePointerMove}
                                    onPointerUp={() =>
                                      handleNodePointerRelease(tech.id)
                                    }
                                    onPointerCancel={() =>
                                      handleNodePointerRelease(tech.id)
                                    }
                                    onPointerEnter={(e) =>
                                      handleNodePointerEnter(e, tech.id)
                                    }
                                    onPointerLeave={() =>
                                      handleNodePointerLeave(tech.id)
                                    }
                                    onContextMenu={(e) => e.preventDefault()}
                                    onClick={() => {
                                      if (holdTriggeredRef.current) {
                                        holdTriggeredRef.current = false;
                                        return;
                                      }
                                      if (
                                        isSelected &&
                                        !isUnlocked &&
                                        !isActive &&
                                        prereqMet
                                      ) {
                                        handleStartResearch(tech.id);
                                      } else {
                                        setSelectedTechId(tech.id);
                                      }
                                    }}
                                    onDoubleClick={() => {
                                      if (!isUnlocked && !isActive && prereqMet) {
                                        handleStartResearch(tech.id);
                                      }
                                    }}
                                    style={{
                                      background: artwork.fallbackGradient,
                                    }}
                                    className={`group w-full ${zoomSpec.cardHeightClass} rounded-lg border text-left relative overflow-hidden select-none touch-pan-x touch-pan-y transition-all cursor-pointer ${
                                      isUnlocked
                                        ? "border-[#e0b86e]/90 shadow-sm shadow-[#caa15a]/15"
                                        : isActive
                                        ? "border-[#f3ead7] shadow-md shadow-[#caa15a]/25"
                                        : prereqMet
                                        ? "border-[#caa15a]/55 hover:border-[#ebd090]"
                                        : "border-[#3d3226]/80 opacity-65 hover:opacity-90"
                                    } ${
                                      isSelected || isHeld
                                        ? "ring-2 ring-[#f6ecd7] ring-offset-1 ring-offset-[#0f0c09]"
                                        : ""
                                    }`}
                                  >
                                    {/* Full-Bleed Historical Artwork */}
                                    {!brokenArtworkIds[tech.id] && (
                                      <img
                                        src={artwork.src}
                                        alt={tech.shortTitle ?? tech.name}
                                        loading="eager"
                                        decoding="sync"
                                        draggable={false}
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          const el = e.currentTarget;
                                          if (!el.dataset.retried) {
                                            el.dataset.retried = '1';
                                            el.src = `${artwork.src}${artwork.src.includes('?') ? '&' : '?'}r=1`;
                                            return;
                                          }
                                          setBrokenArtworkIds((prev) => ({
                                            ...prev,
                                            [tech.id]: true,
                                          }));
                                        }}
                                        style={{
                                          objectPosition: artwork.objectPosition,
                                        }}
                                        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${
                                          !prereqMet && !isUnlocked && !isActive
                                            ? "grayscale-[55%] brightness-75"
                                            : isUnlocked
                                            ? "brightness-95"
                                            : "brightness-90"
                                        }`}
                                      />
                                    )}

                                    {/* Measured Dark Scrim for Crisp Title Legibility */}
                                    <div
                                      aria-hidden="true"
                                      className="absolute inset-0 bg-gradient-to-t from-[#090705]/95 via-[#090705]/35 to-[#090705]/45"
                                    />

                                    {/* Top Row Over Image: Status Glyph + Compact RP / % */}
                                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 z-10">
                                      <span
                                        className={`w-4 h-4 rounded-sm flex items-center justify-center ${
                                          isUnlocked
                                            ? "bg-[#251d14]/90 text-[#e0b86e]"
                                            : isActive
                                            ? "bg-[#2f2314]/90 text-[#f3ead7]"
                                            : prereqMet
                                            ? "bg-black/65 text-[#e8c682]"
                                            : "bg-black/75 text-[#8e806a]"
                                        }`}
                                      >
                                        {isUnlocked ? (
                                          <Check className="w-3 h-3" />
                                        ) : isActive ? (
                                          <Sparkles className="w-3 h-3" />
                                        ) : prereqMet ? (
                                          <Play className="w-2.5 h-2.5" />
                                        ) : (
                                          <Lock className="w-2.5 h-2.5" />
                                        )}
                                      </span>

                                      <span
                                        className={`font-mono-num text-[9.5px] font-extrabold px-1 py-0.5 rounded bg-black/65 leading-none inline-flex items-center ${
                                          isUnlocked
                                            ? "text-[#e0b86e]"
                                            : isActive
                                            ? "text-[#f3ead7]"
                                            : prereqMet
                                            ? "text-[#f3ead7]"
                                            : "text-[#8e806a]"
                                        }`}
                                      >
                                        {isUnlocked ? (
                                          <AoH3GlyphSvg name="check" className="w-2.5 h-2.5" />
                                        ) : isActive ? (
                                          `%${pct}`
                                        ) : (
                                          `${tech.cost}`
                                        )}
                                      </span>
                                    </div>

                                    {/* Small Crisp Title + Short Effect Badge Overlay on Bottom of Image */}
                                    <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10 space-y-0.5">
                                      <div
                                        className={`${zoomSpec.titleClass} font-display font-bold text-[#faf3e3] leading-tight line-clamp-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]`}
                                      >
                                        {tech.shortTitle ?? tech.name}
                                      </div>
                                      <div className="text-[9.5px] font-mono-num font-bold text-[#e0b86e] leading-none line-clamp-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                                        {formatShortTechBadge(tech)}
                                      </div>
                                    </div>

                                    {/* Embedded Bottom Progress Strip */}
                                    {(isActive || hasSavedProg) && (
                                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/75 z-20">
                                        <div
                                          className={`h-full transition-all ${
                                            isActive
                                              ? "bg-amber-400"
                                              : "bg-amber-600/85"
                                          }`}
                                          style={{
                                            width: `${Math.max(6, pct)}%`,
                                          }}
                                        />
                                      </div>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AoH3 Selected Technology Action Strip */}
          {inspectedTech && inspectedState && (
            <div
              data-testid="aoh3-tech-inspector"
              className="rounded-xl bg-[#17130f] border border-[#caa15a]/45 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-12 h-11 rounded-lg overflow-hidden shrink-0 border border-[#caa15a]/40 hidden xs:block sm:block"
                  style={{
                    background: getTechArtwork(
                      inspectedTech.artKey,
                      inspectedTech.branch
                    ).fallbackGradient,
                  }}
                >
                  {!brokenArtworkIds[inspectedTech.id] && (
                    <img
                      src={
                        getTechArtwork(
                          inspectedTech.artKey,
                          inspectedTech.branch
                        ).src
                      }
                      alt={inspectedTech.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 space-y-0.5 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono-num text-[#b8a990]">
                    <span
                      className="font-sans font-bold uppercase tracking-wider"
                      style={{ color: inspectedState.branchCfg.color }}
                    >
                      {inspectedState.branchCfg.shortLabel}
                    </span>
                    <span>·</span>
                    <span>Çağ {inspectedTech.tier}</span>
                    <span>·</span>
                    <span className="text-amber-300 font-bold">
                      {inspectedTech.cost} RP
                    </span>
                    {!inspectedState.isUnlocked && (
                      <>
                        <span>·</span>
                        <span>~{inspectedState.estDays} Gün</span>
                      </>
                    )}
                    {inspectedState.prereqDef && (
                      <>
                        <span>·</span>
                        <span
                          className={
                            inspectedState.prereqMet
                              ? "text-[#e0b86e]"
                              : "text-rose-300"
                          }
                        >
                          Ön Koşul:{" "}
                          {inspectedState.prereqDef.shortTitle ??
                            inspectedState.prereqDef.name}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h4 className="text-xs sm:text-sm font-display font-bold text-[#f3ead7]">
                      {inspectedTech.name}
                    </h4>
                    <span className="text-[11px] font-semibold text-[#e0b86e]">
                      {inspectedTech.effectLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setHoverPopoverTechId((prev) =>
                      prev === inspectedTech.id ? null : inspectedTech.id
                    )
                  }
                  aria-label="Teknoloji açıklamasını göster"
                  title="Basılı tutun veya dokunun: Tam açıklama"
                  className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    hoverPopoverTechId === inspectedTech.id
                      ? "bg-[#caa15a]/25 border-[#caa15a] text-[#f3ead7]"
                      : "bg-[#1d1711] border-[#caa15a]/30 text-[#d8cbb5] hover:text-white"
                  }`}
                >
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xs:inline">Detay</span>
                </button>
                <button
                  type="button"
                  data-testid="aoh3-inspector-action-btn"
                  disabled={
                    inspectedState.isUnlocked ||
                    inspectedState.isActive ||
                    !inspectedState.prereqMet
                  }
                  onClick={() => handleStartResearch(inspectedTech.id)}
                  className={`min-h-[44px] flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
                    inspectedState.isUnlocked
                      ? "bg-[#241c13] text-[#e0b86e] border border-[#e0b86e]/45 cursor-default"
                      : inspectedState.isActive
                      ? "bg-[#251d14] text-[#f3ead7] border border-[#caa15a]/60 cursor-default"
                      : inspectedState.prereqMet
                      ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d9b26b] hover:to-[#ecc77f] text-[#14110e] shadow-md"
                      : "bg-[#120f0c] text-[#7c6f5c] border border-[#352b20] cursor-not-allowed"
                  }`}
                >
                  {inspectedState.isUnlocked ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Açıldı</span>
                    </>
                  ) : inspectedState.isActive ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Araştırılıyor (%{inspectedState.pct})</span>
                    </>
                  ) : !inspectedState.prereqMet ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Ön Koşul Gerekli</span>
                    </>
                  ) : inspectedState.savedProg > 0 ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Devam Et (%{inspectedState.pct})</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Araştırmaya Başla</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : drawerSection === "DIVAN" ? (
        /* DIVAN & BAŞKENT TAB: AoH3 Capital Level, Educational Infrastructure & Court Council */
        <div
          data-testid="aoh3-divan-screen"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4"
        >
          {/* Left 6 Cols: Capital Palace & Scenario Technology Capacity */}
          <div className="lg:col-span-6 space-y-3">
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

                {/* Direct Capital Palace Upgrade Action */}
                {capitalTerritory &&
                  (() => {
                    const palaceDef = BUILDINGS.find(
                      (b) => b.id === "capitalPalace"
                    );
                    const curLvl =
                      capitalTerritory.buildings.capitalPalace ?? 0;
                    const maxLvl = palaceDef?.maxLevel ?? 5;
                    const isMax = curLvl >= maxLvl;
                    const hasAdm1 =
                      playerNation.unlockedTechs.includes("adm_1");
                    const cost = Math.round(
                      (palaceDef?.baseCost ?? 500) * Math.pow(1.35, curLvl)
                    );
                    const queued = capitalTerritory.constructionQueue?.find(
                      (q) => q.building === "capitalPalace"
                    );
                    const canUpgrade =
                      hasAdm1 &&
                      !isMax &&
                      !queued &&
                      playerNation.treasury >= cost;

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

                        <button
                          type="button"
                          data-testid="upgrade-capital-palace-btn"
                          disabled={!canUpgrade}
                          onClick={() =>
                            onUpgradeBuilding(
                              capitalTerritory.id,
                              "capitalPalace"
                            )
                          }
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1 ${
                            !hasAdm1
                              ? "bg-[#120e0a] text-rose-300 border border-rose-500/35 cursor-not-allowed"
                              : queued
                              ? "bg-[#241c13] text-[#e0b86e] border border-[#caa15a]/40 cursor-default"
                              : isMax
                              ? "bg-[#241c13] text-[#e0b86e] border border-[#e0b86e]/40 cursor-default"
                              : canUpgrade
                              ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow"
                              : "bg-[#120e0a] text-[#8e806a] border border-[#caa15a]/20 cursor-not-allowed"
                          }`}
                        >
                          {!hasAdm1 ? (
                            <>
                              <AoH3GlyphSvg name="lock" className="w-3 h-3 shrink-0" />
                              <span>İdare Çağ I (adm_1) Gerekli</span>
                            </>
                          ) : queued ? (
                            `İnşa Sürüyor (${
                              queued.totalDays - queued.progressDays
                            }g)`
                          ) : isMax ? (
                            <>
                              <AoH3GlyphSvg name="check" className="w-3 h-3 shrink-0" />
                              <span>Maksimum Seviye</span>
                            </>
                          ) : (
                            `Sarayı Yükselt (${cost} Altın)`
                          )}
                        </button>
                      </div>
                    );
                  })()}
              </div>
            </div>

            {/* AoH3 Tech-Gated Educational Network Card (İlkokul/Mektep, Ortaokul/Medrese, Üniversite/Darülfünun) */}
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
                  const bDef = BUILDINGS.find((b) => b.id === edu.id);
                  const unlocked =
                    !edu.reqTechId ||
                    playerNation.unlockedTechs.includes(edu.reqTechId);
                  const capLvl = capitalTerritory
                    ? capitalTerritory.buildings[edu.id] ?? 0
                    : 0;
                  const cost = Math.round(
                    (bDef?.baseCost ?? 220) * Math.pow(1.35, capLvl)
                  );
                  const art = getTechArtwork(edu.artKey, "SCIENCE");
                  const canBuildInCap =
                    Boolean(capitalTerritory) &&
                    unlocked &&
                    capLvl < (bDef?.maxLevel ?? 5) &&
                    playerNation.treasury >= cost &&
                    !capitalTerritory?.constructionQueue?.some(
                      (q) => q.building === edu.id
                    );

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

                      <div className="flex items-center gap-1.5 shrink-0">
                        {capitalTerritory && (
                          <button
                            type="button"
                            disabled={!canBuildInCap}
                            onClick={() =>
                              onUpgradeBuilding(capitalTerritory.id, edu.id)
                            }
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                              canBuildInCap
                                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]"
                                : "bg-[#120e0a] text-[#8e806a] border border-[#caa15a]/20 cursor-not-allowed"
                            }`}
                          >
                            {!unlocked
                              ? "Kilitli"
                              : capLvl >= (bDef?.maxLevel ?? 5)
                              ? "Başkentte Maks"
                              : `Başkente Kur (${cost}A)`}
                          </button>
                        )}
                        {onBatchUpgradeBuilding && unlocked && (
                          <button
                            type="button"
                            onClick={() => onBatchUpgradeBuilding(edu.id)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#241c14] hover:bg-[#2f2419] border border-[#caa15a]/35 text-[11px] font-bold text-[#e0b86e] cursor-pointer"
                            title="Hazine yettiğince uygun eyaletlerde toplu inşa başlatır"
                          >
                            Toplu Kur
                          </button>
                        )}
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
                      effect:
                        playerNation.unlockedTechs.includes("adm_6")
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
      ) : (
        /* STATE TAB: Ideology, Reforms, Army Modernization & Formable Empires */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 6 Cols: Ideology + Army Modernization */}
          <div className="lg:col-span-6 space-y-4">
            <ArmyModernizationCard
              playerNation={playerNation}
              totalGarrison={playerEconomy.totalGarrison}
              gameMode={gameMode}
              onModernizeNationalArmy={onModernizeNationalArmy}
            />

            <div className="bg-[#15110d] border border-[#caa15a]/30 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-display font-bold text-[#f3ead7]">
                Devlet İdeolojisi ve Rejim Seçimi
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(IDEOLOGIES).map((ideo) => {
                  const isCurrent = playerNation.ideology === ideo.id;
                  const glyphName = IDEOLOGY_GLYPHS[ideo.id] ?? "crown";
                  return (
                    <button
                      type="button"
                      key={ideo.id}
                      onClick={() => onChangeIdeology(ideo.id)}
                      aria-pressed={isCurrent}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                        isCurrent
                          ? "bg-[#241c13] border-2 border-[#e0b86e] text-[#faf3e3] shadow-lg"
                          : "bg-[#1a1510] border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/55"
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isCurrent
                            ? "bg-[#2c2216] border-[#e0b86e]/60 text-[#e0b86e]"
                            : "bg-[#14100c] border-[#caa15a]/30 text-[#caa15a]"
                        }`}
                        aria-hidden="true"
                      >
                        <AoH3GlyphSvg name={glyphName} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#faf3e3] truncate">
                          {ideo.name}
                        </div>
                        <div className="text-[10px] font-mono-num text-[#d8cbb5] mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#e0b86e]">
                            Vergi{" "}
                            {ideo.taxBonus >= 0
                              ? `+${ideo.taxBonus}`
                              : ideo.taxBonus}
                          </span>
                          <span className="opacity-40">·</span>
                          <span
                            className={
                              ideo.militaryAttackBonus < 0
                                ? "text-rose-300"
                                : "text-[#f3ead7]"
                            }
                          >
                            Ordu{" "}
                            {ideo.militaryAttackBonus >= 0
                              ? `+${ideo.militaryAttackBonus}`
                              : ideo.militaryAttackBonus}
                          </span>
                          {isCurrent && (
                            <>
                              <span className="opacity-40">·</span>
                              <span className="text-[#e0b86e] font-bold">
                                Aktif
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 6 Cols: National Reforms + Formable Empires */}
          <div className="lg:col-span-6 space-y-4">
            {/* National Reforms */}
            <div className="bg-[#15110d] border border-[#caa15a]/30 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-display font-bold text-[#f3ead7]">
                Ulusal Reformlar ve Kanunlar
              </h3>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {activeReforms.map((ref, reformIndex) => {
                  const enacted = playerNation.enactedReforms.includes(ref.id);
                  const canAfford =
                    !enacted &&
                    playerNation.treasury >= ref.costGold &&
                    playerNation.researchPoints >= ref.costResearch;
                  const reformGlyph =
                    REFORM_GLYPHS[reformIndex % REFORM_GLYPHS.length];
                  return (
                    <div
                      key={ref.id}
                      className="bg-[#1b1611] border border-[#caa15a]/25 rounded-xl p-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-[#241c13] border border-[#caa15a]/35 text-[#e0b86e] flex items-center justify-center shrink-0">
                          <AoH3GlyphSvg name={reformGlyph} className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#faf3e3] truncate">
                            {ref.name}
                          </div>
                          <div className="text-[10px] text-[#e0b86e] line-clamp-1">
                            {ref.effectLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onEnactReform(ref.id)}
                        className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap cursor-pointer ${
                          enacted
                            ? "bg-[#241c13] text-[#e0b86e] border border-[#e0b86e]/40 cursor-default"
                            : canAfford
                            ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e]"
                            : "bg-[#120f0c] text-[#7c6f5c] border border-[#352b20] cursor-not-allowed"
                        }`}
                      >
                        {enacted
                          ? "Yürürlükte"
                          : `${ref.costGold}G · ${ref.costResearch} RP`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Formable Empires */}
            <div className="bg-[#15110d] border border-[#caa15a]/45 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-display font-bold text-[#e0b86e] flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#caa15a] shrink-0" />
                  <span>Tarihi İmparatorluk İlanı</span>
                </h3>
                <span className="font-mono-num text-xs text-[#b8a990] whitespace-nowrap">
                  {playerEconomy.territoryCount} Eyalet ·{" "}
                  {playerNation.unlockedTechs.length} Tek.
                </span>
              </div>
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {FORMABLE_EMPIRES.filter(
                  (emp) =>
                    !emp.allowedNationIds ||
                    emp.allowedNationIds.includes(playerNation.id)
                ).map((emp) => {
                  const alreadyFormed = playerNation.formedEmpireId === emp.id;
                  const reqTechs = emp.requiredTechCount ?? 0;
                  const reqGold = emp.goldCost ?? 0;
                  const reqIds = emp.requiredTerritoryIds ?? [];
                  const reqNames = emp.requiredTerritoryNames ?? [];
                  const hasProvinces =
                    playerEconomy.territoryCount >= emp.requiredProvinces;
                  const hasTechs =
                    playerNation.unlockedTechs.length >= reqTechs;
                  const hasGold = playerNation.treasury >= reqGold;
                  const missingCityIndices = reqIds
                    .map((tid, idx) =>
                      territories[tid]?.ownerId === playerNation.id ? -1 : idx
                    )
                    .filter((idx) => idx >= 0);
                  const hasAllKeyCities = missingCityIndices.length === 0;

                  const canForm =
                    !alreadyFormed &&
                    hasProvinces &&
                    hasTechs &&
                    hasGold &&
                    hasAllKeyCities;

                  return (
                    <div
                      key={emp.id}
                      className="bg-[#1b1611] border border-[#caa15a]/25 rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#faf3e3]">
                            {emp.name}
                          </div>
                          <div className="text-[11px] text-[#e0b86e] font-semibold mt-0.5">
                            {emp.bonusSummary}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!canForm}
                          onClick={() => onFormEmpire(emp.id)}
                          className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap cursor-pointer ${
                            alreadyFormed
                              ? "bg-[#241c13] text-[#e0b86e] border border-[#e0b86e]/45 cursor-default"
                              : canForm
                              ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                              : "bg-[#120f0c] text-[#7c6f5c] border border-[#352b20] cursor-not-allowed"
                          }`}
                        >
                          {alreadyFormed
                            ? "İlan Edildi"
                            : canForm
                            ? "İmparatorluğu İlan Et"
                            : "Şartlar Eksik"}
                        </button>
                      </div>

                      {!alreadyFormed && (
                        <div className="pt-2 border-t border-[#caa15a]/15 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] font-mono-num">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              hasProvinces
                                ? "text-[#e0b86e]"
                                : "text-[#8e806a]"
                            }`}
                          >
                            <AoH3GlyphSvg
                              name={hasProvinces ? "check" : "lock"}
                              className="w-2.5 h-2.5 shrink-0"
                            />
                            <span>
                              {playerEconomy.territoryCount}/{emp.requiredProvinces}{" "}
                              Eyalet
                            </span>
                          </span>

                          {reqTechs > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 ${
                                hasTechs ? "text-[#e0b86e]" : "text-[#8e806a]"
                              }`}
                            >
                              <AoH3GlyphSvg
                                name={hasTechs ? "check" : "lock"}
                                className="w-2.5 h-2.5 shrink-0"
                              />
                              <span>
                                {playerNation.unlockedTechs.length}/{reqTechs}{" "}
                                Teknoloji
                              </span>
                            </span>
                          )}

                          {reqGold > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 ${
                                hasGold ? "text-[#e0b86e]" : "text-[#8e806a]"
                              }`}
                            >
                              <AoH3GlyphSvg
                                name={hasGold ? "check" : "lock"}
                                className="w-2.5 h-2.5 shrink-0"
                              />
                              <span>{reqGold} Altın</span>
                            </span>
                          )}

                          {reqIds.map((tid, idx) => {
                            const isOwned =
                              territories[tid]?.ownerId === playerNation.id;
                            const cityName =
                              reqNames[idx] || territories[tid]?.name || tid;
                            return (
                              <span
                                key={tid}
                                className={`inline-flex items-center gap-1 ${
                                  isOwned ? "text-[#e0b86e]" : "text-rose-300"
                                }`}
                              >
                                <AoH3GlyphSvg
                                  name={isOwned ? "check" : "lock"}
                                  className="w-2.5 h-2.5 shrink-0"
                                />
                                <AoH3GlyphSvg name="star" className="w-2.5 h-2.5 shrink-0" />
                                <span>{cityName}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
