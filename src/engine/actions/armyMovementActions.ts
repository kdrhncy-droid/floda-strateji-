import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  SpeedLevel,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  formatGameDate,
  resolveWarParticipants,
} from '../simulationEngine';
import {
  getOrCreateRelation,
  isAtWar,
} from '../core/diplomacyHelpers';
import { getLordRetinueTroops } from '../pashaAndFiefEngine';
import { findArmyRouteAStar } from '../pathfindingEngine';
import { evaluateWartimeAiOperations } from '../aiAndRebellionEngine';
import { scaleUnits } from '../core/unitHelpers';
import { sound } from '../../utils/soundEngine';
import { EmpireActionPatch } from './empireActionTypes';

export function executeArmyMoveDomain(params: {
  fromId: string;
  toId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  playerNationId: string;
  moveRatio: number;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
  speed: SpeedLevel;
  forceDeclareWar?: boolean;
}): EmpireActionPatch {
  const {
    fromId,
    toId,
    territories,
    nations,
    relations,
    wars,
    movements,
    playerNationId,
    moveRatio,
    tick,
    gameMode,
    newsEvents,
    speed,
    forceDeclareWar = false,
  } = params;

  const fromT = territories[fromId];
  const toT = territories[toId];
  const playerNation = nations[playerNationId];
  if (!fromT || !toT || !playerNation) return {};

  if (fromT.ownerId !== playerNationId) {
    return {
      toastMessage:
        'Sadece kendi kontrolünüzdeki bölgelerden ordu yürütebilirsiniz.',
    };
  }

  const isForeign = toT.ownerId !== playerNationId;
  const targetRelOwner = nations[toT.ownerId];
  const relWithTarget = isForeign
    ? getOrCreateRelation(relations, playerNationId, toT.ownerId)
    : null;
  const isAlliedOrVassalDest =
    Boolean(relWithTarget?.isAllied) ||
    Boolean(relWithTarget?.hasMilitaryAccess) ||
    targetRelOwner?.vassalOf === playerNationId ||
    playerNation.vassalOf === toT.ownerId;
  const alreadyAtWarWithTarget = Boolean(
    isForeign && isAtWar(wars, playerNationId, toT.ownerId)
  );

  // AoH3 Rule: Cannot march into a neutral foreign nation's territory without declaring war first!
  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    !forceDeclareWar
  ) {
    return {
      pendingWarMove: {
        fromId,
        toId,
        targetNationId: toT.ownerId,
      },
      armyOrderSourceId: null,
      toastMessage: `🛑 ${targetRelOwner?.name || 'Yabancı Devlet'} ile savaşta değilsiniz! Sınır ötesi harekat için Savaş İlanını onaylayın.`,
    };
  }

  const route = findArmyRouteAStar({
    fromId,
    toId,
    moverNationId: playerNationId,
    territories,
    nations,
    relations,
    wars,
    allowTargetWarDeclaration: alreadyAtWarWithTarget || forceDeclareWar,
  });

  if (!route.reachable || route.hops.length === 0) {
    return {
      toastMessage:
        route.blockedReason || 'Hedef bölgeye ulaşılabilir bir rota bulunamadı.',
    };
  }

  const [firstHopId, ...remainingHops] = route.hops;
  const firstHopTerr = territories[firstHopId];

  const sendableTroops = Math.max(0, Math.floor(fromT.garrison - 500));
  const normalizedMoveRatio = Number.isFinite(moveRatio)
    ? Math.max(0, Math.min(1, moveRatio))
    : 0;
  const sendTroops = Math.min(
    sendableTroops,
    Math.round(sendableTroops * normalizedMoveRatio)
  );
  if (sendTroops < 1000) {
    return {
      toastMessage:
        'Hareket için en az 1.000 asker sevk edilmeli; kaynak eyalette 500 savunma askeri kalır.',
    };
  }

  let nextWars = wars;
  let nextNews = newsEvents;
  let toast: string | undefined;

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const targetNation = nations[toT.ownerId];
    const resolution = resolveWarParticipants(
      playerNationId,
      toT.ownerId,
      relations,
      nations
    );

    const defAllyNames = resolution.defensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);
    const attAllyNames = resolution.offensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);

    const newWar: ActiveWar = {
      id: `war_${Date.now()}`,
      name: `${playerNation.name} - ${targetNation?.name} Savaşı`,
      attackerId: playerNationId,
      defenderId: toT.ownerId,
      attackers: resolution.attackers,
      defenders: resolution.defenders,
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };
    nextWars = [...wars, newWar];

    let warDesc = `${playerNation.name} orduları ${toT.name} hedefine askeri harekat başlattı.`;
    if (attAllyNames.length > 0) {
      warDesc += ` Saldırı paktı ortağınız (${attAllyNames.join(', ')}) sizinle birlikte taarruza katıldı.`;
    }
    if (defAllyNames.length > 0) {
      warDesc += ` Hedefin savunma paktı müttefikleri (${defAllyNames.join(', ')}) savunmaya katıldı!`;
    }

    nextNews = [
      {
        id: `news_${Date.now()}_war`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: newWar.name,
        description: warDesc,
        type: 'WAR',
      },
      ...newsEvents.slice(0, 39),
    ];
    sound.playWarHorn();
    toast =
      defAllyNames.length > 0
        ? `${targetNation?.name} hedefine hareket başladı! Savunma Paktı (${defAllyNames.join(', ')}) savaşa dahil oldu!`
        : `${targetNation?.name} hedefine hareket başlatıldı ve savaş ilan edildi!`;
  } else {
    sound.playMarch();
    if (route.hops.length > 1) {
      toast = `🧭 Ordu ${route.hops.length} eyaletlik güzergâh üzerinden ${toT.name} hedefine harekete geçti!`;
    }
  }

  const calledLords = isForeign ? playerNation.bannerCalledLordIds || [] : [];
  const lordRetinueBonus = calledLords.reduce(
    (sum, lId) => sum + getLordRetinueTroops(lId, territories),
    0
  );

  const sourceUnits =
    fromT.units || { infantry: fromT.garrison, armor: 0, airDrone: 0 };
  const sentUnits = scaleUnits(
    sourceUnits,
    sendTroops / Math.max(1, fromT.garrison)
  );
  const remainingUnits = {
    infantry: Math.max(0, sourceUnits.infantry - sentUnits.infantry),
    armor: Math.max(0, sourceUnits.armor - sentUnits.armor),
    airDrone: Math.max(0, sourceUnits.airDrone - sentUnits.airDrone),
  };
  if (lordRetinueBonus > 0) {
    sentUnits.infantry += Math.round(lordRetinueBonus * 0.75);
    sentUnits.armor += Math.round(lordRetinueBonus * 0.25);
    toast = `Sancak Lordları harekete katıldı! (+${lordRetinueBonus.toLocaleString('tr-TR')} Lord Muhafızı orduya eklendi)`;
  }

  let workingNations: Record<string, Nation> =
    lordRetinueBonus > 0
      ? {
          ...nations,
          [playerNationId]: {
            ...playerNation,
            bannerCalledLordIds: [],
          },
        }
      : { ...nations };

  let workingTerritories: Record<string, Territory> = {
    ...territories,
    [fromId]: {
      ...fromT,
      garrison: Math.max(0, fromT.garrison - sendTroops),
      units: remainingUnits,
    },
  };

  let workingMovements: ArmyMovement[] = [
    ...movements,
    {
      id: `mv_${Date.now()}_${Math.random()}`,
      ownerId: playerNationId,
      fromTerritoryId: fromId,
      toTerritoryId: firstHopId,
      routeQueue: remainingHops,
      finalDestinationId: toId,
      troops: sendTroops + lordRetinueBonus,
      units: sentUnits,
      progress: 10,
      isAttack: Boolean(
        firstHopTerr &&
          firstHopTerr.ownerId !== playerNationId &&
          isAtWar(nextWars, playerNationId, firstHopTerr.ownerId)
      ),
    },
  ];

  // If this move declared a new war, trigger immediate enemy AI counter-mobilization & counter-attack!
  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const aiCounter = evaluateWartimeAiOperations({
      nextTick: tick,
      playerNationId,
      nations: workingNations,
      territories: workingTerritories,
      relations,
      wars: nextWars,
      movements: workingMovements,
      aiAggressiveness: 'AGGRESSIVE',
      maxActionsPerPass: 2,
    });
    if (aiCounter) {
      workingNations = aiCounter.updatedNations;
      workingTerritories = aiCounter.updatedTerritories;
      if (aiCounter.newMovements.length > 0) {
        workingMovements = [...workingMovements, ...aiCounter.newMovements];
      }
      if (aiCounter.playerAlerts.length > 0) {
        toast = `${toast || ''} ${aiCounter.playerAlerts[0]}`.trim();
      }
    }
  }

  return {
    nations: workingNations,
    wars: nextWars,
    newsEvents: nextNews,
    territories: workingTerritories,
    movements: workingMovements,
    armyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    ...(toast ? { toastMessage: toast } : {}),
  };
}

