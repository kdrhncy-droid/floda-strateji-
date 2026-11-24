import React, { useState } from "react";
import { Check, Crown, FlaskConical } from "lucide-react";
import { TechBranch } from "../../types/game";
import { CommandDrawersProps } from "./drawerTypes";
import { ArmyModernizationCard } from "./ArmyModernizationCard";
import {
  FORMABLE_EMPIRES,
  IDEOLOGIES,
  getReformsForMode,
  getTechTreeForMode,
} from "../../data/world2026Data";

const IDEOLOGY_GLYPHS: Record<string, string> = {
  DEMOCRACY: '⚖',
  AUTHORITARIAN: '◈',
  MONARCHY: '♛',
  SOCIALIST: '★',
  MILITARY_JUNTA: '⚔',
  TECHNO_CORPORATISM: '✦',
};

const REFORM_GLYPHS = ['◉', '⚔', '⚓', '⚒', '✦', '⚖'];
const TECH_BRANCH_META: Record<string, { glyph: string; color: string }> = {
  MILITARY: { glyph: '⚔', color: '#e07b7b' },
  ECONOMY: { glyph: '◉', color: '#e0ad52' },
  ADMINISTRATION: { glyph: '♜', color: '#67c99b' },
  SCIENCE: { glyph: '✦', color: '#62b7d7' },
};

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
  onUpdateBudget,
  onModernizeNationalArmy,
  gameMode = "EMPIRES_1440",
}) => {
  const [techBranchFilter, setTechBranchFilter] = useState<TechBranch>("MILITARY");
  const activeTechTree = getTechTreeForMode(gameMode);
  const activeReforms = getReformsForMode(gameMode);

  // Active Research Project Calculations
  const activeProj = playerNation.activeResearch;
  const activeTech = activeProj
    ? activeTechTree.find((t) => t.id === activeProj.techId)
    : null;
  const activePct = activeProj
    ? Math.min(100, Math.round((activeProj.progress / activeProj.totalCost) * 100))
    : 0;
  const activeRemainingRP = activeProj
    ? Math.max(0, activeProj.totalCost - activeProj.progress)
    : 0;
  const activeEstDays = activeProj
    ? Math.max(1, Math.ceil(activeRemainingRP / Math.max(0.4, playerEconomy.dailyResearch)))
    : 0;

  const handleStartResearch = (techId: string) => {
    if (onStartResearch) {
      onStartResearch(techId);
    } else {
      onUnlockTech(techId);
    }
  };

  return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 5 Cols: Ideology & Reforms */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-white">
                    Devlet İdeolojisi ve Rejim Seçimi
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.values(IDEOLOGIES).map((ideo) => {
                      const isCurrent = playerNation.ideology === ideo.id;
                      return (
                        <button
                          key={ideo.id}
                          onClick={() => onChangeIdeology(ideo.id)}
                          aria-pressed={isCurrent}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                            isCurrent
                              ? 'bg-slate-900 border-2 text-white shadow-lg'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                          style={{ borderColor: isCurrent ? ideo.color : undefined }}
                        >
                          <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-display shrink-0 border border-white/15 shadow-inner"
                            style={{ backgroundColor: `${ideo.color}33`, color: ideo.color }}
                            aria-hidden="true"
                          >
                            {IDEOLOGY_GLYPHS[ideo.id] ?? '◆'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">
                              {ideo.name}
                            </div>
                            <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {ideo.description}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Vergi {ideo.taxBonus >= 0 ? `+${ideo.taxBonus}` : ideo.taxBonus}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                Ordu {ideo.militaryAttackBonus >= 0 ? `+${ideo.militaryAttackBonus}` : ideo.militaryAttackBonus}
                              </span>
                              {isCurrent && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/15 text-emerald-300">AKTİF</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* National Reforms */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-white">
                    Ulusal Reformlar ve Kanunlar
                  </h3>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {activeReforms.map((ref, reformIndex) => {
                      const enacted = playerNation.enactedReforms.includes(
                        ref.id
                      );
                      const canAfford =
                        !enacted &&
                        playerNation.treasury >= ref.costGold &&
                        playerNation.researchPoints >= ref.costResearch;
                      return (
                        <div
                          key={ref.id}
                          className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-center justify-center text-base shrink-0">
                              {REFORM_GLYPHS[reformIndex % REFORM_GLYPHS.length]}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {ref.name}
                              </div>
                              <div className="text-[10px] text-emerald-400 line-clamp-1">
                                {ref.effectLabel}
                              </div>
                            </div>
                          </div>
                          <button
                            disabled={!canAfford}
                            onClick={() => onEnactReform(ref.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                              enacted
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {enacted
                              ? 'Yürürlükte'
                              : `${ref.costGold}G · ${ref.costResearch} RP`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Formable Empires (Büyük İmparatorluk İlanı) */}
                <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-400" />
                      Tarihi İmparatorluk İlanı (Formable Nations)
                    </h3>
                    <span className="font-mono-num text-xs text-slate-400">
                      Mevcut: {playerEconomy.territoryCount} Eyalet · {playerNation.unlockedTechs.length} Tek.
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                    {FORMABLE_EMPIRES.filter(
                      (emp) =>
                        !emp.allowedNationIds ||
                        emp.allowedNationIds.includes(playerNation.id)
                    ).map((emp) => {
                      const alreadyFormed =
                        playerNation.formedEmpireId === emp.id;
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
                          className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-white">
                                {emp.name}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {emp.description}
                              </p>
                              <div className="text-[11px] text-amber-400 font-semibold mt-1">
                                {emp.bonusSummary}
                              </div>
                            </div>
                            <button
                              disabled={!canForm}
                              onClick={() => onFormEmpire(emp.id)}
                              className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 ${
                                alreadyFormed
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                  : canForm
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                                  : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {alreadyFormed
                                ? '✓ İlan Edildi'
                                : canForm
                                ? '👑 İmparatorluğu İlan Et!'
                                : 'Şartlar Eksik'}
                            </button>
                          </div>

                          {/* Visual Strategic Requirements Checklist */}
                          {!alreadyFormed && (
                            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 text-[10px] font-mono-num">
                              <span
                                className={`px-2 py-0.5 rounded border ${
                                  hasProvinces
                                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                }`}
                              >
                                {hasProvinces ? '✓' : '✗'} {playerEconomy.territoryCount}/{emp.requiredProvinces} Eyalet
                              </span>

                              {reqTechs > 0 && (
                                <span
                                  className={`px-2 py-0.5 rounded border ${
                                    hasTechs
                                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {hasTechs ? '✓' : '✗'} {playerNation.unlockedTechs.length}/{reqTechs} Teknoloji
                                </span>
                              )}

                              {reqGold > 0 && (
                                <span
                                  className={`px-2 py-0.5 rounded border ${
                                    hasGold
                                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {hasGold ? '✓' : '✗'} {reqGold} Altın
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
                                    className={`px-2 py-0.5 rounded border ${
                                      isOwned
                                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                                    }`}
                                  >
                                    {isOwned ? '✓' : '✗'} ★ {cityName}
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

              {/* Right 7 Cols: AoH3 Timed Technology & Research Center */}
              <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
                {/* AoH3 Active Research Spotlight Panel */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-950/50 via-slate-900 to-indigo-950/40 border border-sky-500/40 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300">
                        <FlaskConical className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          {activeTech ? (
                            <span className="text-sky-300">
                              Aktif Araştırma: {activeTech.name}
                            </span>
                          ) : (
                            <span className="text-slate-300">
                              Aktif Araştırma Projesi Yok
                            </span>
                          )}
                        </h3>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>
                            Günlük Bilim:{' '}
                            <strong className="text-sky-400">
                              +{playerEconomy.dailyResearch} Puan/Gün
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Birikmiş Havuz:{' '}
                            <strong className="text-amber-300">
                              {playerNation.researchPoints.toFixed(0)} Puan
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Research Budget Quick Selector (AoH3 Style) */}
                    {onUpdateBudget && (
                      <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px]">
                        <span className="text-slate-400 text-[10px]">
                          Araştırma Bütçesi:
                        </span>
                        {[15, 30, 50].map((bVal) => (
                          <button
                            key={bVal}
                            onClick={() => onUpdateBudget('research', bVal)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              (playerNation.budget?.research || 15) === bVal
                                ? 'bg-sky-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                          >
                            %{bVal}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {activeProj && activeTech ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-sky-200">
                          {activeTech.effectLabel}
                        </span>
                        <span className="font-mono-num text-amber-300">
                          ⏳ ~{activeEstDays} Gün Kaldı (%{activePct})
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-300 rounded-full"
                          style={{ width: `${Math.max(3, activePct)}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono-num font-extrabold text-white drop-shadow">
                          {activeProj.progress.toFixed(1)} / {activeProj.totalCost} RP
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-[11px] text-slate-400">
                          Teknoloji tamamlandığında yeni birimler ve idari bonuslar otomatik açılır.
                        </p>
                        <div className="flex items-center gap-2">
                          {onBoostResearch && playerNation.researchPoints >= 5 && (
                            <button
                              onClick={onBoostResearch}
                              title="Birikmiş araştırma puanını bu projeye aktararak günleri kısalt"
                              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-md"
                            >
                              ⚡ Hızlandır (+Puan Harca)
                            </button>
                          )}
                          {onCancelResearch && (
                            <button
                              onClick={onCancelResearch}
                              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                            >
                              Duraklat
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-dashed border-sky-500/30 text-xs text-sky-200/80 flex items-center justify-between gap-2">
                      <span>
                        Aşağıdaki teknoloji ağacından bir teknoloji seçip{' '}
                        <strong>"Araştırmaya Başla"</strong> butonuna dokunun.
                      </span>
                    </div>
                  )}
                </div>

                {/* 4 Branch Filters + All Branches Tree Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex gap-1.5 bg-[#120f0c] p-1 rounded-xl border border-[#caa15a]/35 overflow-x-auto w-full sm:w-auto">
                    {(
                      [
                        { id: 'MILITARY', label: '⚔️ Askeri Doktrin' },
                        { id: 'ECONOMY', label: '💰 Ekonomi & Üretim' },
                        { id: 'ADMINISTRATION', label: '🏛️ İdare & Devlet' },
                        { id: 'SCIENCE', label: '🔭 Bilim & Çağ' },
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setTechBranchFilter(b.id)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex-1 sm:flex-initial cursor-pointer ${
                          techBranchFilter === b.id
                            ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow-md'
                            : 'text-[#d8cbb5] hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] font-mono-num text-[#c5b79e]">
                    Açılan Teknoloji: <strong className="text-amber-300">{playerNation.unlockedTechs.length}/{activeTechTree.length}</strong>
                  </span>
                </div>

                {/* National Army Modernization Panel synced with Military Tech Tree */}
                {techBranchFilter === 'MILITARY' && (
                  <ArmyModernizationCard
                    playerNation={playerNation}
                    totalGarrison={playerEconomy.totalGarrison}
                    gameMode={gameMode}
                    onModernizeNationalArmy={onModernizeNationalArmy}
                  />
                )}

                {/* AoH3 Horizontal Tiered Technology Tree (Kademe I -> Kademe II -> Kademe III -> Kademe IV) */}
                <div
                  data-testid="aoh3-tech-tree-canvas"
                  className="rounded-2xl bg-[#13100d] border border-[#caa15a]/45 p-2.5 sm:p-3 overflow-x-auto shadow-inner"
                >
                  <div className="min-w-[500px] space-y-2.5">
                    {/* Era / Tier Column Headers */}
                    <div className="grid grid-cols-4 gap-2 pb-2 border-b border-[#caa15a]/25">
                      {[
                        { tier: 1, title: 'KADEME I', subtitle: 'Erken Doktrin' },
                        { tier: 2, title: 'KADEME II', subtitle: 'Teşkilat & Ocak' },
                        { tier: 3, title: 'KADEME III', subtitle: 'İmparatorluk' },
                        { tier: 4, title: 'KADEME IV', subtitle: 'Cihan Hakimiyeti' },
                      ].map((col) => (
                        <div
                          key={col.tier}
                          className="px-2 py-1.5 rounded-lg bg-[#1d1813] border border-[#caa15a]/30 flex items-center justify-between gap-1"
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-display font-extrabold text-amber-300 tracking-wider truncate">
                              {col.title}
                            </div>
                            <div className="text-[9px] text-[#b8a990] truncate">
                              {col.subtitle}
                            </div>
                          </div>
                          <span className="w-4 h-4 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-[9px] font-mono-num font-bold text-amber-200 shrink-0">
                            {col.tier}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Horizontal Connected Node Columns */}
                    <div className="grid grid-cols-4 gap-2 items-stretch">
                      {[1, 2, 3, 4].map((tierNum) => {
                        const tierTechs = activeTechTree.filter(
                          (t) => t.branch === techBranchFilter && t.tier === tierNum
                        );
                        return (
                          <div
                            key={tierNum}
                            className="flex flex-col justify-center gap-2 relative min-w-0"
                          >
                            {tierTechs.length === 0 ? (
                              <div className="p-3 rounded-xl border border-dashed border-[#caa15a]/20 text-center text-[11px] text-[#8c7e6a]">
                                Bu kademede dal düğümü yok
                              </div>
                            ) : (
                              tierTechs.map((tech) => {
                                const isUnlocked =
                                  playerNation.unlockedTechs.includes(tech.id);
                                const isActivelyResearching =
                                  activeProj?.techId === tech.id;
                                const savedProgressValue =
                                  playerNation.researchProgressByTech?.[tech.id] ?? 0;
                                const savedProgress = Number.isFinite(savedProgressValue)
                                  ? Math.max(0, savedProgressValue)
                                  : 0;
                                const hasSavedProgress =
                                  !isActivelyResearching && savedProgress > 0;
                                const progressForTech = isActivelyResearching
                                  ? activeProj?.progress ?? 0
                                  : savedProgress;
                                const progressTotalForTech = isActivelyResearching
                                  ? activeProj?.totalCost ?? tech.cost
                                  : tech.cost;
                                const progressPctForTech = Math.min(
                                  100,
                                  Math.round(
                                    (progressForTech /
                                      Math.max(1, progressTotalForTech)) *
                                      100
                                  )
                                );
                                const prereqMet =
                                  !tech.prerequisite ||
                                  playerNation.unlockedTechs.includes(
                                    tech.prerequisite
                                  );
                                const prereqDef = tech.prerequisite
                                  ? activeTechTree.find(
                                      (t) => t.id === tech.prerequisite
                                    )
                                  : null;
                                const estDaysForThis = Math.max(
                                  1,
                                  Math.ceil(
                                    tech.cost /
                                      Math.max(0.4, playerEconomy.dailyResearch)
                                  )
                                );
                                const branchColor =
                                  TECH_BRANCH_META[tech.branch]?.color || '#e0ad52';

                                return (
                                  <div
                                    key={tech.id}
                                    className="relative flex items-center"
                                  >
                                    {/* Left Connector Line from Previous Tier */}
                                    {tierNum > 1 && (
                                      <div
                                        aria-hidden="true"
                                        className={`hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-0.5 ${
                                          isUnlocked
                                            ? 'bg-emerald-400'
                                            : prereqMet
                                            ? 'bg-[#caa15a]'
                                            : 'bg-slate-700'
                                        }`}
                                      />
                                    )}

                                    <div
                                      className={`w-full rounded-xl border p-2.5 flex flex-col justify-between gap-2 transition-all shadow-lg ${
                                        isUnlocked
                                          ? 'bg-gradient-to-b from-emerald-950/60 to-[#171f1a] border-emerald-500/70'
                                          : isActivelyResearching
                                          ? 'bg-gradient-to-b from-amber-950/70 to-[#1f1912] border-amber-400 ring-2 ring-amber-400/35'
                                          : prereqMet
                                          ? 'bg-[#1c1712] border-[#caa15a]/55 hover:border-amber-300'
                                          : 'bg-[#14110e]/75 border-slate-800/90 opacity-75'
                                      }`}
                                    >
                                      {/* Top Node Header: Icon + Name + Cost Badge */}
                                      <div className="space-y-1.5">
                                        <div className="flex items-start justify-between gap-1.5">
                                          <span
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold border shrink-0 shadow-inner"
                                            style={{
                                              color: branchColor,
                                              borderColor: `${branchColor}66`,
                                              backgroundColor: `${branchColor}18`,
                                            }}
                                          >
                                            {TECH_BRANCH_META[tech.branch]?.glyph || '◆'}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-[#caa15a]/30 font-mono-num text-[10px] font-bold text-amber-300">
                                            {tech.cost} RP
                                          </span>
                                        </div>

                                        <div className="text-xs font-display font-bold text-[#f3ead7] leading-snug">
                                          {tech.name}
                                        </div>

                                        <div className="text-[10px] font-semibold text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 leading-tight">
                                          {tech.effectLabel}
                                        </div>

                                        <p className="text-[10px] text-[#b8a990] line-clamp-2 leading-relaxed">
                                          {tech.description}
                                        </p>
                                      </div>

                                      {/* Active / Saved Progress Bar Inside Node */}
                                      {(isActivelyResearching || hasSavedProgress) && (
                                        <div className="space-y-0.5">
                                          <div className="flex items-center justify-between text-[9px] font-mono-num text-amber-200">
                                            <span>
                                              {isActivelyResearching
                                                ? 'Araştırılıyor'
                                                : 'Duraklatıldı'}
                                            </span>
                                            <span>%{progressPctForTech}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#caa15a]/30">
                                            <div
                                              className={`h-full transition-all ${
                                                isActivelyResearching
                                                  ? 'bg-amber-400'
                                                  : 'bg-amber-600'
                                              }`}
                                              style={{
                                                width: `${Math.max(5, progressPctForTech)}%`,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {/* Node Action Button */}
                                      <button
                                        disabled={
                                          isUnlocked ||
                                          !prereqMet ||
                                          isActivelyResearching
                                        }
                                        onClick={() => handleStartResearch(tech.id)}
                                        className={`w-full min-h-[34px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                                          isUnlocked
                                            ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 cursor-default'
                                            : isActivelyResearching
                                            ? 'bg-amber-500/25 text-amber-200 border border-amber-400/60 cursor-default'
                                            : prereqMet
                                            ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d9b26b] hover:to-[#ecc77f] text-[#14110e] shadow'
                                            : 'bg-black/45 text-slate-500 border border-slate-800 cursor-not-allowed'
                                        }`}
                                      >
                                        {isUnlocked ? (
                                          <>
                                            <Check className="w-3.5 h-3.5" /> Açıldı
                                          </>
                                        ) : isActivelyResearching ? (
                                          `⏳ %${activePct} (~${activeEstDays}g)`
                                        ) : !prereqMet ? (
                                          `🔒 ${prereqDef?.name || 'Önceki Kademe'}`
                                        ) : hasSavedProgress ? (
                                          `▶ Devam Et (~${estDaysForThis}g)`
                                        ) : (
                                          `🔬 Araştır (~${estDaysForThis}g)`
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
  );
};
