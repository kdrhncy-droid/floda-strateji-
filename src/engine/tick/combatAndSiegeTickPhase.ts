import { ActiveBattle } from '../../types/game';
import {
  COMMANDERS,
  getNationModernizedTier,
} from '../../data/world2026Data';
import { isAtWar } from '../simulationEngine';
import { evaluateWartimeAiOperations } from '../aiAndRebellionEngine';
import { computeEncircledProvinceIds } from '../seasonSupplyAndAiProfile';
import { evaluatePlayerAiCommander } from '../playerAiCommander';
import { scaleUnits } from '../core/unitHelpers';
import { getProvinceWeather } from '../seasonalWeatherEngine';
import { getRulerModifiers } from '../dynastyAndSuccessionEngine';
import { computeUnitWeightedPower, TickContext } from './tickContext';

/**
 * Phase 1A, 1B, 1C:
 * - Real-time on-map battles (frontline vs backline, combat width, morale, encirclement supply penalty, peacetime cease-fire).
 * - Real-time city siege progression (0/100 -> 100/100 bar, peacetime lift, relief battle trigger, capture/liberation).
 * - Mid-day (14:00) and daily wartime tactical AI + Player AI Commander operations.
 */
export function runCombatAndSiegeTickPhase(ctx: TickContext): void {
  const {
    input,
    isSubDayMode,
    hoursStep,
    prevHour,
    nextHour,
    dayWrapped,
    nextTick,
    playerNationId,
    settings,
  } = ctx;

  // 1A. AoH3 Real-Time On-Map Battle Simulation (Frontline vs Backline, Combat Width, Morale, and Encirclement Supply Penalty)
  if (ctx.nextBattles.length > 0) {
    const ongoingBattles: ActiveBattle[] = [];
    const roundsToSimulate = isSubDayMode ? 1 : 4;
    const battleDefenderOwners = new Set<string>();
    for (const btl of ctx.nextBattles) {
      const tOwner = ctx.nextTerritories[btl.territoryId]?.ownerId;
      if (tOwner) battleDefenderOwners.add(tOwner);
    }
    const encircledProvsInBattle = computeEncircledProvinceIds(
      ctx.nextTerritories,
      ctx.nextNations,
      battleDefenderOwners
    );

    for (const btl of ctx.nextBattles) {
      const target = ctx.nextTerritories[btl.territoryId];
      const attackerNation = ctx.nextNations[btl.attackerId];
      const defenderNation = ctx.nextNations[btl.defenderId];

      if (!target || !attackerNation || !defenderNation) continue;

      // Cease battle immediately if peace was signed between the two sides
      if (!isAtWar(ctx.nextWars, btl.attackerId, btl.defenderId)) {
        ctx.returnAttackerTroopsHome({
          attackerId: btl.attackerId,
          troops: btl.attackerTroops,
          units: btl.attackerUnits,
          fromTerritoryId: btl.fromTerritoryId,
        });
        continue;
      }

      let attTroops = btl.attackerTroops;
      let defTroops = btl.defenderTroops;
      let attUnits = btl.attackerUnits;
      let defUnits = btl.defenderUnits;
      let attMorale = btl.attackerMorale ?? 100;
      let defMorale = btl.defenderMorale ?? 100;
      let attTuranPowerBonus = btl.attackerTuranPowerBonus ?? 0;
      let defTuranPowerBonus = btl.defenderTuranPowerBonus ?? 0;
      let round = btl.round;
      let wallHp = target.castleWallHp ?? 100;

      const cWidth = btl.combatWidth || 25000;
      const isDefEncircled = encircledProvsInBattle.has(target.id);
      const encirclementDefMult = isDefEncircled ? 0.75 : 1.0;
      const terrainDefMult =
        target.terrain === 'DAGLIK'
          ? 1.25
          : target.terrain === 'METROPOL'
          ? 1.18
          : target.terrain === 'ORMAN'
          ? 1.14
          : target.terrain === 'COL'
          ? 1.05
          : 1.0;

      const battleWeather = getProvinceWeather(target, nextTick, input.gameMode);

      for (let r = 0; r < roundsToSimulate; r++) {
        if (
          attTroops <= 350 ||
          defTroops <= 350 ||
          attMorale <= 12 ||
          defMorale <= 12 ||
          round >= 5
        ) {
          break;
        }
        round += 1;

        // Frontline engagements capped by combat width
        const attEngagedFront = Math.min(
          cWidth,
          attUnits.infantry + attUnits.armor
        );
        const defEngagedFront = Math.min(
          cWidth,
          defUnits.infantry + defUnits.armor
        );
        const attBacklineArtillery = attUnits.airDrone;
        const defBacklineArtillery = defUnits.airDrone;

        const fortBonus =
          1 + (target.buildings.fortress || 0) * 0.08 * (wallHp / 100);

        // Power calculation with frontline, ranged backline, and winter/monsoon troop efficiency
        const attPower =
          (attEngagedFront * 1.05 +
            attBacklineArtillery * 1.6 * battleWeather.artilleryAirEfficiencyMultiplier) *
          battleWeather.attackerEfficiencyMultiplier *
          (1 + getNationModernizedTier(attackerNation) * 0.12) *
          (attMorale / 100) *
          (1 + attTuranPowerBonus / 100);

        const defPower =
          (defEngagedFront * 1.05 +
            defBacklineArtillery * 1.6 * battleWeather.artilleryAirEfficiencyMultiplier) *
          battleWeather.defenderEfficiencyMultiplier *
          (1 + getNationModernizedTier(defenderNation) * 0.12) *
          terrainDefMult *
          fortBonus *
          encirclementDefMult *
          (defMorale / 100) *
          (1 + defTuranPowerBonus / 100);

        const totalPower = Math.max(1, attPower + defPower);
        const attAdvantage = attPower / totalPower;
        const defAdvantage = defPower / totalPower;

        // Casualties inflicted this round
        const defLoss = Math.max(
          160,
          Math.round(defTroops * (0.13 + attAdvantage * 0.22))
        );
        const attLoss = Math.max(
          160,
          Math.round(attTroops * (0.13 + defAdvantage * 0.22))
        );

        const nextAtt = Math.max(0, attTroops - attLoss);
        const nextDef = Math.max(0, defTroops - defLoss);

        // Morale shock
        attMorale = Math.max(
          0,
          attMorale - (attLoss / Math.max(1, attTroops)) * 85
        );
        defMorale = Math.max(
          0,
          defMorale - (defLoss / Math.max(1, defTroops)) * 85
        );

        attUnits = scaleUnits(attUnits, nextAtt / Math.max(1, attTroops));
        defUnits = scaleUnits(defUnits, nextDef / Math.max(1, defTroops));
        attTroops = nextAtt;
        defTroops = nextDef;
        attTuranPowerBonus = 0;
        defTuranPowerBonus = 0;

        const siegeHit = Math.round(6 + ((attUnits.airDrone || 0) > 0 ? 9 : 0));
        wallHp = Math.max(0, wallHp - siegeHit);
      }

      const attPowerFinal =
        computeUnitWeightedPower(attUnits, attTroops, attackerNation) *
        battleWeather.attackerEfficiencyMultiplier;
      const defPowerFinal =
        computeUnitWeightedPower(defUnits, defTroops, defenderNation) *
        battleWeather.defenderEfficiencyMultiplier *
        terrainDefMult *
        encirclementDefMult;

      const battleFinished =
        attTroops <= 400 ||
        defTroops <= 400 ||
        attMorale <= 15 ||
        defMorale <= 15 ||
        round >= 5;

      if (!battleFinished) {
        ctx.writeTerritory(target.id, {
          ...target,
          garrison: Math.max(400, defTroops),
          units: defUnits,
          castleWallHp: wallHp,
        });
        ongoingBattles.push({
          ...btl,
          attackerTroops: attTroops,
          attackerUnits: attUnits,
          attackerFrontline: attUnits.infantry + attUnits.armor,
          attackerBackline: attUnits.airDrone,
          defenderTroops: defTroops,
          defenderUnits: defUnits,
          defenderFrontline: defUnits.infantry + defUnits.armor,
          defenderBackline: defUnits.airDrone,
          attackerMorale: Math.round(attMorale),
          defenderMorale: Math.round(defMorale),
          attackerTuranPowerBonus: attTuranPowerBonus,
          defenderTuranPowerBonus: defTuranPowerBonus,
          round,
        });
        if (btl.attackerId === playerNationId || btl.defenderId === playerNationId) {
          ctx.sounds.push('COMBAT_CLASH');
        }
        continue;
      }

      // Battle concluded on the map!
      const attackerWon =
        defTroops <= 400 ||
        defMorale <= 15 ||
        (attTroops > 400 && attPowerFinal > defPowerFinal * 1.08);

      const attInitial = btl.attackerInitialTroops || btl.attackerTroops;
      const defInitial = btl.defenderInitialTroops || btl.defenderTroops;
      const attLosses = Math.max(0, attInitial - attTroops);
      const defLosses = Math.max(0, defInitial - defTroops);

      if (attackerWon) {
        const previousOwnerId = target.ownerId;
        const survivors = Math.max(900, attTroops);
        const scaledAttUnits = scaleUnits(
          attUnits,
          survivors / Math.max(1, attTroops)
        );

        if (target.ownerId === btl.attackerId) {
          // Besieger had already taken the city or same owner -> merge victorious survivors into garrison (never drop!)
          ctx.writeTerritory(target.id, {
            ...target,
            garrison: target.garrison + survivors,
            units: {
              infantry: (target.units?.infantry || 0) + (scaledAttUnits.infantry || 0),
              armor: (target.units?.armor || 0) + (scaledAttUnits.armor || 0),
              airDrone: (target.units?.airDrone || 0) + (scaledAttUnits.airDrone || 0),
            },
            castleWallHp: wallHp,
            siege: null,
          });
        } else {
          // Garrison defeated! Transition victorious army straight into city siege (0 -> 100/100 bar)
          const existingSiege =
            target.siege && target.siege.attackerId === btl.attackerId
              ? target.siege
              : null;
          const breachMomentum = existingSiege
            ? existingSiege.progress
            : Math.min(20, Math.max(0, Math.round((100 - wallHp) * 0.2)));

          ctx.writeTerritory(target.id, {
            ...target,
            garrison: 0,
            units: { infantry: 0, armor: 0, airDrone: 0 },
            castleWallHp: wallHp,
            siege: {
              territoryId: target.id,
              fromTerritoryId:
                btl.fromTerritoryId || existingSiege?.fromTerritoryId,
              attackerId: btl.attackerId,
              defenderId: previousOwnerId,
              attackerTroops: survivors,
              attackerUnits: scaledAttUnits,
              progress: breachMomentum,
              wallIntegrity: wallHp,
              startedTick: existingSiege?.startedTick ?? nextTick,
            },
          });

          if (btl.attackerId === playerNationId) {
            ctx.sounds.push('COMBAT_CLASH');
            ctx.toasts.push(
              `⚔️ ${target.name} savunması kırıldı! Kuşatma başladı (${Math.round(breachMomentum)}/100).`
            );
          } else if (previousOwnerId === playerNationId) {
            ctx.toasts.push(
              `⚠️ ${target.name} meydan savunması kaybedildi; düşman kuşatmaya başladı!`
            );
          }
        }

        const battleScoreGain = Math.max(
          4,
          Math.min(16, Math.round(4 + (attLosses + defLosses) / 1100))
        );
        ctx.nextWars = ctx.nextWars.map((w) => {
          const involvesBoth =
            (w.attackers.includes(btl.attackerId) &&
              w.defenders.includes(previousOwnerId)) ||
            (w.attackers.includes(previousOwnerId) &&
              w.defenders.includes(btl.attackerId));
          if (!involvesBoth) return w;
          const isAttackerSide = w.attackers.includes(btl.attackerId);
          return {
            ...w,
            attackerWarScore: Math.max(
              -99,
              Math.min(
                99,
                w.attackerWarScore +
                  (isAttackerSide ? battleScoreGain : -battleScoreGain)
              )
            ),
            casualtiesAttacker:
              w.casualtiesAttacker + (isAttackerSide ? attLosses : defLosses),
            casualtiesDefender:
              w.casualtiesDefender + (isAttackerSide ? defLosses : attLosses),
          };
        });
      } else {
        // Defender repulsed the attack! Clear any active siege on target.
        const defSurvivors = Math.max(800, defTroops);
        ctx.writeTerritory(target.id, {
          ...target,
          garrison: defSurvivors,
          units: scaleUnits(defUnits, defSurvivors / Math.max(1, defTroops)),
          castleWallHp: wallHp,
          siege: null,
        });

        // Retreat surviving attackers (>= 250) back to origin, adjacent friendly province, or capital (never vanish!)
        let retreatProvName: string | null = null;
        if (attTroops >= 250) {
          retreatProvName = ctx.returnAttackerTroopsHome({
            attackerId: btl.attackerId,
            troops: attTroops,
            units: attUnits,
            fromTerritoryId: btl.fromTerritoryId,
            nearTerritoryId: target.id,
          });
        }

        if (btl.defenderId === playerNationId) {
          ctx.toasts.push(`🛡️ ${target.name} savunması başarılı`);
        } else if (btl.attackerId === playerNationId) {
          if (retreatProvName) {
            ctx.toasts.push(
              `⚠️ ${target.name} taarruzu püskürtüldü! Hayatta kalan ${(attTroops / 1000).toFixed(1)}B asker ${retreatProvName} şehrine çekildi.`
            );
          } else {
            ctx.toasts.push(
              `⚠️ ${target.name} taarruzu püskürtüldü ve saldıran birlik imha oldu.`
            );
          }
        }

        const defScoreGain = Math.max(
          4,
          Math.min(16, Math.round(5 + (attLosses + defLosses) / 1100))
        );
        ctx.nextWars = ctx.nextWars.map((w) => {
          const involvesBoth =
            (w.attackers.includes(btl.attackerId) &&
              w.defenders.includes(btl.defenderId)) ||
            (w.attackers.includes(btl.defenderId) &&
              w.defenders.includes(btl.attackerId));
          if (!involvesBoth) return w;
          const isAttackerSide = w.attackers.includes(btl.attackerId);
          return {
            ...w,
            attackerWarScore: Math.max(
              -99,
              Math.min(
                99,
                w.attackerWarScore +
                  (isAttackerSide ? -defScoreGain : defScoreGain)
              )
            ),
            casualtiesAttacker:
              w.casualtiesAttacker + (isAttackerSide ? attLosses : defLosses),
            casualtiesDefender:
              w.casualtiesDefender + (isAttackerSide ? defLosses : attLosses),
          };
        });
      }
    }

    ctx.nextBattles = ongoingBattles;
  }

  // 1B. AoH3 Real-Time Siege Progress Simulation (0/100 -> 100/100 fills bar then captures!)
  const activeBattleTerritoryIds = new Set(
    ctx.nextBattles.map((b) => b.territoryId)
  );
  Object.values(ctx.nextTerritories).forEach((terr) => {
    if (!terr || !terr.siege) return;
    if (activeBattleTerritoryIds.has(terr.id)) return; // Paused while relief battle rages
    const siege = terr.siege;
    const attackerNation = ctx.nextNations[siege.attackerId];
    const defenderNation = ctx.nextNations[siege.defenderId];
    if (
      !attackerNation ||
      !defenderNation ||
      terr.ownerId === siege.attackerId ||
      !isAtWar(ctx.nextWars, siege.attackerId, terr.ownerId)
    ) {
      if (
        attackerNation &&
        terr.ownerId !== siege.attackerId &&
        siege.attackerTroops > 0
      ) {
        ctx.returnAttackerTroopsHome({
          attackerId: siege.attackerId,
          troops: siege.attackerTroops,
          units: siege.attackerUnits,
          fromTerritoryId: siege.fromTerritoryId,
        });
      }
      ctx.writeTerritory(terr.id, { ...terr, siege: null });
      return;
    }

    // If defending garrison somehow exceeds threshold while besieged, contest with a battle first
    if (terr.garrison > 350) {
      const attNation = ctx.nextNations[siege.attackerId];
      const defNation = ctx.nextNations[terr.ownerId];
      const attCmd = attNation?.activeGeneralId
        ? COMMANDERS.find((c) => c.id === attNation.activeGeneralId)
        : null;
      const defCmd = defNation?.activeGeneralId
        ? COMMANDERS.find((c) => c.id === defNation.activeGeneralId)
        : null;
      const attU = siege.attackerUnits || {
        infantry: siege.attackerTroops,
        armor: 0,
        airDrone: 0,
      };
      const defU = terr.units || {
        infantry: terr.garrison,
        armor: 0,
        airDrone: 0,
      };
      ctx.nextBattles.push({
        id: `btl_${nextTick}_${terr.id}`,
        territoryId: terr.id,
        fromTerritoryId: siege.fromTerritoryId,
        attackerId: siege.attackerId,
        defenderId: terr.ownerId,
        attackerTroops: siege.attackerTroops,
        attackerInitialTroops: siege.attackerTroops,
        attackerUnits: attU,
        attackerFrontline: attU.infantry + attU.armor,
        attackerBackline: attU.airDrone,
        defenderTroops: terr.garrison,
        defenderInitialTroops: terr.garrison,
        defenderUnits: defU,
        defenderFrontline: defU.infantry + defU.armor,
        defenderBackline: defU.airDrone,
        round: 0,
        combatWidth: 25000,
        attackerMorale: 100,
        defenderMorale: 100,
        attackerCommanderName: attCmd?.name,
        defenderCommanderName: defCmd?.name,
      });
      return;
    }

    const siegePower = Math.min(
      22,
      Math.sqrt(Math.max(100, siege.attackerTroops) / 1000) * 3.8
    );
    const artilleryRatio =
      (siege.attackerUnits?.airDrone || 0) / Math.max(1, siege.attackerTroops);
    const artilleryBonus = artilleryRatio * 18;
    const fortressResistance = 1 + (terr.buildings.fortress || 0) * 0.65;
    const wallBreachMult =
      siege.wallIntegrity <= 20 ? 1.35 : siege.wallIntegrity <= 50 ? 1.15 : 1.0;

    const siegeWeather = getProvinceWeather(terr, nextTick, input.gameMode);
    const attackerRulerMods = getRulerModifiers(attackerNation);
    const baseDailyAdvance =
      (((18 + siegePower + artilleryBonus) * wallBreachMult) /
        fortressResistance) *
      siegeWeather.siegeProgressMultiplier *
      (1 + attackerRulerMods.siegeSpeedBonus);
    const stepAdvance = isSubDayMode
      ? Math.max(1.2, (baseDailyAdvance * hoursStep) / 24)
      : Math.max(4.5, baseDailyAdvance);

    const nextProgress = Math.min(100, siege.progress + stepAdvance);
    const nextWall = Math.max(0, siege.wallIntegrity - stepAdvance * 0.55);

    if (nextProgress >= 100) {
      // Siege 100/100 WON! City capitulates to besieger (or returns to liberated ally!)
      const previousOwnerId = terr.ownerId;
      const survivors = Math.max(800, siege.attackerTroops);
      const siegeUnits = siege.attackerUnits || {
        infantry: survivors,
        armor: 0,
        airDrone: 0,
      };

      const captureRes = ctx.applyTerritoryCaptureOrLiberation({
        target: terr,
        conquerorId: siege.attackerId,
        survivors,
        survivingUnits: siegeUnits,
        originTerritoryId: siege.fromTerritoryId,
        unrestSpike: 22,
        wallHp: Math.max(15, Math.round(nextWall)),
        clearSiege: true,
      });

      const remainingPrevProvs = Object.values(ctx.nextTerritories).filter(
        (t) => t && t.ownerId === previousOwnerId
      );
      const prevNation = ctx.nextNations[previousOwnerId];
      const wasCapitalOfPrev = Boolean(
        terr.isCapital || prevNation?.capitalTerritoryId === terr.id
      );
      if (prevNation) {
        if (remainingPrevProvs.length === 0) {
          // Do NOT auto-annex or eliminate a nation while it is still fighting an active war!
          // Only set ±100% war score on wars where previousOwnerId is a PRIMARY war leader (attackerId / defenderId),
          // so occupying a minor 1-province ally never falsely declares 100% war victory over the main war target!
          const matchingWars = ctx.nextWars.filter(
            (w) =>
              (w.attackers.includes(siege.attackerId) &&
                w.defenders.includes(previousOwnerId)) ||
              (w.defenders.includes(siege.attackerId) &&
                w.attackers.includes(previousOwnerId))
          );
          if (matchingWars.length > 0) {
            const primaryMatchingWar = matchingWars.find(
              (w) =>
                w.defenderId === previousOwnerId ||
                w.attackerId === previousOwnerId
            );
            if (primaryMatchingWar && siege.attackerId === playerNationId) {
              ctx.toasts.push(
                `🏳️ ${prevNation.name} tüm şehirleri işgal edildi (%100 Savaş Skoru)! Barış Konferansından antlaşma şartlarını belirleyebilirsiniz.`
              );
            }
          } else {
            ctx.writeNation(previousOwnerId, {
              ...prevNation,
              isEliminated: true,
            });
          }
        } else if (prevNation.capitalTerritoryId === terr.id) {
          const newCap = remainingPrevProvs[0];
          ctx.writeNation(previousOwnerId, {
            ...prevNation,
            capitalTerritoryId: newCap.id,
          });
          ctx.writeTerritory(newCap.id, {
            ...newCap,
            isCapital: true,
          });
        }
      }

      if (siege.attackerId === playerNationId) {
        const pNat = ctx.nextNations[playerNationId];
        if (pNat) {
          ctx.writeNation(playerNationId, {
            ...pNat,
            researchPoints: Number((pNat.researchPoints + 18).toFixed(1)),
            clanInfluence: (pNat.clanInfluence ?? 120) + 15,
          });
        }
        ctx.sounds.push('SIEGE_FALL');
        if (captureRes.liberatedAllyId) {
          const allyName =
            ctx.nextNations[captureRes.liberatedAllyId]?.name || 'Müttefik';
          ctx.toasts.push(
            captureRes.returnProvName
              ? `${terr.name} kurtarılarak müttefikiniz ${allyName} devletine iade edildi; ordunuz ${captureRes.returnProvName} şehrine döndü.`
              : `${terr.name} kurtarılarak müttefikiniz ${allyName} devletine iade edildi.`
          );
          ctx.appendNews(
            `${terr.name} Kurtarıldı`,
            `${attackerNation.name}, ${terr.name} şehrini kurtararak müttefiki ${allyName} devletine iade etti.`,
            'WAR'
          );
        } else {
          ctx.toasts.push(
            `♜ ${terr.name} kuşatması (100/100) tamamlandı ve şehir ele geçirildi!`
          );
          ctx.appendNews(
            `♜ ${terr.name} Ele Geçirildi`,
            `${attackerNation.name} ordusu ${terr.name} kuşatmasını (100/100) tamamlayarak şehri fethetti.`,
            'WAR'
          );
        }
      } else if (previousOwnerId === playerNationId) {
        ctx.toasts.push(`⚠️ ${terr.name} düştü (${attackerNation.name})`);
        ctx.sounds.push('DEFEAT');
        ctx.appendNews(
          `⚠️ ${terr.name} Teslim Oldu`,
          `${attackerNation.name} ordusu ${terr.name} kuşatmasını tamamlayarak şehri ele geçirdi.`,
          'WAR'
        );
      }

      const allTerrsAfterSiege = Object.values(ctx.nextTerritories);
      ctx.nextWars = ctx.nextWars.map((w) => {
        const involvesBoth =
          (w.attackers.includes(siege.attackerId) &&
            w.defenders.includes(previousOwnerId)) ||
          (w.attackers.includes(previousOwnerId) &&
            w.defenders.includes(siege.attackerId));
        if (!involvesBoth) return w;
        const isAttackerSide = w.attackers.includes(siege.attackerId);
        const isPrimaryVictim =
          previousOwnerId === w.defenderId || previousOwnerId === w.attackerId;
        const isPrimaryConqueror =
          siege.attackerId === w.defenderId ||
          siege.attackerId === w.attackerId;

        if (isPrimaryVictim && remainingPrevProvs.length === 0) {
          return {
            ...w,
            attackerWarScore: isAttackerSide ? 100 : -100,
          };
        }

        const refNationId = isPrimaryVictim
          ? previousOwnerId
          : isPrimaryConqueror
          ? siege.attackerId
          : previousOwnerId;
        const refTotalProvs = Math.max(
          1,
          allTerrsAfterSiege.filter(
            (t) =>
              Boolean(t) &&
              (t.ownerId === refNationId ||
                (t.isOccupied &&
                  (t.occupiedFromId ?? t.coreOwnerId) === refNationId))
          ).length
        );

        const siegeDelta =
          isPrimaryVictim || isPrimaryConqueror
            ? Math.max(4, Math.min(35, Math.round(78 / refTotalProvs))) +
              (wasCapitalOfPrev ? 10 : 0)
            : Math.max(2, Math.min(6, Math.round(18 / refTotalProvs)));

        return {
          ...w,
          attackerWarScore: Math.max(
            -99,
            Math.min(
              99,
              w.attackerWarScore + (isAttackerSide ? siegeDelta : -siegeDelta)
            )
          ),
        };
      });
    } else {
      ctx.writeTerritory(terr.id, {
        ...terr,
        castleWallHp: Math.round(nextWall),
        siege: {
          ...siege,
          progress: Number(nextProgress.toFixed(1)),
          wallIntegrity: Math.round(nextWall),
        },
      });
    }
  });

  // 1C. Mid-Day Wartime Tactical AI Check (14:00) so enemy nations react swiftly during active wars
  // At 5x speed (+12h/tick), run enemy wartime AI once per full day (5 passes/sec) with bounded actor scan budget to prevent late-game world-war stutter.
  const crossedMidDay = !dayWrapped && prevHour < 14 && nextHour >= 14;
  const isMaxSpeed = input.speed === 5;
  const shouldRunWartimeAi = dayWrapped || (crossedMidDay && !isMaxSpeed);
  if ((dayWrapped || crossedMidDay) && ctx.nextWars.length > 0) {
    if (shouldRunWartimeAi) {
      const wartimeAi = evaluateWartimeAiOperations({
        nextTick,
        playerNationId,
        nations: ctx.nextNations,
        territories: ctx.nextTerritories,
        relations: ctx.nextRelations,
        wars: ctx.nextWars,
        movements: ctx.nextMovements,
        seaArmies: ctx.nextSeaArmies,
        aiAggressiveness: settings.aiAggressiveness,
        maxActionsPerPass: dayWrapped ? 3 : 2,
        maxActorsScanned: isMaxSpeed ? 14 : undefined,
      });

      if (wartimeAi) {
        ctx.nextNations = wartimeAi.updatedNations;
        ctx.nationsCloned = true;
        ctx.nextTerritories = wartimeAi.updatedTerritories;
        ctx.territoriesCloned = true;
        if (wartimeAi.newMovements.length > 0) {
          ctx.nextMovements = [...ctx.nextMovements, ...wartimeAi.newMovements];
        }
        for (const item of wartimeAi.newsItems) {
          ctx.appendNews(item.title, item.description, item.type);
        }
        if (wartimeAi.playerAlerts.length > 0) {
          ctx.sounds.push('MARCH');
          ctx.toasts.push(...wartimeAi.playerAlerts);
        }
      }
    }

    // Run Player AI Commander on both full day transition and mid-day (14:00) so wars finish without pauses
    if ((dayWrapped || crossedMidDay) && input.aiCommanderEnabled) {
      const playerAiRes = evaluatePlayerAiCommander({
        tick: nextTick,
        playerNationId,
        nations: ctx.nextNations,
        territories: ctx.nextTerritories,
        relations: ctx.nextRelations,
        wars: ctx.nextWars,
        battles: ctx.nextBattles,
        movements: ctx.nextMovements,
        seaArmies: ctx.nextSeaArmies,
        stance: input.aiCommanderStance || 'BALANCED',
      });
      if (playerAiRes && playerAiRes.newMovements.length > 0) {
        ctx.nextTerritories = playerAiRes.updatedTerritories;
        ctx.territoriesCloned = true;
        if (playerAiRes.updatedSeaArmies) {
          ctx.nextSeaArmies = playerAiRes.updatedSeaArmies;
        }
        ctx.nextMovements = [...ctx.nextMovements, ...playerAiRes.newMovements];
      }
    }
  }
}