export function executeBatchArmyMoveDomain(params: {
  sourceIds: string[];
  toId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  playerNationId: string;
  moveRatio: number;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
  speed: SpeedLevel;
  forceDeclareWar?: boolean;
}): EmpireActionPatch {
  const {
    sourceIds,
    toId,
    territories,
    nations,
    relations,
    wars,
    movements,
    playerNationId,
    moveRatio,
    tick,
    gameMode,
    newsEvents,
    speed,
    forceDeclareWar = false,
  } = params;

  const toT = territories[toId];
  const playerNation = nations[playerNationId];
  if (!toT || !playerNation) return {};

  const normalizedMoveRatio = Number.isFinite(moveRatio)
    ? Math.max(0, Math.min(1, moveRatio))
    : 1;

  const uniqueSourceIds = Array.from(new Set(sourceIds)).filter(
    (id) => id && id !== toId
  );
  if (uniqueSourceIds.length === 0) {
    return {
      toastMessage: 'Toplu sevk için önce en az 1 kaynak şehir seçin.',
    };
  }

  const eligibleSources: { terr: Territory; sendTroops: number }[] = [];
  for (const sId of uniqueSourceIds) {
    const t = territories[sId];
    if (!t || t.ownerId !== playerNationId) continue;
    const sendable = Math.max(0, Math.floor(t.garrison - 500));
    const sendTroops = Math.min(
      sendable,
      Math.round(sendable * normalizedMoveRatio)
    );
    if (sendTroops >= 1000) {
      eligibleSources.push({ terr: t, sendTroops });
    }
  }

  if (eligibleSources.length === 0) {
    return {
      toastMessage:
        'Seçili şehirlerde sevk edilebilir yeterli asker yok (en az 1.000 asker sevk edilmeli ve 500 garnizon kalmalıdır).',
    };
  }

  const isForeign = toT.ownerId !== playerNationId;
  const targetRelOwner = nations[toT.ownerId];
  const relWithTarget = isForeign
    ? getOrCreateRelation(relations, playerNationId, toT.ownerId)
    : null;
  const isAlliedOrVassalDest =
    Boolean(relWithTarget?.isAllied) ||
    Boolean(relWithTarget?.hasMilitaryAccess) ||
    targetRelOwner?.vassalOf === playerNationId ||
    playerNation.vassalOf === toT.ownerId;
  const alreadyAtWarWithTarget = Boolean(
    isForeign && isAtWar(wars, playerNationId, toT.ownerId)
  );

  const allowRouteWar = alreadyAtWarWithTarget || forceDeclareWar;

  // Check routes for each eligible city before triggering war declaration
  const routedSources = eligibleSources
    .map((item) => {
      const route = findArmyRouteAStar({
        fromId: item.terr.id,
        toId,
        moverNationId: playerNationId,
        territories,
        nations,
        relations,
        wars,
        allowTargetWarDeclaration:
          allowRouteWar ||
          (isForeign && !isAlliedOrVassalDest && !alreadyAtWarWithTarget),
      });
      return { ...item, route };
    })
    .filter((item) => item.route.reachable && item.route.hops.length > 0);

  if (routedSources.length === 0) {
    return {
      toastMessage:
        'Seçili şehirlerden hedef eyalete ulaşılabilir kara/boğaz rotası bulunamadı.',
    };
  }

  // AoH3 Rule: Confirm war declaration before crossing into neutral foreign territory
  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    !forceDeclareWar
  ) {
    const validIds = routedSources.map((r) => r.terr.id);
    return {
      pendingWarMove: {
        fromId: validIds[0],
        sourceTerritoryIds: validIds,
        moveRatio: normalizedMoveRatio,
        toId,
        targetNationId: toT.ownerId,
      },
      armyOrderSourceId: null,
      toastMessage: `🛑 ${targetRelOwner?.name || 'Yabancı Devlet'} ile savaşta değilsiniz! ${validIds.length} orduluk toplu harekat için Savaş İlanını onaylayın.`,
    };
  }

  let nextWars = wars;
  let nextNews = newsEvents;
  let warNotice = '';

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const targetNation = nations[toT.ownerId];
    const resolution = resolveWarParticipants(
      playerNationId,
      toT.ownerId,
      relations,
      nations
    );
    const defAllyNames = resolution.defensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);
    const attAllyNames = resolution.offensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);

    const newWar: ActiveWar = {
      id: `war_${Date.now()}`,
      name: `${playerNation.name} - ${targetNation?.name} Savaşı`,
      attackerId: playerNationId,
      defenderId: toT.ownerId,
      attackers: resolution.attackers,
      defenders: resolution.defenders,
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };
    nextWars = [...wars, newWar];

    let warDesc = `${playerNation.name}, ${routedSources.length} eyaletlik toplu orduyu ${toT.name} hedefine sevk etti.`;
    if (attAllyNames.length > 0) {
      warDesc += ` Saldırı paktı ortağınız (${attAllyNames.join(', ')}) taarruza katıldı.`;
    }
    if (defAllyNames.length > 0) {
      warDesc += ` Savunma paktı müttefikleri (${defAllyNames.join(', ')}) savaşa dahil oldu!`;
    }

    nextNews = [
      {
        id: `news_${Date.now()}_war`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: newWar.name,
        description: warDesc,
        type: 'WAR',
      },
      ...newsEvents.slice(0, 39),
    ];
    sound.playWarHorn();
    warNotice =
      defAllyNames.length > 0
        ? ` Savaş ilan edildi (Savunma Paktı: ${defAllyNames.join(', ')})!`
        : ' Savaş ilan edildi!';
  } else {
    sound.playMarch();
  }

  const calledLords = isForeign ? playerNation.bannerCalledLordIds || [] : [];
  const lordRetinueBonus = calledLords.reduce(
    (sum, lId) => sum + getLordRetinueTroops(lId, territories),
    0
  );

  let workingNations: Record<string, Nation> =
    lordRetinueBonus > 0
      ? {
          ...nations,
          [playerNationId]: {
            ...playerNation,
            bannerCalledLordIds: [],
          },
        }
      : { ...nations };

  let workingTerritories: Record<string, Territory> = { ...territories };
  const addedMovements: ArmyMovement[] = [];
  let totalTroopsSent = 0;

  routedSources.forEach((item, idx) => {
    const src = workingTerritories[item.terr.id];
    if (!src) return;
    const [firstHopId, ...remainingHops] = item.route.hops;
    const firstHopTerr = workingTerritories[firstHopId];
    const sourceUnits =
      src.units || { infantry: src.garrison, armor: 0, airDrone: 0 };
    const sentUnits = scaleUnits(
      sourceUnits,
      item.sendTroops / Math.max(1, src.garrison)
    );
    const remainingUnits = {
      infantry: Math.max(0, sourceUnits.infantry - sentUnits.infantry),
      armor: Math.max(0, sourceUnits.armor - sentUnits.armor),
      airDrone: Math.max(0, sourceUnits.airDrone - sentUnits.airDrone),
    };

    let bonusTroops = 0;
    if (idx === 0 && lordRetinueBonus > 0) {
      bonusTroops = lordRetinueBonus;
      sentUnits.infantry += Math.round(lordRetinueBonus * 0.75);
      sentUnits.armor += Math.round(lordRetinueBonus * 0.25);
    }

    workingTerritories[src.id] = {
      ...src,
      garrison: Math.max(0, src.garrison - item.sendTroops),
      units: remainingUnits,
    };

    const totalThisArmy = item.sendTroops + bonusTroops;
    totalTroopsSent += totalThisArmy;

    addedMovements.push({
      id: `mv_batch_${Date.now()}_${idx}_${src.id}`,
      ownerId: playerNationId,
      fromTerritoryId: src.id,
      toTerritoryId: firstHopId,
      routeQueue: remainingHops,
      finalDestinationId: toId,
      troops: totalThisArmy,
      units: sentUnits,
      progress: 10,
      isAttack: Boolean(
        firstHopTerr &&
          firstHopTerr.ownerId !== playerNationId &&
          isAtWar(nextWars, playerNationId, firstHopTerr.ownerId)
      ),
    });
  });

  let workingMovements = [...movements, ...addedMovements];

  const skippedCount = uniqueSourceIds.length - routedSources.length;
  let toast = `⚔️ ${routedSources.length} şehirden ${(totalTroopsSent / 1000).toFixed(1)}B asker ${toT.name} hedefine sevk edildi!${warNotice}`;
  if (skippedCount > 0) {
    toast += ` (${skippedCount} şehirde yetersiz garnizon/rota atlandı)`;
  }

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const aiCounter = evaluateWartimeAiOperations({
      nextTick: tick,
      playerNationId,
      nations: workingNations,
      territories: workingTerritories,
      relations,
      wars: nextWars,
      movements: workingMovements,
      aiAggressiveness: 'AGGRESSIVE',
      maxActionsPerPass: 2,
    });
    if (aiCounter) {
      workingNations = aiCounter.updatedNations;
      workingTerritories = aiCounter.updatedTerritories;
      if (aiCounter.newMovements.length > 0) {
        workingMovements = [...workingMovements, ...aiCounter.newMovements];
      }
      if (aiCounter.playerAlerts.length > 0) {
        toast = `${toast} ${aiCounter.playerAlerts[0]}`.trim();
      }
    }
  }

  return {
    nations: workingNations,
    wars: nextWars,
    newsEvents: nextNews,
    territories: workingTerritories,
    movements: workingMovements,
    armyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: toast,
  };
}

