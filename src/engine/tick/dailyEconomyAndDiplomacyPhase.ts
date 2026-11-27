import {
  ActiveResearchProject,
  ActiveWar,
  DiplomaticEnvoy,
} from '../../types/game';
import { BUILDINGS, getTechTreeForMode } from '../../data/world2026Data';
import { RELIGIONS } from '../../data/religionAndCultureData';
import {
  calculateNationEconomy,
  computeNationManpowerCap,
  computeNavalBlockadedTerritoryIds,
  evaluateWorldCoalitionAt100AE,
  getOrCreateRelation,
  isAtWar,
  relationKey,
} from '../simulationEngine';
import {
  evaluateMultiProvinceAiTurn,
  evaluateWeeklyUnrestAndRebellions,
} from '../aiAndRebellionEngine';
import {
  evaluateAntiHegemonCoalitions,
  evaluateWeeklySupplyAndSeasonAttrition,
  getGameSeason,
  pruneDeadAlliances,
} from '../seasonSupplyAndAiProfile';
import {
  evaluateWeeklyLordLoyaltyAndRebellions,
  processWeeklyBannerlordUpdates,
} from '../pashaAndFiefEngine';
import { evaluateActiveStraits } from '../straitsAndTradeEngine';
import { pickNextAutoResearchTech } from '../actions/techAndReformActions';
import {
  evaluateMonthlyDynastySuccession,
  getRulerModifiers,
} from '../dynastyAndSuccessionEngine';
import { pickEligibleCrisisEvent, TickContext } from './tickContext';

/**
 * Phases 2, 3, and 4 (runs once per completed 24-hour game day):
 * - Daily naval blockade unrest, player economy/research/war exhaustion/AE decay, construction & recruitment queues, assimilation, and missionaries.
 * - Weekly AI growth, rebellions, bannerlord/pasha loyalty, supply/season attrition, and bi-weekly coalition/alliance maintenance.
 * - Daily diplomatic envoys, multi-province strategic AI, 100-AE World Coalition checks, zombie-war pruning, and periodic crisis events.
 */
