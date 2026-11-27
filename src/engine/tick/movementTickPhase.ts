import {
  ActiveBattle,
  ArmyMovement,
  Territory,
  UnitComposition,
} from '../../types/game';
import { COMMANDERS } from '../../data/world2026Data';
import {
  computeNationNavalBonus,
  isAtWar,
  resolveSeaRegionName,
} from '../simulationEngine';
import { classifyTerritoryTraversal } from '../pathfindingEngine';
import { checkStraitMilitaryBlockade } from '../straitsAndTradeEngine';
import { scaleUnits } from '../core/unitHelpers';
import { getProvinceWeather } from '../seasonalWeatherEngine';
import { computeUnitWeightedPower, TickContext } from './tickContext';

/**
 * Phase 1: Advance army/naval movements (including multi-hop A* routeQueue),
 * resolve mid-march field & open-sea interceptions (Meydan / Deniz Muharebesi),
 * station or clash naval fleets, handle strait blockades, and initiate or reinforce on-map battles & sieges.
 */
export function runMovementTickPhase(ctx: TickContext): void {
  const { input, isSubDayMode, hoursStep, nextTick, playerNationId, relations } = ctx;
  if (input.movements.length === 0) return;

  const arrived: ArmyMovement[] = [];
  const baseProgressStep = isSubDayMode
    ? Math.max(4, Math.round((48 * hoursStep) / 24))
    : 25;
  const dayFraction = isSubDayMode ? hoursStep / 24 : 1;

  const steppedMovements = input.movements.map((mv) => {
    const baseUnits = mv.units || { infantry: mv.troops, armor: 0, airDrone: 0 };
    const destTerr = ctx.nextTerritories[mv.toTerritoryId];
    const originTerr = ctx.nextTerritories[mv.fromTerritoryId];
    const weatherTerr = destTerr || originTerr;
    const weather = weatherTerr
      ? getProvinceWeather(weatherTerr, nextTick, input.gameMode)
      : null;

    // Land marches scale with terrain + seasonal weather (winter snow, monsoon mud, heatwave).
    // Naval fleets only experience mild open-water drag during severe winter or monsoon storms.
    const speedMult = mv.isNaval
      ? weather && (weather.condition === 'SEVERE_WINTER' || weather.condition === 'MONSOON')
        ? 0.88
        : 1.0
      : weather
      ? weather.movementSpeedMultiplier
      : 1.0;

    const effectiveStep = Math.max(2, Math.round(baseProgressStep * speedMult));

    // Exposed overland armies marching through severe winter, monsoon, or desert heatwave suffer transit attrition
    // scaled by the fraction of this step actually spent in transit before arriving at the destination.
    let nextTroops = mv.troops;
    let nextUnits = baseUnits;
    const distanceTraveled = Math.max(0, Math.min(effectiveStep, 100 - mv.progress));
    const transitStepRatio = effectiveStep > 0 ? distanceTraveled / effectiveStep : 0;
    if (
      !mv.isNaval &&
      weather &&
      weather.marchAttritionRate > 0 &&
      mv.troops > 1500 &&
      transitStepRatio > 0
    ) {
      const loss = Math.round(
        mv.troops * weather.marchAttritionRate * dayFraction * transitStepRatio
      );
      if (loss > 0) {
        const survived = Math.max(1200, mv.troops - loss);
        nextUnits = scaleUnits(baseUnits, survived / Math.max(1, mv.troops));
        nextTroops = survived;
      }
    }

    return {
      ...mv,
      troops: nextTroops,
      units: nextUnits,
      progress: mv.progress + effectiveStep,
    };
  });
  const prevProgressMap = new Map<string, number>();
  input.movements.forEach((mv) => prevProgressMap.set(mv.id, mv.progress));

  const getMovementEndpoints = (
    mv: ArmyMovement
  ): { start: [number, number]; end: [number, number] } | null => {
    const start =
      mv.fromCoords || ctx.nextTerritories[mv.fromTerritoryId]?.centroid || null;
    const end =
      mv.toCoords || ctx.nextTerritories[mv.toTerritoryId]?.centroid || null;
    if (!start || !end) return null;
    return { start, end };
  };

  // 1.0 Mid-March Hostile Army Interception (Meydan Muharebesi):
  // When two warring armies cross the same road in opposite directions, converge on the same node, or pass side-by-side on the map, they clash immediately in the field!
  for (let i = 0; i < steppedMovements.length; i++) {
    const mvA = steppedMovements[i];
    if (!mvA || mvA.troops <= 0) continue;

    for (let j = i + 1; j < steppedMovements.length; j++) {
      const mvB = steppedMovements[j];
      if (!mvB || mvB.troops <= 0) continue;
      if (mvA.ownerId === mvB.ownerId) continue;
      if (!isAtWar(ctx.nextWars, mvA.ownerId, mvB.ownerId)) continue;

      const anyNaval = Boolean(
        mvA.isNaval || mvB.isNaval || mvA.toCoords || mvB.toCoords
      );
      const isOppositeSameEdge =
        Boolean(mvA.fromTerritoryId && mvA.toTerritoryId) &&
        mvA.fromTerritoryId === mvB.toTerritoryId &&
        mvA.toTerritoryId === mvB.fromTerritoryId &&
        mvA.progress + mvB.progress >= (anyNaval ? 50 : 65);

      const isSameDestinationConvergence =
        Boolean(mvA.toTerritoryId) &&
        mvA.toTerritoryId === mvB.toTerritoryId &&
        mvA.progress >= (anyNaval ? 42 : 50) &&
        mvB.progress >= (anyNaval ? 42 : 50);

      const isOriginIntercept =
        (mvA.fromTerritoryId === mvB.toTerritoryId &&
          mvA.progress <= 48 &&
          mvB.progress >= 58) ||
        (mvB.fromTerritoryId === mvA.toTerritoryId &&
          mvB.progress <= 48 &&
          mvA.progress >= 58) ||
        (Boolean(mvA.fromTerritoryId) &&
          mvA.fromTerritoryId === mvB.fromTerritoryId &&
          Math.abs(mvA.progress - mvB.progress) <= 40);

      let isSideBySideProximity = false;
      const epA = getMovementEndpoints(mvA);
      const epB = getMovementEndpoints(mvB);
      if (epA && epB) {
        const pA0 = Math.max(
          0,
          Math.min(1, (prevProgressMap.get(mvA.id) ?? mvA.progress) / 100)
        );
        const pA1 = Math.max(0, Math.min(1, mvA.progress / 100));
        const pB0 = Math.max(
          0,
          Math.min(1, (prevProgressMap.get(mvB.id) ?? mvB.progress) / 100)
        );
        const pB1 = Math.max(0, Math.min(1, mvB.progress / 100));
        const proximityThreshold = anyNaval ? 5.5 : 2.65;

        for (const s of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
          const tA = pA0 + (pA1 - pA0) * s;
          const tB = pB0 + (pB1 - pB0) * s;
          const lonA = epA.start[0] + (epA.end[0] - epA.start[0]) * tA;
          const latA = epA.start[1] + (epA.end[1] - epA.start[1]) * tA;
          const lonB = epB.start[0] + (epB.end[0] - epB.start[0]) * tB;
          const latB = epB.start[1] + (epB.end[1] - epB.start[1]) * tB;
          if (Math.hypot(lonA - lonB, latA - latB) <= proximityThreshold) {
            isSideBySideProximity = true;
            break;
          }
        }
      }

      if (
        !isOppositeSameEdge &&
        !isSameDestinationConvergence &&
        !isOriginIntercept &&
        !isSideBySideProximity
      ) {
        continue;
      }

      // Resolve Field / Open-Sea Interception Battle (Meydan veya Deniz Muharebesi) between mvA and mvB!
      const natA = ctx.nextNations[mvA.ownerId];
      const natB = ctx.nextNations[mvB.ownerId];
      const cmdA = natA?.activeGeneralId
        ? COMMANDERS.find((c) => c.id === natA.activeGeneralId)
        : null;
      const cmdB = natB?.activeGeneralId
        ? COMMANDERS.find((c) => c.id === natB.activeGeneralId)
        : null;
      const navalMultA = anyNaval
        ? computeNationNavalBonus(mvA.ownerId, ctx.nextTerritories, natA)
        : 1;
      const navalMultB = anyNaval
        ? computeNationNavalBonus(mvB.ownerId, ctx.nextTerritories, natB)
        : 1;
      const multA =
        (1 +
          ((cmdA?.attackBonus || 0) +
            (natA?.unlockedTechs.includes('mil_6') ? 15 : 0)) /
            100) *
        navalMultA;
      const multB =
        (1 +
          ((cmdB?.attackBonus || 0) +
            (natB?.unlockedTechs.includes('mil_6') ? 15 : 0)) /
            100) *
        navalMultB;

      const powA = computeUnitWeightedPower(mvA.units, mvA.troops, natA) * multA;
      const powB = computeUnitWeightedPower(mvB.units, mvB.troops, natB) * multB;

      const aWins = powA >= powB;
      const winner = aWins ? mvA : mvB;
      const loser = aWins ? mvB : mvA;
      const winPow = aWins ? powA : powB;
      const losePow = aWins ? powB : powA;

      const winLossRatio = Math.min(
        0.66,
        (losePow / Math.max(1, winPow)) * 0.54
      );
      const winSurvivors = Math.max(
        400,
        Math.round(winner.troops * (1 - winLossRatio))
      );
      const winLosses = Math.max(0, winner.troops - winSurvivors);

      // Shattered loser retreats a small surviving fraction (~20%) back to its origin province if owned (land only)
      const retreatRatio = Math.min(
        0.22,
        (losePow / Math.max(1, winPow)) * 0.2
      );
      const loserOriginTerr =
        !anyNaval && !loser.fromCoords && loser.fromTerritoryId
          ? ctx.nextTerritories[loser.fromTerritoryId]
          : undefined;
      const canRetreatToOrigin = Boolean(
        loserOriginTerr && loserOriginTerr.ownerId === loser.ownerId
      );
      const loserRetreatSurvivors =
        canRetreatToOrigin && loser.troops >= 1200
          ? Math.round(loser.troops * retreatRatio)
          : 0;
      const loserLosses = Math.max(0, loser.troops - loserRetreatSurvivors);

      if (canRetreatToOrigin && loserOriginTerr && loserRetreatSurvivors > 0) {
        const retUnits = scaleUnits(
          loser.units,
          loserRetreatSurvivors / Math.max(1, loser.troops)
        );
        ctx.writeTerritory(loserOriginTerr.id, {
          ...loserOriginTerr,
          garrison: loserOriginTerr.garrison + loserRetreatSurvivors,
          units: {
            infantry:
              (loserOriginTerr.units?.infantry || 0) + (retUnits.infantry || 0),
            armor: (loserOriginTerr.units?.armor || 0) + (retUnits.armor || 0),
            airDrone:
              (loserOriginTerr.units?.airDrone || 0) + (retUnits.airDrone || 0),
          },
        });
      }

      const prevWinnerTroops = winner.troops;
      const prevLoserTroops = loser.troops;
      winner.troops = winSurvivors;
      winner.units = scaleUnits(
        winner.units,
        winSurvivors / Math.max(1, prevWinnerTroops)
      );
      loser.troops = 0;
      loser.units = { infantry: 0, armor: 0, airDrone: 0 };

      const locA =
        winner.targetSeaName ||
        ctx.nextTerritories[winner.fromTerritoryId]?.name ||
        ctx.nextTerritories[winner.toTerritoryId]?.name ||
        (anyNaval ? 'Açık Deniz' : 'Cephe');
      const locB =
        loser.targetSeaName ||
        ctx.nextTerritories[winner.toTerritoryId]?.name ||
        ctx.nextTerritories[loser.fromTerritoryId]?.name ||
        (anyNaval ? 'Deniz Hattı' : 'Sınır');
      const fieldLabel = locA !== locB ? `${locA} - ${locB} Hattı` : locA;
      const winNationName = ctx.nextNations[winner.ownerId]?.name || winner.ownerId;
      const loseNationName = ctx.nextNations[loser.ownerId]?.name || loser.ownerId;
      const battleKindLabel = anyNaval
        ? '⚓ Deniz Muharebesi'
        : '⚔️ Meydan Muharebesi';

      if (winner.ownerId === playerNationId) {
        ctx.sounds.push('SELECT_TERRITORY');
        ctx.toasts.push(
          `${battleKindLabel} (${fieldLabel}): ${anyNaval ? 'Donanmamız' : 'Ordumuz'} yolda karşılaştığı ${loseNationName} ${anyNaval ? 'filosunu' : 'ordusunu'} (${prevLoserTroops.toLocaleString('tr-TR')} asker) ${anyNaval ? 'batırdı' : 'bozguna uğrattı'} ve ilerlemeye devam ediyor!`
        );
        ctx.appendNews(
          `${anyNaval ? '⚓ Deniz Muharebesi Zaferi' : '⚔️ Meydan Zaferi'}: ${fieldLabel}`,
          `${winNationName} ${anyNaval ? 'donanması' : 'ordusu'} seyir halinde karşılaştığı ${loseNationName} kuvvetlerini (${prevLoserTroops.toLocaleString('tr-TR')} asker) imha etti.`,
          'WAR'
        );
      } else if (loser.ownerId === playerNationId) {
        ctx.toasts.push(
          `⚠️ ${battleKindLabel} (${fieldLabel}): Seyir halindeki ${anyNaval ? 'donanmamız' : 'ordumuz'} (${prevLoserTroops.toLocaleString('tr-TR')} asker) ${winNationName} kuvvetleriyle çarpışarak durduruldu!`
        );
        ctx.appendNews(
          `⚠️ ${battleKindLabel} Kaybı: ${fieldLabel}`,
          `Hareket halindeki kuvvetlerimiz ${fieldLabel} üzerinde ${winNationName} ${anyNaval ? 'donanmasıyla' : 'ordusuyla'} çarpışarak durduruldu.`,
          'WAR'
        );
      }

      // Update active war casualties and war score (+/- 12)
      const fieldScoreShift = 12;
      ctx.nextWars = ctx.nextWars.map((w) => {
        const winIsWarAtt =
          w.attackers.includes(winner.ownerId) &&
          w.defenders.includes(loser.ownerId);
        const winIsWarDef =
          w.defenders.includes(winner.ownerId) &&
          w.attackers.includes(loser.ownerId);
        if (!winIsWarAtt && !winIsWarDef) return w;
        return {
          ...w,
          attackerWarScore: Math.max(
            -100,
            Math.min(
              100,
              w.attackerWarScore +
                (winIsWarAtt ? fieldScoreShift : -fieldScoreShift)
            )
          ),
          casualtiesAttacker:
            w.casualtiesAttacker + (winIsWarAtt ? winLosses : loserLosses),
          casualtiesDefender:
            w.casualtiesDefender + (winIsWarAtt ? loserLosses : winLosses),
        };
      });

      if (mvA.troops <= 0) break;
    }
  }

  // 1.0B Mid-Voyage Naval Movement vs Anchored Hostile SeaArmy Interception:
  // If a naval movement (embarking fleet, sailing fleet, or amphibious invasion) passes within 5.0° of an anchored hostile SeaArmy mid-voyage, they clash immediately at sea!
  if (ctx.nextSeaArmies.length > 0) {
    for (let i = 0; i < steppedMovements.length; i++) {
      const mv = steppedMovements[i];
      if (!mv || mv.troops <= 0) continue;
      // Movements reaching an open-sea coordinate destination on this step are resolved in the arrival block below (which stations/merges the fleet)
      if (mv.progress >= 100 && mv.toCoords) continue;
      const isNavalMove = Boolean(mv.isNaval || mv.toCoords || mv.fromCoords);
      if (!isNavalMove) continue;

      const ep = getMovementEndpoints(mv);
      if (!ep) continue;
      const p0 = Math.max(
        0,
        Math.min(1, (prevProgressMap.get(mv.id) ?? mv.progress) / 100)
      );
      const p1 = Math.max(0, Math.min(1, mv.progress / 100));

      let interceptedFleetIdx = -1;
      for (let fIdx = 0; fIdx < ctx.nextSeaArmies.length; fIdx++) {
        const fleet = ctx.nextSeaArmies[fIdx];
        if (!fleet || fleet.troops <= 0 || fleet.ownerId === mv.ownerId) continue;
        if (!isAtWar(ctx.nextWars, mv.ownerId, fleet.ownerId)) continue;

        for (const s of [0, 0.25, 0.5, 0.75, 1]) {
          const t = p0 + (p1 - p0) * s;
          const lon = ep.start[0] + (ep.end[0] - ep.start[0]) * t;
          const lat = ep.start[1] + (ep.end[1] - ep.start[1]) * t;
          if (Math.hypot(lon - fleet.coords[0], lat - fleet.coords[1]) <= 5.0) {
            interceptedFleetIdx = fIdx;
            break;
          }
        }
        if (interceptedFleetIdx !== -1) break;
      }

      if (interceptedFleetIdx === -1) continue;

      const enemyFleet = ctx.nextSeaArmies[interceptedFleetIdx];
      const attNationName = ctx.nextNations[mv.ownerId]?.name || mv.ownerId;
      const defNationName =
        ctx.nextNations[enemyFleet.ownerId]?.name || enemyFleet.ownerId;
      const attNavalMult = computeNationNavalBonus(
        mv.ownerId,
        ctx.nextTerritories,
        ctx.nextNations[mv.ownerId]
      );
      const defNavalMult = computeNationNavalBonus(
        enemyFleet.ownerId,
        ctx.nextTerritories,
        ctx.nextNations[enemyFleet.ownerId]
      );
      const attPow =
        computeUnitWeightedPower(
          mv.units,
          mv.troops,
          ctx.nextNations[mv.ownerId]
        ) * attNavalMult;
      const defPow =
        computeUnitWeightedPower(
          enemyFleet.units,
          enemyFleet.troops,
          ctx.nextNations[enemyFleet.ownerId]
        ) * defNavalMult;

      const attWon = attPow >= defPow;
      let attLosses = 0;
      let defLosses = 0;
      const seaZoneName =
        enemyFleet.name ||
        mv.targetSeaName ||
        resolveSeaRegionName(enemyFleet.coords);

      if (attWon) {
        const lossRatio = Math.min(0.65, (defPow / Math.max(1, attPow)) * 0.52);
        const survivors = Math.max(400, Math.round(mv.troops * (1 - lossRatio)));
        attLosses = Math.max(0, mv.troops - survivors);
        defLosses = enemyFleet.troops;
        const prevMvTroops = mv.troops;
        mv.troops = survivors;
        mv.units = scaleUnits(mv.units, survivors / Math.max(1, prevMvTroops));
        ctx.nextSeaArmies.splice(interceptedFleetIdx, 1);

        if (mv.ownerId === playerNationId) {
          ctx.sounds.push('SELECT_TERRITORY');
          ctx.toasts.push(
            `⚓ Deniz Muharebesi (${seaZoneName}): Seyir halindeki donanmamız yolunu kesen ${defNationName} filosunu batırdı ve rotasına devam ediyor!`
          );
          ctx.appendNews(
            `⚓ Açık Deniz Zaferi: ${seaZoneName}`,
            `${attNationName} donanması seyir halindeyken karşılaştığı ${defNationName} filosunu (${enemyFleet.troops.toLocaleString('tr-TR')} asker) batırdı.`,
            'WAR'
          );
        } else if (enemyFleet.ownerId === playerNationId) {
          ctx.toasts.push(
            `⚠️ Deniz Yenilgisi: ${enemyFleet.name} yanından geçen ${attNationName} donanmasıyla girdiği çatışmada batırıldı!`
          );
          ctx.appendNews(
            `⚠️ Donanma Kaybı: ${enemyFleet.name}`,
            `${attNationName} filosu açık denizde ${enemyFleet.name} donanmamızı imha etti.`,
            'WAR'
          );
        }
      } else {
        const lossRatio = Math.min(0.65, (attPow / Math.max(1, defPow)) * 0.52);
        const defSurvivors = Math.max(
          400,
          Math.round(enemyFleet.troops * (1 - lossRatio))
        );
        attLosses = mv.troops;
        defLosses = Math.max(0, enemyFleet.troops - defSurvivors);
        ctx.nextSeaArmies[interceptedFleetIdx] = {
          ...enemyFleet,
          troops: defSurvivors,
          units: scaleUnits(
            enemyFleet.units,
            defSurvivors / Math.max(1, enemyFleet.troops)
          ),
        };
        mv.troops = 0;
        mv.units = { infantry: 0, armor: 0, airDrone: 0 };

        if (mv.ownerId === playerNationId) {
          ctx.toasts.push(
            `⚠️ Deniz Muharebesi (${seaZoneName}): Donanmamız yol üzerindeki ${defNationName} (${enemyFleet.name}) filosu tarafından durduruldu ve batırıldı!`
          );
          ctx.appendNews(
            `⚠️ Deniz Harekatı Durduruldu: ${seaZoneName}`,
            `${defNationName} donanması, seyir halindeki ${attNationName} filosunu açık denizde imha etti.`,
            'WAR'
          );
        } else if (enemyFleet.ownerId === playerNationId) {
          ctx.sounds.push('SELECT_TERRITORY');
          ctx.toasts.push(
            `⚓ Deniz Savunma Zaferi: ${enemyFleet.name}, yanından geçen ${attNationName} çıkarma filosunu batırdı!`
          );
          ctx.appendNews(
            `⚓ Deniz Savunma Zaferi: ${enemyFleet.name}`,
            `${enemyFleet.name}, yakınından geçen ${attNationName} filosunu (${attLosses.toLocaleString('tr-TR')} asker) açık denizde imha etti.`,
            'WAR'
          );
        }
      }

      const scoreShift = attWon ? 10 : -10;
      ctx.nextWars = ctx.nextWars.map((w) => {
        const attIsWarAtt =
          w.attackers.includes(mv.ownerId) &&
          w.defenders.includes(enemyFleet.ownerId);
        const attIsWarDef =
          w.defenders.includes(mv.ownerId) &&
          w.attackers.includes(enemyFleet.ownerId);
        if (!attIsWarAtt && !attIsWarDef) return w;
        return {
          ...w,
          attackerWarScore: Math.max(
            -100,
            Math.min(
              100,
              w.attackerWarScore + (attIsWarAtt ? scoreShift : -scoreShift)
            )
          ),
          casualtiesAttacker:
            w.casualtiesAttacker + (attIsWarAtt ? attLosses : defLosses),
          casualtiesDefender:
            w.casualtiesDefender + (attIsWarAtt ? defLosses : attLosses),
        };
      });
    }
  }

  for (const mv of steppedMovements) {
    if (!mv || mv.troops <= 0) continue;
    if (mv.progress >= 100) {
      arrived.push({ ...mv, progress: 100 });
    } else {
      ctx.nextMovements.push(mv);
    }
  }

  for (const mv of arrived) {
    // Naval arrival onto open sea coordinates -> Station / merge SeaArmy or resolve naval clash!
    if (mv.toCoords) {
      const destCoords = mv.toCoords;
      const mergeTargetIdx = mv.targetSeaArmyId
        ? ctx.nextSeaArmies.findIndex(
            (s) => s.id === mv.targetSeaArmyId && s.ownerId === mv.ownerId
          )
        : ctx.nextSeaArmies.findIndex(
            (s) =>
              s.ownerId === mv.ownerId &&
              Math.hypot(
                s.coords[0] - destCoords[0],
                s.coords[1] - destCoords[1]
              ) <= 3.8
          );

      if (mergeTargetIdx !== -1) {
        const existing = ctx.nextSeaArmies[mergeTargetIdx];
        ctx.nextSeaArmies[mergeTargetIdx] = {
          ...existing,
          troops: existing.troops + mv.troops,
          units: {
            infantry:
              (existing.units?.infantry || 0) + (mv.units?.infantry || mv.troops),
            armor: (existing.units?.armor || 0) + (mv.units?.armor || 0),
            airDrone: (existing.units?.airDrone || 0) + (mv.units?.airDrone || 0),
          },
        };
        if (mv.ownerId === playerNationId) {
          ctx.toasts.push(
            `${existing.name} takviye edildi (${(ctx.nextSeaArmies[mergeTargetIdx].troops / 1000).toFixed(1)}B asker).`
          );
        }
        continue;
      }

      // Check for hostile fleet interception at destination coordinates (5.5 deg sea zone)
      const enemyFleetIdx = ctx.nextSeaArmies.findIndex(
        (s) =>
          s.ownerId !== mv.ownerId &&
          Boolean(isAtWar(ctx.nextWars, mv.ownerId, s.ownerId)) &&
          Math.hypot(
            s.coords[0] - destCoords[0],
            s.coords[1] - destCoords[1]
          ) <= 5.5
      );

      if (enemyFleetIdx !== -1) {
        const enemyFleet = ctx.nextSeaArmies[enemyFleetIdx];
        const attNationName = ctx.nextNations[mv.ownerId]?.name || mv.ownerId;
        const defNationName =
          ctx.nextNations[enemyFleet.ownerId]?.name || enemyFleet.ownerId;
        const attNavalMult = computeNationNavalBonus(
          mv.ownerId,
          ctx.nextTerritories,
          ctx.nextNations[mv.ownerId]
        );
        const defNavalMult = computeNationNavalBonus(
          enemyFleet.ownerId,
          ctx.nextTerritories,
          ctx.nextNations[enemyFleet.ownerId]
        );
        const attPow =
          computeUnitWeightedPower(
            mv.units,
            mv.troops,
            ctx.nextNations[mv.ownerId]
          ) * attNavalMult;
        const defPow =
          computeUnitWeightedPower(
            enemyFleet.units,
            enemyFleet.troops,
            ctx.nextNations[enemyFleet.ownerId]
          ) * defNavalMult;

        const attWon = attPow >= defPow;
        let attLosses = 0;
        let defLosses = 0;
        const seaZoneName =
          mv.targetSeaName ||
          enemyFleet.name ||
          resolveSeaRegionName(destCoords);

        if (attWon) {
          const lossRatio = Math.min(0.65, (defPow / Math.max(1, attPow)) * 0.52);
          const survivors = Math.max(400, Math.round(mv.troops * (1 - lossRatio)));
          attLosses = Math.max(0, mv.troops - survivors);
          defLosses = enemyFleet.troops;
          ctx.nextSeaArmies.splice(enemyFleetIdx, 1);
          ctx.nextSeaArmies.push({
            id: `sea_${nextTick}_${Math.random().toString(36).slice(2, 7)}`,
            ownerId: mv.ownerId,
            name: seaZoneName,
            coords: destCoords,
            troops: survivors,
            units: scaleUnits(mv.units, survivors / Math.max(1, mv.troops)),
            anchorCoastId: mv.fromTerritoryId,
          });
          if (mv.ownerId === playerNationId) {
            ctx.sounds.push('SELECT_TERRITORY');
            ctx.toasts.push(
              `Deniz Zaferi (${seaZoneName}): ${defNationName} donanması batırıldı (${(survivors / 1000).toFixed(1)}B asker hayatta).`
            );
            ctx.appendNews(
              `Deniz Muharebesi Zaferi: ${seaZoneName}`,
              `${attNationName} donanması açık denizde ${defNationName} filosunu (${enemyFleet.troops.toLocaleString('tr-TR')} asker) imha etti.`,
              'WAR'
            );
          } else if (enemyFleet.ownerId === playerNationId) {
            ctx.toasts.push(
              `Deniz Yenilgisi: ${enemyFleet.name} düşman ${attNationName} donanması tarafından batırıldı!`
            );
            ctx.appendNews(
              `Donanma Kaybı: ${enemyFleet.name}`,
              `${attNationName} filosu açık deniz muharebesinde ${enemyFleet.name} birliğimizi imha etti.`,
              'WAR'
            );
          }
        } else {
          const lossRatio = Math.min(0.65, (attPow / Math.max(1, defPow)) * 0.52);
          const defSurvivors = Math.max(
            400,
            Math.round(enemyFleet.troops * (1 - lossRatio))
          );
          attLosses = mv.troops;
          defLosses = Math.max(0, enemyFleet.troops - defSurvivors);
          ctx.nextSeaArmies[enemyFleetIdx] = {
            ...enemyFleet,
            troops: defSurvivors,
            units: scaleUnits(
              enemyFleet.units,
              defSurvivors / Math.max(1, enemyFleet.troops)
            ),
          };
          if (mv.ownerId === playerNationId) {
            ctx.toasts.push(
              `Donanma taarruzu ${defNationName} (${enemyFleet.name}) karşısında püskürtüldü!`
            );
            ctx.appendNews(
              `Deniz Taarruzu Başarısız: ${seaZoneName}`,
              `${defNationName} donanması, ${attNationName} filosunun saldırısını püskürttü.`,
              'WAR'
            );
          } else if (enemyFleet.ownerId === playerNationId) {
            ctx.sounds.push('SELECT_TERRITORY');
            ctx.toasts.push(
              `${enemyFleet.name}, ${attNationName} donanmasının saldırısını püskürttü!`
            );
            ctx.appendNews(
              `Deniz Savunma Zaferi: ${enemyFleet.name}`,
              `${enemyFleet.name}, ${attNationName} filosunu (${mv.troops.toLocaleString('tr-TR')} asker) açık denizde imha etti.`,
              'WAR'
            );
          }
        }

        // Update active war casualties and naval war score (+/- 8)
        const scoreShift = attWon ? 8 : -8;
        ctx.nextWars = ctx.nextWars.map((w) => {
          const attIsWarAtt =
            w.attackers.includes(mv.ownerId) &&
            w.defenders.includes(enemyFleet.ownerId);
          const attIsWarDef =
            w.defenders.includes(mv.ownerId) &&
            w.attackers.includes(enemyFleet.ownerId);
          if (!attIsWarAtt && !attIsWarDef) return w;
          return {
            ...w,
            attackerWarScore: Math.max(
              -100,
              Math.min(
                100,
                w.attackerWarScore + (attIsWarAtt ? scoreShift : -scoreShift)
              )
            ),
            casualtiesAttacker:
              w.casualtiesAttacker + (attIsWarAtt ? attLosses : defLosses),
            casualtiesDefender:
              w.casualtiesDefender + (attIsWarAtt ? defLosses : attLosses),
          };
        });
        continue;
      }

      // Station new SeaArmy peacefully on open water!
      const seaLabel = mv.targetSeaName || resolveSeaRegionName(destCoords);
      ctx.nextSeaArmies.push({
        id: `sea_${nextTick}_${Math.random().toString(36).slice(2, 7)}`,
        ownerId: mv.ownerId,
        name: seaLabel,
        coords: destCoords,
        troops: mv.troops,
        units: mv.units || { infantry: mv.troops, armor: 0, airDrone: 0 },
        anchorCoastId: mv.fromTerritoryId,
      });
      if (mv.ownerId === playerNationId) {
        ctx.sounds.push('SELECT_TERRITORY');
        ctx.toasts.push(
          `${seaLabel} demir attı (${(mv.troops / 1000).toFixed(1)}B asker). Tıklayarak kıyıya çıkarma yapabilirsiniz.`
        );
      }
      continue;
    }

    const target = ctx.nextTerritories[mv.toTerritoryId];
    if (!target) continue;

    const hasMoreHops = Boolean(mv.routeQueue && mv.routeQueue.length > 0);
    const targetAccess = classifyTerritoryTraversal({
      terr: target,
      toId: mv.finalDestinationId || mv.toTerritoryId,
      moverNationId: mv.ownerId,
      nations: ctx.nextNations,
      relations,
      wars: ctx.nextWars,
      allowTargetWarDeclaration: false,
    });

    // Multi-Hop Transit: If passing through a friendly/allied corridor toward a further destination, march on to next hop!
    if (hasMoreHops && targetAccess === 'FRIENDLY_PASS') {
      const [nextHopId, ...restQueue] = mv.routeQueue!;
      const nextHopTerr = ctx.nextTerritories[nextHopId];
      const straitCheck = checkStraitMilitaryBlockade({
        fromId: mv.toTerritoryId,
        toId: nextHopId,
        moverNationId: mv.ownerId,
        territories: ctx.nextTerritories,
        wars: ctx.nextWars,
      });
      if (straitCheck.blocked) {
        if (target.ownerId === mv.ownerId) {
          ctx.writeTerritory(target.id, {
            ...target,
            garrison: target.garrison + mv.troops,
            units: {
              infantry: (target.units?.infantry || 0) + (mv.units?.infantry || mv.troops),
              armor: (target.units?.armor || 0) + (mv.units?.armor || 0),
              airDrone: (target.units?.airDrone || 0) + (mv.units?.airDrone || 0),
            },
          });
          if (mv.ownerId === playerNationId && straitCheck.reason) {
            ctx.toasts.push(straitCheck.reason);
          }
        } else {
          const retName = ctx.returnAttackerTroopsHome({
            attackerId: mv.ownerId,
            troops: mv.troops,
            units: mv.units,
            fromTerritoryId: mv.fromTerritoryId,
            nearTerritoryId: target.id,
          });
          if (mv.ownerId === playerNationId) {
            ctx.toasts.push(
              straitCheck.reason ||
                `⚓ Boğaz geçişi kapandı; ordunuz ${retName || 'merkez'} garnizonuna döndü.`
            );
          }
        }
        continue;
      }
      if (nextHopTerr) {
        const nextHopAccess = classifyTerritoryTraversal({
          terr: nextHopTerr,
          toId: mv.finalDestinationId || nextHopId,
          moverNationId: mv.ownerId,
          nations: ctx.nextNations,
          relations,
          wars: ctx.nextWars,
          allowTargetWarDeclaration: false,
        });
        if (nextHopAccess === 'BLOCKED') {
          if (target.ownerId === mv.ownerId) {
            ctx.writeTerritory(target.id, {
              ...target,
              garrison: target.garrison + mv.troops,
              units: {
                infantry: (target.units?.infantry || 0) + (mv.units?.infantry || mv.troops),
                armor: (target.units?.armor || 0) + (mv.units?.armor || 0),
                airDrone: (target.units?.airDrone || 0) + (mv.units?.airDrone || 0),
              },
            });
            if (mv.ownerId === playerNationId) {
              ctx.toasts.push(
                `🛑 ${nextHopTerr.name} sınırı kapandı; ordunuz ${target.name} garnizonunda durdu.`
              );
            }
          } else {
            const retName = ctx.returnAttackerTroopsHome({
              attackerId: mv.ownerId,
              troops: mv.troops,
              units: mv.units,
              fromTerritoryId: mv.fromTerritoryId,
              nearTerritoryId: target.id,
            });
            if (mv.ownerId === playerNationId) {
              ctx.toasts.push(
                `🛑 ${nextHopTerr.name} geçişi kapandı; ordunuz ${retName || 'merkez'} garnizonuna döndü.`
              );
            }
          }
          continue;
        }
        ctx.nextMovements.push({
          ...mv,
          fromTerritoryId: mv.toTerritoryId,
          toTerritoryId: nextHopId,
          routeQueue: restQueue,
          progress: 12,
          isAttack:
            nextHopTerr.ownerId !== mv.ownerId &&
            Boolean(isAtWar(ctx.nextWars, mv.ownerId, nextHopTerr.ownerId)),
        });
        continue;
      }
    }

    // Check if there is already an active battle on target territory
    const existingBattleIdx = ctx.nextBattles.findIndex(
      (b) => b.territoryId === mv.toTerritoryId
    );

    const createOnMapBattle = (args: {
      terr: Territory;
      attackerId: string;
      attackerTroops: number;
      attackerUnits: UnitComposition;
      fromTerritoryId?: string;
      defenderId: string;
      defenderTroops: number;
      defenderUnits: UnitComposition;
    }): ActiveBattle => {
      const attNation = ctx.nextNations[args.attackerId];
      const defNation = ctx.nextNations[args.defenderId];
      const attCmd = attNation?.activeGeneralId
        ? COMMANDERS.find((c) => c.id === attNation.activeGeneralId)
        : null;
      const defCmd = defNation?.activeGeneralId
        ? COMMANDERS.find((c) => c.id === defNation.activeGeneralId)
        : null;
      const terrWidth =
        args.terr.terrain === 'DAGLIK'
          ? 12000
          : args.terr.terrain === 'METROPOL'
          ? 18000
          : args.terr.terrain === 'ORMAN'
          ? 20000
          : args.terr.terrain === 'COL'
          ? 25000
          : 35000;
      const attU = args.attackerUnits || {
        infantry: args.attackerTroops,
        armor: 0,
        airDrone: 0,
      };
      const defU = args.defenderUnits || {
        infantry: args.defenderTroops,
        armor: 0,
        airDrone: 0,
      };

      return {
        id: `btl_${nextTick}_${args.terr.id}`,
        territoryId: args.terr.id,
        fromTerritoryId: args.fromTerritoryId,
        attackerId: args.attackerId,
        defenderId: args.defenderId,
        attackerTroops: args.attackerTroops,
        attackerInitialTroops: args.attackerTroops,
        attackerUnits: attU,
        attackerFrontline: attU.infantry + attU.armor,
        attackerBackline: attU.airDrone,
        defenderTroops: args.defenderTroops,
        defenderInitialTroops: args.defenderTroops,
        defenderUnits: defU,
        defenderFrontline: defU.infantry + defU.armor,
        defenderBackline: defU.airDrone,
        round: 0,
        combatWidth: terrWidth,
        attackerMorale: 100,
        defenderMorale: 100,
        attackerCommanderName: attCmd?.name,
        defenderCommanderName: defCmd?.name,
      };
    };

    // Final arrival in own territory -> Friendly reinforcement (or reinforce/launch defense against an active siege!)
    if (target.ownerId === mv.ownerId) {
      const nextGarrison = target.garrison + mv.troops;
      const nextDefUnits = {
        infantry:
          (target.units?.infantry || 0) + (mv.units?.infantry || mv.troops),
        armor: (target.units?.armor || 0) + (mv.units?.armor || 0),
        airDrone: (target.units?.airDrone || 0) + (mv.units?.airDrone || 0),
      };
      ctx.writeTerritory(mv.toTerritoryId, {
        ...target,
        garrison: nextGarrison,
        units: nextDefUnits,
      });

      if (existingBattleIdx !== -1) {
        const btl = ctx.nextBattles[existingBattleIdx];
        ctx.nextBattles[existingBattleIdx] = {
          ...btl,
          defenderTroops: btl.defenderTroops + mv.troops,
          defenderInitialTroops:
            (btl.defenderInitialTroops || btl.defenderTroops) + mv.troops,
          defenderUnits: {
            infantry:
              (btl.defenderUnits?.infantry || 0) +
              (mv.units?.infantry || mv.troops),
            armor: (btl.defenderUnits?.armor || 0) + (mv.units?.armor || 0),
            airDrone:
              (btl.defenderUnits?.airDrone || 0) + (mv.units?.airDrone || 0),
          },
        };
      } else if (target.siege && nextGarrison > 350) {
        // Friendly relief force breaks/engages the besieger in an immediate battle!
        const siege = target.siege;
        ctx.nextBattles.push(
          createOnMapBattle({
            terr: target,
            attackerId: siege.attackerId,
            attackerTroops: siege.attackerTroops,
            attackerUnits: siege.attackerUnits || {
              infantry: siege.attackerTroops,
              armor: 0,
              airDrone: 0,
            },
            fromTerritoryId: siege.fromTerritoryId,
            defenderId: target.ownerId,
            defenderTroops: nextGarrison,
            defenderUnits: nextDefUnits,
          })
        );
      }
      continue;
    }

    // Arrived in allied / military-access territory at end of route -> NEVER delete troops; return intact to nearest owned garrison!
    if (targetAccess === 'FRIENDLY_PASS') {
      const retName = ctx.returnAttackerTroopsHome({
        attackerId: mv.ownerId,
        troops: mv.troops,
        units: mv.units,
        fromTerritoryId: mv.fromTerritoryId,
        nearTerritoryId: target.id,
      });
      if (mv.ownerId === playerNationId && retName) {
        ctx.toasts.push(
          `🤝 ${target.name} müttefik/geçiş kontrolünde; ordunuz (${(mv.troops / 1000).toFixed(1)}B) ${retName} garnizonuna döndü.`
        );
      }
      continue;
    }

    // Arrived in neutral/truce territory (e.g. peace signed or 3rd power captured province mid-march) -> return intact instead of creating a phantom battle/siege!
    if (
      targetAccess === 'BLOCKED' ||
      !isAtWar(ctx.nextWars, mv.ownerId, target.ownerId)
    ) {
      const retName = ctx.returnAttackerTroopsHome({
        attackerId: mv.ownerId,
        troops: mv.troops,
        units: mv.units,
        fromTerritoryId: mv.fromTerritoryId,
        nearTerritoryId: target.id,
      });
      if (mv.ownerId === playerNationId && retName) {
        ctx.toasts.push(
          `🏳️ ${target.name} ile aktif savaş bulunmadığından ordunuz (${(mv.troops / 1000).toFixed(1)}B) ${retName} garnizonuna döndü.`
        );
      }
      continue;
    }

    // Hostile arrival -> Battle defenders if garrisoned, otherwise start or reinforce city siege (0 -> 100/100)!
    const incomingUnits = mv.units || {
      infantry: mv.troops,
      armor: 0,
      airDrone: 0,
    };
    if (existingBattleIdx !== -1) {
      const btl = ctx.nextBattles[existingBattleIdx];
      const sameSideAsAttacker =
        mv.ownerId === btl.attackerId ||
        ctx.nextWars.some(
          (w) =>
            (w.attackers.includes(btl.attackerId) &&
              w.attackers.includes(mv.ownerId) &&
              w.defenders.includes(btl.defenderId)) ||
            (w.defenders.includes(btl.attackerId) &&
              w.defenders.includes(mv.ownerId) &&
              w.attackers.includes(btl.defenderId))
        );
      const sameSideAsDefender =
        !sameSideAsAttacker &&
        (mv.ownerId === btl.defenderId ||
          ctx.nextWars.some(
            (w) =>
              (w.attackers.includes(btl.defenderId) &&
                w.attackers.includes(mv.ownerId) &&
                w.defenders.includes(btl.attackerId)) ||
              (w.defenders.includes(btl.defenderId) &&
                w.defenders.includes(mv.ownerId) &&
                w.attackers.includes(btl.attackerId))
          ));

      if (sameSideAsAttacker) {
        const newAttTroops = btl.attackerTroops + mv.troops;
        const newAttUnits = {
          infantry:
            (btl.attackerUnits?.infantry || 0) + (incomingUnits.infantry || 0),
          armor: (btl.attackerUnits?.armor || 0) + (incomingUnits.armor || 0),
          airDrone:
            (btl.attackerUnits?.airDrone || 0) + (incomingUnits.airDrone || 0),
        };
        ctx.nextBattles[existingBattleIdx] = {
          ...btl,
          attackerTroops: newAttTroops,
          attackerInitialTroops:
            (btl.attackerInitialTroops || btl.attackerTroops) + mv.troops,
          attackerUnits: newAttUnits,
          attackerFrontline: newAttUnits.infantry + newAttUnits.armor,
          attackerBackline: newAttUnits.airDrone,
        };
      } else if (sameSideAsDefender) {
        const newDefTroops = btl.defenderTroops + mv.troops;
        const newDefUnits = {
          infantry:
            (btl.defenderUnits?.infantry || 0) + (incomingUnits.infantry || 0),
          armor: (btl.defenderUnits?.armor || 0) + (incomingUnits.armor || 0),
          airDrone:
            (btl.defenderUnits?.airDrone || 0) + (incomingUnits.airDrone || 0),
        };
        ctx.nextBattles[existingBattleIdx] = {
          ...btl,
          defenderTroops: newDefTroops,
          defenderInitialTroops:
            (btl.defenderInitialTroops || btl.defenderTroops) + mv.troops,
          defenderUnits: newDefUnits,
          defenderFrontline: newDefUnits.infantry + newDefUnits.armor,
          defenderBackline: newDefUnits.airDrone,
        };
      } else {
        // Unrelated 3rd belligerent cannot merge into someone else's battle -> return intact
        const retName = ctx.returnAttackerTroopsHome({
          attackerId: mv.ownerId,
          troops: mv.troops,
          units: incomingUnits,
          fromTerritoryId: mv.fromTerritoryId,
          nearTerritoryId: target.id,
        });
        if (mv.ownerId === playerNationId && retName) {
          ctx.toasts.push(
            `⚔️ ${target.name} bölgesinde başka devletler çarpışıyor; ordunuz ${retName} garnizonuna döndü.`
          );
        }
      }
    } else if (target.siege) {
      const existingSiege = target.siege;
      const sameCoalitionAsBesieger =
        existingSiege.attackerId === mv.ownerId ||
        Boolean(
          ctx.nextWars.some(
            (w) =>
              (w.attackers.includes(existingSiege.attackerId) &&
                w.attackers.includes(mv.ownerId) &&
                w.defenders.includes(target.ownerId)) ||
              (w.defenders.includes(existingSiege.attackerId) &&
                w.defenders.includes(mv.ownerId) &&
                w.attackers.includes(target.ownerId))
          )
        );

      if (sameCoalitionAsBesieger) {
        const mergedTroops = existingSiege.attackerTroops + mv.troops;
        const prevUnits = existingSiege.attackerUnits || {
          infantry: existingSiege.attackerTroops,
          armor: 0,
          airDrone: 0,
        };
        const mergedUnits = {
          infantry: (prevUnits.infantry || 0) + (incomingUnits.infantry || 0),
          armor: (prevUnits.armor || 0) + (incomingUnits.armor || 0),
          airDrone: (prevUnits.airDrone || 0) + (incomingUnits.airDrone || 0),
        };
        if (target.garrison > 350) {
          ctx.nextBattles.push(
            createOnMapBattle({
              terr: target,
              attackerId: existingSiege.attackerId,
              attackerTroops: mergedTroops,
              attackerUnits: mergedUnits,
              fromTerritoryId:
                existingSiege.fromTerritoryId || mv.fromTerritoryId,
              defenderId: target.ownerId,
              defenderTroops: target.garrison,
              defenderUnits: target.units || {
                infantry: target.garrison,
                armor: 0,
                airDrone: 0,
              },
            })
          );
        } else {
          ctx.writeTerritory(target.id, {
            ...target,
            siege: {
              ...existingSiege,
              attackerTroops: mergedTroops,
              attackerUnits: mergedUnits,
              fromTerritoryId:
                existingSiege.fromTerritoryId || mv.fromTerritoryId,
            },
          });
          if (mv.ownerId === playerNationId) {
            ctx.toasts.push(
              `♜ ${target.name} kuşatmasına +${(mv.troops / 1000).toFixed(1)}B takviye katıldı!`
            );
            ctx.sounds.push('MARCH');
          }
        }
      } else if (target.garrison > 350) {
        ctx.nextBattles.push(
          createOnMapBattle({
            terr: target,
            attackerId: mv.ownerId,
            attackerTroops: mv.troops,
            attackerUnits: incomingUnits,
            fromTerritoryId: mv.fromTerritoryId,
            defenderId: target.ownerId,
            defenderTroops: target.garrison,
            defenderUnits: target.units || {
              infantry: target.garrison,
              armor: 0,
              airDrone: 0,
            },
          })
        );
      } else {
        // Contested siege by rival belligerent -> replace if stronger or fight besieger
        if (
          isAtWar(ctx.nextWars, mv.ownerId, existingSiege.attackerId) &&
          existingSiege.attackerTroops > 350
        ) {
          ctx.nextBattles.push(
            createOnMapBattle({
              terr: target,
              attackerId: mv.ownerId,
              attackerTroops: mv.troops,
              attackerUnits: incomingUnits,
              fromTerritoryId: mv.fromTerritoryId,
              defenderId: existingSiege.attackerId,
              defenderTroops: existingSiege.attackerTroops,
              defenderUnits: existingSiege.attackerUnits || {
                infantry: existingSiege.attackerTroops,
                armor: 0,
                airDrone: 0,
              },
            })
          );
        } else if (mv.troops > existingSiege.attackerTroops) {
          // Stronger non-warring rival takes over siege -> return previous besieger safely home (never delete!)
          ctx.returnAttackerTroopsHome({
            attackerId: existingSiege.attackerId,
            troops: existingSiege.attackerTroops,
            units: existingSiege.attackerUnits,
            fromTerritoryId: existingSiege.fromTerritoryId,
            nearTerritoryId: target.id,
          });
          ctx.writeTerritory(target.id, {
            ...target,
            siege: {
              territoryId: target.id,
              fromTerritoryId: mv.fromTerritoryId,
              attackerId: mv.ownerId,
              defenderId: target.ownerId,
              attackerTroops: mv.troops,
              attackerUnits: incomingUnits,
              progress: 0,
              wallIntegrity: target.castleWallHp ?? 100,
              startedTick: nextTick,
            },
          });
        } else {
          // Existing rival besieger is larger -> return incoming army safely home (never delete!)
          const retName = ctx.returnAttackerTroopsHome({
            attackerId: mv.ownerId,
            troops: mv.troops,
            units: incomingUnits,
            fromTerritoryId: mv.fromTerritoryId,
            nearTerritoryId: target.id,
          });
          if (mv.ownerId === playerNationId && retName) {
            ctx.toasts.push(
              `♜ ${target.name} zaten başka bir devlet tarafından kuşatılıyor; ordunuz ${retName} garnizonuna döndü.`
            );
          }
        }
      }
    } else if (target.garrison > 350) {
      // Active defending garrison -> Start AoH3 On-Map Battle (victory transitions into siege)
      ctx.nextBattles.push(
        createOnMapBattle({
          terr: target,
          attackerId: mv.ownerId,
          attackerTroops: mv.troops,
          attackerUnits: incomingUnits,
          fromTerritoryId: mv.fromTerritoryId,
          defenderId: target.ownerId,
          defenderTroops: target.garrison,
          defenderUnits: target.units || {
            infantry: target.garrison,
            armor: 0,
            airDrone: 0,
          },
        })
      );
    } else {
      // Ungarrisoned or lightly guarded enemy city (0..350 garrison, fortified or unfortified)
      // ALWAYS starts a real city siege (0/100 -> 100/100) so empty cities can be besieged cleanly!
      ctx.writeTerritory(target.id, {
        ...target,
        garrison: 0,
        units: { infantry: 0, armor: 0, airDrone: 0 },
        siege: {
          territoryId: target.id,
          fromTerritoryId: mv.fromTerritoryId,
          attackerId: mv.ownerId,
          defenderId: target.ownerId,
          attackerTroops: mv.troops,
          attackerUnits: incomingUnits,
          progress: 0,
          wallIntegrity: target.castleWallHp ?? 100,
          startedTick: nextTick,
        },
      });
      if (mv.ownerId === playerNationId) {
        ctx.toasts.push(`♜ ${target.name} kuşatması başladı! (0/100)`);
        ctx.sounds.push('MARCH');
      } else if (target.ownerId === playerNationId) {
        ctx.toasts.push(`⚠️ ${target.name} şehri kuşatma altına alındı!`);
      }
    }
  }
}