export function siegeBombardmentDomain(params: {
  territoryId: string;
  method: 'ARTILLERY' | 'DRONE_RAID';
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode: GameModeId;
}): EmpireActionPatch {
  const { territoryId, method, territories, nations, playerNationId, gameMode } =
    params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  if (!t || !p || t.ownerId === playerNationId) return {};

  const hasAdjacentFrontline = t.neighbors.some(
    (nbId) => territories[nbId]?.ownerId === playerNationId
  );
  if (!hasAdjacentFrontline) {
    return {
      toastMessage: `🛑 Kuşatma bombardımanı için ${t.name} eyaletine komşu bir sınır sancağımız olmalıdır!`,
    };
  }

  if ((t.castleWallHp ?? 100) <= 0) {
    return {
      toastMessage: `${t.name} Kalesinin surları zaten tamamen yıkıldı (%0)! Ordunuzu şehre yürüterek muharebeyi başlatın.`,
    };
  }

  if (method === 'ARTILLERY') {
    if (p.treasury < 180) {
      return {
        toastMessage: 'Kuşatma topçu bombardımanı için 180 Altın gerekli.',
      };
    }
    sound.playWarHorn();
    const wallBefore = Math.max(0, Math.min(100, t.castleWallHp ?? 100));
    const wallAfter = Math.max(0, wallBefore - 35);
    const newGarrison = Math.max(0, Math.round(t.garrison * 0.9));
    const garrisonLoss = Math.max(0, t.garrison - newGarrison);
    return {
      nations: {
        ...nations,
        [playerNationId]: { ...p, treasury: p.treasury - 180 },
      },
      territories: {
        ...territories,
        [territoryId]: {
          ...t,
          castleWallHp: wallAfter,
          garrison: newGarrison,
          units: scaleUnits(t.units, newGarrison / Math.max(1, t.garrison)),
          ...(t.siege ? { siege: { ...t.siege, wallIntegrity: wallAfter } } : {}),
        },
      },
      toastMessage: `${t.name} Kalesi topçu ateşine tutuldu: surlar %${wallBefore} → %${wallAfter}; garnizon ${t.garrison.toLocaleString('tr-TR')} → ${newGarrison.toLocaleString('tr-TR')} asker (${garrisonLoss.toLocaleString('tr-TR')} kayıp).`,
    };
  }

  if ((p.clanInfluence ?? 0) < 20 || p.treasury < 220) {
    return {
      toastMessage:
        gameMode === 'EMPIRES_1440'
          ? 'Şahi Topu & Lağımcı Hücumu için 220 Altın ve 20 ⚜ Klan Nüfuzu gerekli.'
          : 'Nokta Kuşatma Baskını için 220 Altın ve 20 ⚜ Klan Nüfuzu gerekli.',
    };
  }

  sound.playWarHorn();
  const wallBefore = Math.max(0, Math.min(100, t.castleWallHp ?? 100));
  const wallAfter = Math.max(0, wallBefore - 45);
  const newGarrison = Math.max(0, Math.round(t.garrison * 0.82));
  const garrisonLoss = Math.max(0, t.garrison - newGarrison);
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - 220,
        clanInfluence: Math.max(0, (p.clanInfluence || 0) - 20),
      },
    },
    territories: {
      ...territories,
        [territoryId]: {
          ...t,
          castleWallHp: wallAfter,
          garrison: newGarrison,
          units: scaleUnits(t.units, newGarrison / Math.max(1, t.garrison)),
          ...(t.siege ? { siege: { ...t.siege, wallIntegrity: wallAfter } } : {}),
      },
    },
    toastMessage:
      gameMode === 'EMPIRES_1440'
        ? `${t.name} Kalesine Şahi & Lağımcı hücumu yapıldı: surlar %${wallBefore} → %${wallAfter}; garnizon ${t.garrison.toLocaleString('tr-TR')} → ${newGarrison.toLocaleString('tr-TR')} asker (${garrisonLoss.toLocaleString('tr-TR')} kayıp).`
        : `${t.name} Kalesine kuşatma baskını düzenlendi: surlar %${wallBefore} → %${wallAfter}; garnizon ${t.garrison.toLocaleString('tr-TR')} → ${newGarrison.toLocaleString('tr-TR')} asker (${garrisonLoss.toLocaleString('tr-TR')} kayıp).`,
  };
}