export function runDailyEconomyAndDiplomacyPhase(ctx: TickContext): void {
  if (!ctx.dayWrapped) return;

  const { input, nextTick, gameMode, playerNationId, relations, settings } = ctx;

  // Apply daily naval blockade unrest pressure on hostile coastal provinces blockaded by an anchored SeaArmy
  if (ctx.nextSeaArmies.length > 0 && ctx.nextWars.length > 0) {
    const blockadedPorts = computeNavalBlockadedTerritoryIds(
      ctx.nextTerritories,
      ctx.nextWars,
      ctx.nextSeaArmies
    );
    blockadedPorts.forEach((tId) => {
      const t = ctx.nextTerritories[tId];
      if (!t) return;
      ctx.writeTerritory(tId, {
        ...t,
        unrest: Math.min(100, Number((t.unrest + 1.5).toFixed(1))),
      });
    });
  }

  const pNation = ctx.nextNations[playerNationId];
  if (pNation) {
    const econ = calculateNationEconomy(
      pNation,
      ctx.nextTerritories,
      ctx.nextNations,
      relations,
      ctx.nextMovements,
      ctx.nextWars,
      gameMode,
      ctx.nextSeaArmies
    );

    let infDelta = (pNation.taxRate > 38 ? 0.03 : -0.01) - econ.inflationRelief;
    if (pNation.enactedReforms.includes('ref_central_bank')) {
      infDelta -= 0.025;
    }

    let activeProj: ActiveResearchProject | null = pNation.activeResearch
      ? { ...pNation.activeResearch }
      : null;
    const unlockedTechs = [...pNation.unlockedTechs];
    const researchProgressByTech = { ...(pNation.researchProgressByTech ?? {}) };

    // Auto-start next research if autoResearch is enabled and no project is active
    if (!activeProj && pNation.autoResearch === true) {
      const autoNext = pickNextAutoResearchTech(
        {
          ...pNation,
          unlockedTechs,
          researchProgressByTech,
        },
        gameMode
      );
      if (autoNext) {
        const saved = Math.max(
          0,
          Math.min(
            autoNext.cost,
            Number(researchProgressByTech[autoNext.id] ?? 0)
          )
        );
        activeProj = {
          techId: autoNext.id,
          progress: saved,
          totalCost: autoNext.cost,
          startedTick: nextTick,
        };
        researchProgressByTech[autoNext.id] = saved;
      }
    }

    if (activeProj) {
      const dailyInvest = Math.max(0.4, econ.dailyResearch);
      activeProj.progress = Number(
        (activeProj.progress + dailyInvest).toFixed(2)
      );
      researchProgressByTech[activeProj.techId] = activeProj.progress;
      if (activeProj.progress >= activeProj.totalCost) {
        const techDef = getTechTreeForMode(gameMode).find(
          (t) => t.id === activeProj!.techId
        );
        const techName = techDef?.name || activeProj.techId;
        unlockedTechs.push(activeProj.techId);
        delete researchProgressByTech[activeProj.techId];
        activeProj = null;
        ctx.sounds.push('TREATY');

        let autoChainedName: string | null = null;
        if (pNation.autoResearch === true) {
          const nextTech = pickNextAutoResearchTech(
            {
              ...pNation,
              unlockedTechs,
              researchProgressByTech,
            },
            gameMode
          );
          if (nextTech) {
            const saved = Math.max(
              0,
              Math.min(
                nextTech.cost,
                Number(researchProgressByTech[nextTech.id] ?? 0)
              )
            );
            activeProj = {
              techId: nextTech.id,
              progress: saved,
              totalCost: nextTech.cost,
              startedTick: nextTick,
            };
            researchProgressByTech[nextTech.id] = saved;
            autoChainedName = nextTech.name;
          }
        }

        ctx.toasts.push(
          techDef?.branch === 'MILITARY'
            ? autoChainedName
              ? `🔬 Araştırma Tamamlandı: ${techName}! Sıradaki proje otomatik başladı: ${autoChainedName}.`
              : `🔬 Araştırma Tamamlandı: ${techName}! Yeni askeri birlikler ve ordu güncellemesi açıldı.`
            : autoChainedName
            ? `🔬 Araştırma Tamamlandı: ${techName}! Sıradaki proje otomatik başladı: ${autoChainedName}.`
            : `🔬 Araştırma Tamamlandı: ${techName}!`
        );
      }
    }

    const playerMpCap = computeNationManpowerCap(pNation, ctx.nextTerritories);
    const nextPlayerManpower =
      pNation.manpower >= playerMpCap
        ? pNation.manpower
        : Math.min(playerMpCap, pNation.manpower + econ.dailyManpower);
    const hoardingInf =
      pNation.treasury > 40_000 && econ.netDailyGold > 0 ? 0.04 : 0;

    const playerActiveWarCount = ctx.nextWars.filter(
      (w) =>
        w.attackerId === playerNationId ||
        w.defenderId === playerNationId ||
        w.attackers.includes(playerNationId) ||
        w.defenders.includes(playerNationId)
    ).length;
    const weTechFactor =
      (unlockedTechs.includes('adm_8') ? 0.8 : 1.0) *
      (unlockedTechs.includes('adm_9b') ? 0.8 : 1.0);
    const nextPlayerWarExhaustion =
      playerActiveWarCount > 0
        ? Math.min(
            100,
            Number(
              (
                (pNation.warExhaustion || 0) +
                playerActiveWarCount * 1.15 * weTechFactor
              ).toFixed(2)
            )
          )
        : Math.max(
            0,
            Number(((pNation.warExhaustion || 0) - 0.85).toFixed(2))
          );

    const playerRulerMods = getRulerModifiers(pNation);
    const extraDipPt =
      playerRulerMods.extraDiplomacyPoint && nextTick % 2 === 0 ? 1 : 0;
    const nextStabilityWithRuler =
      playerRulerMods.stabilityRecoveryBonus > 0 && pNation.stability < 95
        ? Math.min(
            95,
            Number(
              (
                pNation.stability + playerRulerMods.stabilityRecoveryBonus
              ).toFixed(2)
            )
          )
        : pNation.stability;
    const dailyAeDecay = Math.max(
      0.04,
      0.08 + playerRulerMods.aeDecayBonus
    );

    ctx.writeNation(playerNationId, {
      ...pNation,
      treasury: Math.max(0, pNation.treasury + econ.netDailyGold),
      stability: nextStabilityWithRuler,
      diplomacyPoints: Math.min(
        100,
        (pNation.diplomacyPoints ?? 100) +
          1 +
          (unlockedTechs.includes('adm_2b') ? 1 : 0) +
          extraDipPt
      ),
      manpower: nextPlayerManpower,
      researchPoints: Number(
        (pNation.researchPoints + econ.dailyResearch).toFixed(1)
      ),
      activeResearch: activeProj,
      researchProgressByTech,
      unlockedTechs,
      inflation: Math.max(
        0.5,
        Math.min(
          65,
          Number((pNation.inflation + infDelta + hoardingInf).toFixed(2))
        )
      ),
      warExhaustion: nextPlayerWarExhaustion,
      aggressiveExpansion: Math.max(
        0,
        Number((pNation.aggressiveExpansion - dailyAeDecay).toFixed(2))
      ),
    });

    // 2A-1. Daily Construction Queues, Recruitment Queues, Gradual Assimilation & Missionary Conversion
    for (const t of Object.values(ctx.nextTerritories)) {
      if (!t) continue;
      let tModified = false;
      let nextQueue = t.constructionQueue;
      let nextRecruitQueue = t.recruitmentQueue;
      let nextGarrison = t.garrison;
      let nextUnits = t.units;
      let nextBuildings = t.buildings;
      let nextBaseGdp = t.baseGdp;
      let nextAssim = t.assimilation;
      let nextIsAssimilating = t.isAssimilating;
      let nextCoreOwner = t.coreOwnerId;
      let nextUnrest = t.unrest;
      let nextReligion = t.religion;
      let nextMissionary = t.missionary;
      const buildings = t.buildings || {
        factory: 0,
        barracks: 0,
        armyHearth: 0,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
        shipyard: 0,
        mint: 0,
        granary: 0,
      };

      const ownerNation = ctx.nextNations[t.ownerId];
      const ownerTechs = ownerNation?.unlockedTechs ?? [];
      const popTechMult =
        1 +
        (ownerTechs.includes('eco_1b') ? 0.25 : 0) +
        (ownerTechs.includes('sci_1b') ? 0.3 : 0);

      const unrestGrowthFactor = Math.max(0.25, 1 - (t.unrest || 0) / 140);
      const dailyPopulationGrowth =
        (t.population || 0) *
        (0.00035 * unrestGrowthFactor +
          (buildings.supplyDepot || 0) * 0.00008 +
          (buildings.granary || 0) * 0.00018) *
        popTechMult;
      const nextPopulation = Number(
        Math.max(0, (t.population || 0) + dailyPopulationGrowth).toFixed(2)
      );
      if (nextPopulation !== (t.population || 0)) {
        tModified = true;
      }

      if ((buildings.supplyDepot || 0) > 0 || (buildings.capitalPalace || 0) > 0) {
        const bldCalm =
          (buildings.supplyDepot || 0) * 0.12 +
          (buildings.capitalPalace || 0) * 0.15;
        nextUnrest = Math.max(0, Number((nextUnrest - bldCalm).toFixed(2)));
        tModified = true;
      }

      // High war exhaustion triggers gradual domestic unrest across owned provinces
      const ownerWarEx = ownerNation?.warExhaustion || 0;
      if (ownerWarEx >= 45 && !t.isOccupied) {
        const weUnrest = Number(
          (0.15 + ((ownerWarEx - 45) / 55) * 0.3).toFixed(2)
        );
        nextUnrest = Math.min(100, Number((nextUnrest + weUnrest).toFixed(2)));
        tModified = true;
      }

      const ownerHasAdm5 = ownerTechs.includes('adm_5');
      const ownerHasAdm6 = ownerTechs.includes('adm_6');
      const ownerHasAdm1b = ownerTechs.includes('adm_1b');
      const ownerHasAdm5b = ownerTechs.includes('adm_5b');
      const techUnrestCalm =
        (ownerHasAdm5 ? 0.35 : 0) +
        (ownerHasAdm6 ? 0.2 : 0) +
        (ownerHasAdm1b ? 0.2 : 0) +
        (ownerHasAdm5b ? 0.25 : 0);
      if (techUnrestCalm > 0 && nextUnrest > 0) {
        nextUnrest = Math.max(
          0,
          Number((nextUnrest - techUnrestCalm).toFixed(2))
        );
        tModified = true;
      }

      if (t.constructionQueue && t.constructionQueue.length > 0) {
        // Strict sequential FIFO queue: only head item [0] advances each day; queued items [1..n] wait in order.
        const [activeItem, ...waitingQueue] = t.constructionQueue;
        const nextDays = activeItem.progressDays + 1;
        if (nextDays >= activeItem.totalDays) {
          const bDef = BUILDINGS.find((b) => b.id === activeItem.building);
          const maxLvl = bDef?.maxLevel ?? 5;
          const cappedLevel = Math.min(maxLvl, activeItem.targetLevel);
          nextBuildings = {
            ...nextBuildings,
            [activeItem.building]: Math.max(
              nextBuildings[activeItem.building] || 0,
              cappedLevel
            ),
          };
          if (activeItem.gdpBonus && activeItem.gdpBonus > 0) {
            nextBaseGdp = Math.round((nextBaseGdp || 40) + activeItem.gdpBonus);
          }
          nextQueue = waitingQueue;
          tModified = true;
          if (t.ownerId === playerNationId) {
            ctx.sounds.push('BUILD');
            const facilityLabel = activeItem.specialtyName
              ? `${activeItem.specialtyName} (${bDef?.name || activeItem.building})`
              : bDef?.name || activeItem.building;
            ctx.toasts.push(
              `🏛️ ${t.name}: ${facilityLabel} (Sv. ${cappedLevel}/${maxLvl}) inşası tamamlandı!`
            );
          }
        } else {
          nextQueue = [{ ...activeItem, progressDays: nextDays }, ...waitingQueue];
          tModified = true;
        }
      }

      // Daily Army Recruitment Queue Training (strict sequential FIFO queue per province)
      if (t.recruitmentQueue && t.recruitmentQueue.length > 0) {
        const [activeRecruit, ...waitingRecruit] = t.recruitmentQueue;
        let curUnits = nextUnits || {
          infantry: nextGarrison,
          armor: 0,
          airDrone: 0,
        };
        const nextDays = activeRecruit.progressDays + 1;
        if (nextDays >= activeRecruit.totalDays) {
          nextGarrison += activeRecruit.troops;
          curUnits = {
            infantry: (curUnits.infantry || 0) + (activeRecruit.units?.infantry || 0),
            armor: (curUnits.armor || 0) + (activeRecruit.units?.armor || 0),
            airDrone: (curUnits.airDrone || 0) + (activeRecruit.units?.airDrone || 0),
          };
          nextUnits = curUnits;
          nextRecruitQueue = waitingRecruit;
          tModified = true;
          if (t.ownerId === playerNationId) {
            ctx.sounds.push('RECRUIT');
            ctx.toasts.push(
              `🪖 ${t.name}: +${activeRecruit.troops.toLocaleString('tr-TR')} ${activeRecruit.label} eğitimini tamamlayıp garnizona katıldı!`
            );
          }
        } else {
          nextRecruitQueue = [
            { ...activeRecruit, progressDays: nextDays },
            ...waitingRecruit,
          ];
          tModified = true;
        }
      }

      if (t.isAssimilating && !t.isOccupied) {
        const currentVal = t.assimilation ?? 30;
        const baseAssimStep = ownerHasAdm5 ? 1.75 : 1.25;
        let assimMult = 1.0;
        if (ownerTechs.includes('adm_2b')) assimMult += 0.2;
        if (ownerTechs.includes('adm_4b')) assimMult += 0.2;
        if (ownerHasAdm6) assimMult += 0.3;
        assimMult += (buildings.school || 0) * 0.08;
        const assimStep = Number((baseAssimStep * assimMult).toFixed(2));
        const updatedAssim = Math.min(
          100,
          Number((currentVal + assimStep).toFixed(2))
        );
        nextUnrest = Math.max(0, Number((nextUnrest - 0.35).toFixed(2)));
        if (updatedAssim >= 100) {
          nextAssim = 100;
          nextIsAssimilating = false;
          nextCoreOwner = t.ownerId;
          nextUnrest = Math.max(0, nextUnrest - 10);
          tModified = true;
          if (t.ownerId === playerNationId) {
            ctx.sounds.push('BUILD');
            ctx.toasts.push(
              `🌟 ${t.name} eyaleti tamamen asimile edildi ve Öz Vatan (Core) oldu!`
            );
          }
        } else {
          nextAssim = updatedAssim;
          tModified = true;
        }
      }

      if (t.missionary) {
        const nextDays = t.missionary.progressDays + 1;
        if (nextDays >= t.missionary.totalDays) {
          nextReligion = t.missionary.targetReligion;
          nextMissionary = null;
          nextUnrest = Math.max(0, Number((nextUnrest - 8).toFixed(2)));
          tModified = true;
          if (t.ownerId === playerNationId) {
            ctx.sounds.push('BUILD');
            const relDef = RELIGIONS[t.missionary.targetReligion];
            ctx.toasts.push(
              `☪ ${t.name} ahalisi başarıyla ${relDef?.name || 'Devlet Dini'} inancına geçti!`
            );
          }
        } else {
          nextMissionary = { ...t.missionary, progressDays: nextDays };
          tModified = true;
        }
      }

      if (tModified) {
        ctx.writeTerritory(t.id, {
          ...t,
          garrison: nextGarrison,
          units: nextUnits,
          population: nextPopulation,
          baseGdp: nextBaseGdp,
          buildings: nextBuildings,
          constructionQueue: nextQueue,
          recruitmentQueue: nextRecruitQueue,
          assimilation: nextAssim,
          isAssimilating: nextIsAssimilating,
          coreOwnerId: nextCoreOwner,
          unrest: nextUnrest,
          religion: nextReligion,
          missionary: nextMissionary,
        });
      }
    }
  }

  if (nextTick % 7 === 0) {
    const allTerrsList = Object.values(ctx.nextTerritories);
    const liveStraits = evaluateActiveStraits(ctx.nextTerritories, ctx.nextWars);
    // Precompute province counts, GDP, garrisons, strait tolls, and active war counts in single linear passes
    const aiGdpByOwner: Record<string, number> = {};
    const aiCountByOwner: Record<string, number> = {};
    const aiGarrisonByOwner: Record<string, number> = {};
    for (const t of allTerrsList) {
      if (!t) continue;
      aiCountByOwner[t.ownerId] = (aiCountByOwner[t.ownerId] || 0) + 1;
      aiGarrisonByOwner[t.ownerId] =
        (aiGarrisonByOwner[t.ownerId] || 0) + (t.garrison || 0);
      aiGdpByOwner[t.ownerId] =
        (aiGdpByOwner[t.ownerId] || 0) +
        t.baseGdp * (1 + t.buildings.factory * 0.25);
    }

    const weeklyStraitTollsByOwner: Record<string, number> = {};
    for (const st of liveStraits) {
      for (const [ownerId, share] of Object.entries(st.ownerTollShares)) {
        weeklyStraitTollsByOwner[ownerId] =
          (weeklyStraitTollsByOwner[ownerId] || 0) + share * 4;
      }
    }

    const activeWarCountByOwner: Record<string, number> = {};
    for (const w of ctx.nextWars) {
      const participants = new Set<string>([
        w.attackerId,
        w.defenderId,
        ...w.attackers,
        ...w.defenders,
      ]);
      for (const pId of participants) {
        activeWarCountByOwner[pId] = (activeWarCountByOwner[pId] || 0) + 1;
      }
    }

    for (const nId of Object.keys(ctx.nextNations)) {
      if (nId === playerNationId) continue;
      const ai = ctx.nextNations[nId];
      if (!ai || ai.isEliminated) continue;
      const provCount = aiCountByOwner[nId] || 0;
      const totalAiGdp = aiGdpByOwner[nId] || 0;
      const totalAiGarrison = aiGarrisonByOwner[nId] || 0;
      const weeklyStraitTolls = weeklyStraitTollsByOwner[nId] || 0;
      const grossWeeklyGain = Math.max(60, totalAiGdp * 0.92) + weeklyStraitTolls;
      // Realistic military maintenance so large empires pay upkeep instead of hoarding 400k+ gold
      const weeklyAiUpkeep = Math.round(totalAiGarrison * 0.0085);
      let netWeeklyGain = Math.round(grossWeeklyGain - weeklyAiUpkeep);
      if (netWeeklyGain > 0 && ai.treasury > 45_000) {
        netWeeklyGain = Math.round(netWeeklyGain * 0.28);
      } else if (netWeeklyGain > 0 && ai.treasury > 22_000) {
        netWeeklyGain = Math.round(netWeeklyGain * 0.55);
      }
      const nextAiTreasury = Math.max(200, ai.treasury + netWeeklyGain);
      const weeklyAiResearch = 18 + provCount * 3.5;

      let aiActiveProj: ActiveResearchProject | null = ai.activeResearch
        ? { ...ai.activeResearch }
        : null;
      const aiUnlocked = [...(ai.unlockedTechs || [])];
      const aiResearchProgressByTech = { ...(ai.researchProgressByTech ?? {}) };
      if (aiActiveProj) {
        aiActiveProj.progress = Number(
          (aiActiveProj.progress + weeklyAiResearch).toFixed(2)
        );
        aiResearchProgressByTech[aiActiveProj.techId] = aiActiveProj.progress;
        if (aiActiveProj.progress >= aiActiveProj.totalCost) {
          aiUnlocked.push(aiActiveProj.techId);
          delete aiResearchProgressByTech[aiActiveProj.techId];
          aiActiveProj = null;
        }
      } else {
        const nextAiTech = getTechTreeForMode(gameMode).find(
          (t) =>
            !aiUnlocked.includes(t.id) &&
            (!t.prerequisite || aiUnlocked.includes(t.prerequisite))
        );
        if (nextAiTech) {
          aiActiveProj = {
            techId: nextAiTech.id,
            progress: 0,
            totalCost: nextAiTech.cost,
            startedTick: nextTick,
          };
          aiResearchProgressByTech[nextAiTech.id] = 0;
        }
      }

      const aiMpCap = Math.max(40_000, provCount * 11_000 + 25_000);
      const nextAiManpower =
        ai.manpower >= aiMpCap
          ? ai.manpower
          : Math.min(aiMpCap, ai.manpower + 450 + provCount * 220);

      const aiWarCount = activeWarCountByOwner[nId] || 0;
      const nextAiWarExhaustion =
        aiWarCount > 0
          ? Math.min(
              100,
              Number(((ai.warExhaustion || 0) + aiWarCount * 6.5).toFixed(1))
            )
          : Math.max(0, Number(((ai.warExhaustion || 0) - 5.5).toFixed(1)));

      ctx.writeNation(nId, {
        ...ai,
        treasury: nextAiTreasury,
        manpower: nextAiManpower,
        researchPoints: Number(
          ((ai.researchPoints || 0) + weeklyAiResearch).toFixed(1)
        ),
        activeResearch: aiActiveProj,
        researchProgressByTech: aiResearchProgressByTech,
        unlockedTechs: aiUnlocked,
        warExhaustion: nextAiWarExhaustion,
        aggressiveExpansion: Math.max(
          0,
          Number((ai.aggressiveExpansion - 0.55).toFixed(2))
        ),
      });
    }

    // 2B. Weekly Unrest Drift, Rebellions & Bannerlord Fief Updates
    const rebResult = evaluateWeeklyUnrestAndRebellions(
      ctx.nextTerritories,
      ctx.nextNations
    );
    const bannerlordRes = processWeeklyBannerlordUpdates(
      ctx.nextNations,
      rebResult.updatedTerritories,
      nextTick
    );

    ctx.nextTerritories = bannerlordRes.updatedTerritories;
    ctx.territoriesCloned = true;
    ctx.nextNations = bannerlordRes.updatedNations;
    ctx.nationsCloned = true;

    bannerlordRes.investmentEvents?.forEach((inv) => {
      if (inv.nationId === playerNationId) {
        ctx.sounds.push('BUILD');
        ctx.appendNews(
          `🔔 ${inv.lordName} Şehir Yatırımı`,
          `${inv.lordName}, ${inv.territoryName} eyaletinde ${inv.buildingName} (Sv.${inv.level}) inşa etti! İmparatorluk Kazancı: ${inv.incomeBoostLabel}.`,
          'ECONOMY'
        );
        ctx.toasts.push(
          `🔔 ${inv.lordName}, ${inv.territoryName} şehrinde ${inv.buildingName} geliştirdi! (${inv.incomeBoostLabel})`
        );
      }
    });

    rebResult.rebellionEvents.forEach((ev) => {
      const ownerName = ctx.nextNations[ev.ownerId]?.name || 'Devlet';
      const restoredName =
        ctx.nextNations[ev.restoredOwnerId]?.name || 'Bağımsız Güçler';
      if (ev.crushed) {
        ctx.appendNews(
          `${ev.territoryName} İsyanı Bastırıldı`,
          `${ownerName} garnizonu ${ev.territoryName} bölgesindeki ayaklanmayı bastırdı.`,
          'WAR'
        );
        if (ev.ownerId === playerNationId) {
          ctx.toasts.push(
            `${ev.territoryName} eyaletinde çıkan isyan garnizonumuz tarafından bastırıldı (-2.500 Asker).`
          );
        }
      } else {
        // If rebellion revived a previously eliminated nation, mark it alive again
        if (ctx.nextNations[ev.restoredOwnerId]?.isEliminated) {
          ctx.writeNation(ev.restoredOwnerId, {
            ...ctx.nextNations[ev.restoredOwnerId],
            isEliminated: false,
          });
        }
        ctx.appendNews(
          `İSYAN: ${ev.territoryName} Ayrıldı!`,
          `Asimile edilmeyen ${ev.territoryName} eyaleti ayaklanarak ${restoredName} kontrolüne geçti!`,
          'WAR'
        );
        if (
          ev.ownerId === playerNationId ||
          ev.restoredOwnerId === playerNationId
        ) {
          ctx.toasts.push(
            `İSYAN! ${ev.territoryName} yüksek huzursuzluk nedeniyle ayaklandı ve ${restoredName} egemenliğine geçti!`
          );
        }
      }
    });

    // 2C. Weekly Pasha / Clan Lord Loyalty Drift & Civil War / Secession Check!
    const loyaltyRes = evaluateWeeklyLordLoyaltyAndRebellions({
      nations: ctx.nextNations,
      territories: ctx.nextTerritories,
      wars: ctx.nextWars,
      weekTick: nextTick,
    });
    ctx.nextNations = loyaltyRes.updatedNations;
    ctx.nationsCloned = true;
    ctx.nextTerritories = loyaltyRes.updatedTerritories;
    ctx.territoriesCloned = true;
    ctx.nextWars = loyaltyRes.updatedWars;

    loyaltyRes.rebellions.forEach((reb) => {
      const provList = reb.rebelTerritoryNames.join(', ');
      ctx.appendNews(
        `🔥 PAŞA İSYANI: ${reb.lordName} Sancak Çekti!`,
        `Sadakati tükenen ${reb.lordName}, elindeki tımarlarla (${provList}) ayaklanarak ${reb.joinedNationName} safına geçti!`,
        'WAR'
      );
      if (reb.nationId === playerNationId) {
        ctx.toasts.push(
          `🔥 PAŞA İSYANI! ${reb.lordName} düşük sadakat yüzünden tımarlarıyla (${provList}) ayaklandı!`
        );
      }
    });

    // 2D. Weekly Supply Limit, Encirclement & Seasonal Weather (Winter / Monsoon / Heatwave) Attrition
    const seasonInfo = getGameSeason(nextTick, gameMode);
    const attritionRes = evaluateWeeklySupplyAndSeasonAttrition({
      territories: ctx.nextTerritories,
      nations: ctx.nextNations,
      season: seasonInfo,
      playerNationId,
      wars: ctx.nextWars,
      tick: nextTick,
      gameMode,
    });
    if (attritionRes.changed) {
      ctx.nextTerritories = attritionRes.updatedTerritories;
      ctx.territoriesCloned = true;
    }
    if (attritionRes.playerTotalLoss > 0) {
      const provLabel = attritionRes.worstPlayerProvinceName
        ? `${attritionRes.worstPlayerProvinceName} başta olmak üzere `
        : '';
      const weatherTag = attritionRes.worstPlayerWeatherLabel || seasonInfo.name;
      ctx.toasts.push(
        `🌦️ ${weatherTag} Yıpranması: ${provLabel}-${attritionRes.playerTotalLoss.toLocaleString('tr-TR')} asker kaybı (İkmal hattını koruyun veya İkmal Deposu/Ambar kurun).`
      );
    }

    // 2E. Bi-Weekly Dead Alliance Pruning & Anti-Hegemon Coalition Formation (Every 14 Days)
    if (nextTick % 14 === 0) {
      const pruneRes = pruneDeadAlliances({
        nations: ctx.nextNations,
        territories: ctx.nextTerritories,
        relations: ctx.nextRelations,
        wars: ctx.nextWars,
      });
      if (pruneRes.prunedCount > 0) {
        ctx.nextRelations = pruneRes.updatedRelations;
      }

      const coalRes = evaluateAntiHegemonCoalitions({
        nations: ctx.nextNations,
        territories: ctx.nextTerritories,
        relations: ctx.nextRelations,
        wars: ctx.nextWars,
        playerNationId,
      });
      if (coalRes.formedCoalitions.length > 0) {
        ctx.nextRelations = coalRes.updatedRelations;
        for (const coal of coalRes.formedCoalitions) {
          const membersStr = coal.memberNames.join(', ');
          ctx.appendNews(
            `🛡️ Koalisyon Paktı: ${coal.hegemonName} Karşıtı İttifak`,
            `${membersStr} devletleri, ${coal.hegemonName} devletinin yüksek agresif genişlemesine karşı ortak savunma koalisyonu imzaladı!`,
            'COALITION'
          );
          if (coal.isAgainstPlayer) {
            ctx.toasts.push(
              `⚠️ KOALİSYON PAKTI! Yüksek agresif genişlememiz nedeniyle ${membersStr} bize karşı ortak savunma koalisyonu kurdu!`
            );
          }
        }
      }
    }
  }

  // Expire stale incoming diplomatic offer if player ignored it past expiry
  if (
    input.activeIncomingOffer &&
    nextTick >= input.activeIncomingOffer.expiresTick
  ) {
    ctx.clearIncomingOffer = true;
  }

  // 2F. Daily Diplomatic Envoys (İlişki Geliştir / İlişki Düşür gradual progression & auto-stop)
  if (ctx.nextEnvoys && ctx.nextEnvoys.length > 0) {
    let relationsClonedForEnvoys = false;
    const livingEnvoyOwners = new Set<string>();
    for (const t of Object.values(ctx.nextTerritories)) {
      if (t?.ownerId) livingEnvoyOwners.add(t.ownerId);
    }

    const remainingEnvoys: DiplomaticEnvoy[] = [];
    for (const envoy of ctx.nextEnvoys) {
      const targetNat = ctx.nextNations[envoy.targetNationId];
      if (
        !targetNat ||
        targetNat.isEliminated ||
        !livingEnvoyOwners.has(envoy.targetNationId)
      ) {
        ctx.toasts.push(
          `🕊️ Elçilik görevi sona erdi (${targetNat?.name || envoy.targetNationId} haritadan silindi).`
        );
        continue;
      }
      if (
        envoy.mission === 'IMPROVE' &&
        isAtWar(ctx.nextWars, playerNationId, envoy.targetNationId)
      ) {
        ctx.toasts.push(
          `⚔️ ${targetNat.name} ile savaş çıktığı için ilişki geliştirme elçiliği geri çekildi.`
        );
        continue;
      }

      const rKey = relationKey(playerNationId, envoy.targetNationId);
      const curRel = getOrCreateRelation(
        ctx.nextRelations,
        playerNationId,
        envoy.targetNationId
      );
      const nextScore = Math.max(
        -100,
        Math.min(100, curRel.score + envoy.dailyDelta)
      );
      if (!relationsClonedForEnvoys) {
        ctx.nextRelations = { ...ctx.nextRelations };
        relationsClonedForEnvoys = true;
      }
      ctx.nextRelations[rKey] = {
        ...curRel,
        score: nextScore,
      };

      const nextRem = envoy.daysRemaining - 1;
      const hitCap =
        (envoy.mission === 'IMPROVE' && nextScore >= 100) ||
        (envoy.mission === 'DAMAGE' && nextScore <= -100);

      if (hitCap || nextRem <= 0) {
        const scoreTxt = nextScore > 0 ? `+${nextScore}` : `${nextScore}`;
        if (envoy.mission === 'IMPROVE') {
          ctx.toasts.push(
            `🕊️ ${targetNat.name} ile ilişki geliştirme görevi tamamlandı (Güncel İlişki: ${scoreTxt}).`
          );
        } else {
          ctx.toasts.push(
            `⚡ ${targetNat.name} ile ilişkileri düşürme görevi tamamlandı (Güncel İlişki: ${scoreTxt}).`
          );
        }
        ctx.sounds.push('TREATY');
        continue;
      }

      remainingEnvoys.push({
        ...envoy,
        daysRemaining: nextRem,
      });
    }
    ctx.nextEnvoys = remainingEnvoys;
  }

  // 3. Multi-Province Strategic AI Decisions (Every 3 days — 2 distinct seeded actors in live campaigns)
  if (nextTick % 3 === 0) {
    const slotPasses = input.worldSeed !== undefined ? [0, 1] : [0];
    for (const slotOffset of slotPasses) {
      const aiRes = evaluateMultiProvinceAiTurn({
        nextTick,
        gameMode,
        playerNationId,
        nations: ctx.nextNations,
        territories: ctx.nextTerritories,
        relations: ctx.nextRelations,
        wars: ctx.nextWars,
        movements: ctx.nextMovements,
        aiAggressiveness: settings.aiAggressiveness,
        worldSeed: input.worldSeed,
        actorSlotOffset: slotOffset,
        hasActiveIncomingOffer: Boolean(
          (input.activeIncomingOffer && !ctx.clearIncomingOffer) ||
            ctx.incomingDiplomaticOffer
        ),
      });

      if (aiRes) {
        if (aiRes.updatedNations) {
          ctx.nextNations = aiRes.updatedNations;
          ctx.nationsCloned = true;
        }
        if (aiRes.updatedTerritories) {
          ctx.nextTerritories = aiRes.updatedTerritories;
          ctx.territoriesCloned = true;
        }
        if (aiRes.updatedWars) {
          ctx.nextWars = aiRes.updatedWars;
        }
        if (aiRes.updatedRelations) {
          ctx.nextRelations = aiRes.updatedRelations;
        }
        if (aiRes.newMovement) {
          ctx.nextMovements = [...ctx.nextMovements, aiRes.newMovement];
        }
        if (aiRes.newWar) {
          ctx.nextWars = [...ctx.nextWars, aiRes.newWar];
          const involvesPlayer =
            aiRes.newWar.attackers.includes(playerNationId) ||
            aiRes.newWar.defenders.includes(playerNationId);
          if (involvesPlayer) {
            const attNat = ctx.nextNations[aiRes.newWar.attackerId];
            const defNat = ctx.nextNations[aiRes.newWar.defenderId];
            if (attNat && defNat) {
              ctx.warAnnouncements.push({
                id: `war_ann_${aiRes.newWar.id}`,
                warId: aiRes.newWar.id,
                attackerId: attNat.id,
                defenderId: defNat.id,
                attackerName: attNat.name,
                defenderName: defNat.name,
                isPlayerAttacker:
                  aiRes.newWar.attackers.includes(playerNationId),
                isPlayerDefender:
                  aiRes.newWar.defenders.includes(playerNationId),
                alliesJoinedNames: [
                  ...aiRes.newWar.attackers,
                  ...aiRes.newWar.defenders,
                ]
                  .filter((id) => id !== attNat.id && id !== defNat.id)
                  .map((id) => ctx.nextNations[id]?.name)
                  .filter((name): name is string => Boolean(name)),
                createdAtMs: Date.now(),
              });
              ctx.sounds.push('WAR_DRUM');
            }
          }
        }
        if (aiRes.newsItem) {
          ctx.appendNews(
            aiRes.newsItem.title,
            aiRes.newsItem.description,
            aiRes.newsItem.type
          );
        }
        if (aiRes.playerAlert) {
          ctx.toasts.push(aiRes.playerAlert);
        }
        if (aiRes.incomingOffer) {
          ctx.incomingDiplomaticOffer = aiRes.incomingOffer;
          ctx.clearIncomingOffer = false;
          ctx.sounds.push('TREATY');
        }
      }
    }
  }

  // 3A. Daily World Coalition Check: any living nation (player or AI) at 100 AE faces a World Coalition War
  // (Automatic annexation / capitulation has been intentionally removed — all conquests are decided at the Peace Table.)
  for (const n of Object.values(ctx.nextNations)) {
    if (!n || n.isEliminated || (n.aggressiveExpansion || 0) < 100) continue;
    const coalitionRes = evaluateWorldCoalitionAt100AE({
      targetNationId: n.id,
      nations: ctx.nextNations,
      territories: ctx.nextTerritories,
      relations: ctx.nextRelations,
      wars: ctx.nextWars,
      tick: nextTick,
      gameMode,
      newsEvents: ctx.nextNewsEvents,
      playerNationId,
    });
    if (coalitionRes.triggered) {
      ctx.nextWars = coalitionRes.wars;
      ctx.nextRelations = coalitionRes.relations;
      ctx.nextNewsEvents = coalitionRes.newsEvents;
      if (coalitionRes.toast) {
        ctx.toasts.push(coalitionRes.toast);
      }
      if (coalitionRes.warAnnouncement) {
        ctx.warAnnouncements.push(coalitionRes.warAnnouncement);
      }
    }
  }

  // 3B. Prune Zombie Wars only where an entire side is truly eliminated (preserve 100%-occupied nations until Peace Treaty!)
  if (ctx.nextWars.length > 0) {
    const livingOwners = new Set<string>();
    const occupiedCoreOwners = new Set<string>();
    for (const t of Object.values(ctx.nextTerritories)) {
      if (t?.ownerId) livingOwners.add(t.ownerId);
      if (t?.isOccupied && t.coreOwnerId) occupiedCoreOwners.add(t.coreOwnerId);
    }
    const isAlive = (nId: string) =>
      Boolean(
        ctx.nextNations[nId] &&
          !ctx.nextNations[nId].isEliminated &&
          (livingOwners.has(nId) || occupiedCoreOwners.has(nId))
      );

    const concludedWars: ActiveWar[] = [];
    const activeWars: ActiveWar[] = [];
    let warScoreUpdated = false;
    for (const w of ctx.nextWars) {
      const attackersList = w.attackers?.length ? w.attackers : [w.attackerId];
      const defendersList = w.defenders?.length ? w.defenders : [w.defenderId];
      const hasLivingAttacker = attackersList.some(isAlive);
      const hasLivingDefender = defendersList.some(isAlive);
      if (hasLivingAttacker && hasLivingDefender) {
        const attackerOwnsAny = attackersList.some((id) => livingOwners.has(id));
        const defenderOwnsAny = defendersList.some((id) => livingOwners.has(id));
        if (!defenderOwnsAny && attackerOwnsAny && w.attackerWarScore < 100) {
          activeWars.push({ ...w, attackerWarScore: 100 });
          warScoreUpdated = true;
        } else if (
          !attackerOwnsAny &&
          defenderOwnsAny &&
          w.attackerWarScore > -100
        ) {
          activeWars.push({ ...w, attackerWarScore: -100 });
          warScoreUpdated = true;
        } else {
          activeWars.push(w);
        }
      } else {
        concludedWars.push(w);
      }
    }

    if (concludedWars.length > 0 || warScoreUpdated) {
      ctx.nextWars = activeWars;
    }
    if (concludedWars.length > 0) {
      ctx.nextBattles = ctx.nextBattles.filter(
        (b) => isAlive(b.attackerId) && isAlive(b.defenderId)
      );
      ctx.nextMovements = ctx.nextMovements.filter((m) => isAlive(m.ownerId));
      for (const cw of concludedWars) {
        ctx.appendNews(
          `🏳️ Savaş Sona Erdi: ${cw.name}`,
          `${cw.name}, taraflardan birinin tüm topraklarını kaybetmesiyle kesin olarak sonuçlandı.`,
          'PEACE'
        );
      }
    }
  }

  // 3C. Monthly Dynamic Ruler Mortality & Election Succession Check (Every 30 days — zero FPS overhead)
  if (nextTick > 0 && nextTick % 30 === 0) {
    const currentSeason = getGameSeason(nextTick);
    const succRes = evaluateMonthlyDynastySuccession({
      nextTick,
      gameMode,
      playerNationId,
      nations: ctx.nextNations,
      territories: ctx.nextTerritories,
      wars: ctx.nextWars,
      movements: ctx.nextMovements,
      isWinter: currentSeason.id === 'WINTER',
      worldSeed: input.worldSeed ?? 1440,
      suppressPlayerModal: Boolean(ctx.triggeredCrisis),
    });

    if (succRes.updatedNations) {
      ctx.nextNations = succRes.updatedNations;
      ctx.nationsCloned = true;
    }
    for (const item of succRes.newsItems) {
      ctx.appendNews(item.title, item.description, item.type);
    }
    for (const alert of succRes.playerAlerts) {
      ctx.toasts.push(alert);
    }
    if (succRes.playerSuccessionEvent) {
      ctx.triggeredSuccession = succRes.playerSuccessionEvent;
      ctx.shouldPause = true;
      ctx.sounds.push('WAR_DRUM');
    }
  }

  // 4. Periodic Interactive Cabinet Crisis / Opportunity Event
  const latestPlayer = ctx.nextNations[playerNationId];
  const hasChallenges =
    latestPlayer &&
    (latestPlayer.treasury < 2500 ||
      latestPlayer.inflation > 12 ||
      ctx.nextWars.length > 0 ||
      latestPlayer.stability < 80);

  if (
    !ctx.triggeredSuccession &&
    settings.crisisFrequencyDays > 0 &&
    nextTick > 0 &&
    nextTick % settings.crisisFrequencyDays === 0 &&
    (hasChallenges || Math.random() < 0.4)
  ) {
    ctx.triggeredCrisis = pickEligibleCrisisEvent(gameMode);
    ctx.shouldPause = true;
    ctx.sounds.push('WAR_DRUM');
  }
}