/**
 * Gathers excess safe reserve troops from adjacent friendly provinces straight into `targetTerritoryId`.
 * Respects active battles and sieges so frontline defenders are never stripped mid-combat.
 */
export function mergeNeighborArmiesDomain(params: {
  targetTerritoryId: string;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  movements: ArmyMovement[];
  playerNationId: string;
  speed: SpeedLevel;
}): EmpireActionPatch {
  const {
    targetTerritoryId,
    territories,
    wars,
    battles,
    movements,
    playerNationId,
    speed,
  } = params;

  const target = territories[targetTerritoryId];
  if (!target || target.ownerId !== playerNationId) {
    return {
      toastMessage: 'Orduları yalnızca kendi kontrolünüzdeki bir şehirde birleştirebilirsiniz.',
    };
  }

  const battleTerrIds = new Set(battles.map((b) => b.territoryId));
  const nextTerritories = { ...territories };
  const addedMovements: ArmyMovement[] = [];
  let totalMergedTroops = 0;
  let mergedSourceCount = 0;

  for (const nbId of target.neighbors) {
    const nb = nextTerritories[nbId];
    if (!nb || nb.ownerId !== playerNationId) continue;
    if (nb.siege || battleTerrIds.has(nbId)) continue;

    const bordersActiveEnemy = nb.neighbors.some((n2Id) => {
      const n2 = nextTerritories[n2Id];
      return Boolean(
        n2 &&
          n2.ownerId !== playerNationId &&
          isAtWar(wars, playerNationId, n2.ownerId)
      );
    });
    const reserve = bordersActiveEnemy ? 1000 : 500;
    const sendable = Math.floor(nb.garrison - reserve);
    if (sendable < 500) continue;

    const ratio = sendable / Math.max(1, nb.garrison);
    const srcUnits = nb.units || { infantry: nb.garrison, armor: 0, airDrone: 0 };
    const sentUnits = scaleUnits(srcUnits, ratio);
    const remainingUnits = {
      infantry: Math.max(0, srcUnits.infantry - sentUnits.infantry),
      armor: Math.max(0, srcUnits.armor - sentUnits.armor),
      airDrone: Math.max(0, srcUnits.airDrone - sentUnits.airDrone),
    };

    nextTerritories[nbId] = {
      ...nb,
      garrison: Math.max(0, nb.garrison - sendable),
      units: remainingUnits,
    };

    addedMovements.push({
      id: `mv_merge_${Date.now()}_${nbId}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: playerNationId,
      fromTerritoryId: nbId,
      toTerritoryId: targetTerritoryId,
      finalDestinationId: targetTerritoryId,
      troops: sendable,
      units: sentUnits,
      progress: 22,
      isAttack: false,
    });

    totalMergedTroops += sendable;
    mergedSourceCount++;
  }

  if (addedMovements.length === 0) {
    return {
      toastMessage:
        'Komşu eyaletlerde birleştirilebilecek güvenli yedek birlik yok (Savaş/kuşatma altındaki veya yalnız sınır nöbetçileri yerinde kalır).',
    };
  }

  sound.playMarch();
  return {
    territories: nextTerritories,
    movements: [...movements, ...addedMovements],
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: `🛡️ ${mergedSourceCount} komşu şehirden ${totalMergedTroops.toLocaleString('tr-TR')} asker ${target.name} merkezinde birleşmek üzere harekete geçti!`,
  };
}

/**
 * Disbands 50% or 100% of stationed garrison on peaceful owned territory and refunds 75% to manpower pool.
 * Strictly blocked during active combat or siege to prevent war-score denial exploits.
 */
export function disbandArmyDomain(params: {
  territoryId: string;
  ratio: 0.5 | 1;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  battles: ActiveBattle[];
  playerNationId: string;
}): EmpireActionPatch {
  const { territoryId, ratio, territories, nations, battles, playerNationId } = params;
  const terr = territories[territoryId];
  const playerNation = nations[playerNationId];
  if (!terr || !playerNation || terr.ownerId !== playerNationId) return {};

  if (terr.siege || battles.some((b) => b.territoryId === territoryId)) {
    return {
      toastMessage:
        '⚔️ Aktif muharebe veya kuşatma altındaki bir şehirde asker silinemez (terhis engellendi)!',
    };
  }

  if (terr.garrison <= 0) {
    return { toastMessage: 'Bu şehirde silinecek / terhis edilecek asker yok.' };
  }

  const disbandedTroops =
    ratio >= 1
      ? Math.max(0, Math.floor(terr.garrison))
      : Math.max(0, Math.floor(terr.garrison * ratio));
  if (disbandedTroops <= 0) return {};

  const remainingTroops = Math.max(0, terr.garrison - disbandedTroops);
  const srcUnits = terr.units || { infantry: terr.garrison, armor: 0, airDrone: 0 };
  const remainingUnits =
    remainingTroops === 0
      ? { infantry: 0, armor: 0, airDrone: 0 }
      : scaleUnits(srcUnits, remainingTroops / Math.max(1, terr.garrison));

  const refundedManpower = Math.round(disbandedTroops * 0.75);
  sound.playClick();

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...playerNation,
        manpower: playerNation.manpower + refundedManpower,
      },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...terr,
        garrison: remainingTroops,
        units: remainingUnits,
      },
    },
    toastMessage: `🪖 ${terr.name}: ${disbandedTroops.toLocaleString('tr-TR')} asker silindi/terhis edildi (+${refundedManpower.toLocaleString('tr-TR')} İnsan Gücü rezerve iade edildi).`,
  };
}
